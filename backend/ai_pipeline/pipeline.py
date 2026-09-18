"""
Production AI pipeline orchestration.

Equivalent to Colab SOAP_Pipeline.ipynb Cell 8 `process_audio` (/process path).
Not wired into main.py yet — call run_pipeline(...) from a later integration step.
"""
from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import time

from .audio_io import download_audio
from .clean_audio import clean_audio
from .medical_correction import medical_correction
from .prior_context import format_prior_clinical_context
from .progress import update_progress
from .soap_endorse import endorse_soap_note, soap_has_required_sections
from .soap_generate import generate_soap_note
from .speakers import apply_labels, label_speakers
from .transcribe import transcribe_and_translate
from .config import log_stage

logger = logging.getLogger(__name__)


def _finalize_consultation(
    db,
    consultation_id: int,
    *,
    status: str,
    soap_note=None,
    transcript=None,
    corrected_transcript=None,
    processing_step=None,
    progress_message=None,
    progress_percent=None,
    error_message=None,
):
    """SQLAlchemy replacement for Colab supabase.table('consultations').update(...)."""
    from models import Consultation

    consultation = (
        db.query(Consultation)
        .filter(Consultation.consultation_id == int(consultation_id))
        .first()
    )
    if not consultation:
        raise ValueError(f"Consultation {consultation_id} not found for finalization")

    consultation.status = status
    if soap_note is not None:
        consultation.soap_note = soap_note
    if transcript is not None:
        consultation.transcript = transcript
    if corrected_transcript is not None:
        consultation.corrected_transcript = corrected_transcript
    if processing_step is not None:
        consultation.processing_step = processing_step
    if progress_message is not None:
        consultation.progress_message = progress_message
    if progress_percent is not None:
        consultation.progress_percent = progress_percent
    if error_message is not None:
        consultation.error_message = error_message
    consultation.updated_at = datetime.datetime.utcnow()
    db.commit()


async def run_pipeline(
    *,
    consultation_id: int,
    audio_url: str,
    bucket_path: str,
    prior_clinical_context: dict | None = None,
    db,
) -> dict:
    """
    Production equivalent of Colab process_audio(/process).

    Writes progress and final result to the consultations row via SQLAlchemy.
    Does not call Groq unless invoked with a live GROQ_API_KEY (not done in Phase 1 checks).
    """
    record_id = str(consultation_id)

    logger.info("=" * 70)
    logger.info("New request — consultation_id: %s", record_id)
    logger.info("=" * 70)

    await update_progress(db, record_id, "started", "Processing started", 5)

    raw_audio_path = None
    clean_audio_path = None

    try:
        timings = {}

        # ──────────────────────────────────────────────────────
        # Step 1: Download
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "downloading",
            "Downloading audio from Supabase...",
            10,
        )

        t0 = time.perf_counter()
        raw_audio_path = download_audio(audio_url, bucket_path)
        timings["download"] = time.perf_counter() - t0

        clean_audio_path = os.path.splitext(raw_audio_path)[0] + "_clean.wav"

        # ──────────────────────────────────────────────────────
        # Step 2: Clean audio
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "cleaning",
            "Cleaning & enhancing audio...",
            20,
        )

        t0 = time.perf_counter()
        clean_audio(raw_audio_path, clean_audio_path)
        timings["clean_audio"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Step 3: Transcribe
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "transcribing",
            "Transcribing & translating to English...",
            35,
        )

        t0 = time.perf_counter()
        translated = transcribe_and_translate(clean_audio_path)
        timings["transcription"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Step 4: Label speakers
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "labeling",
            "AI identifying Doctor vs Patient...",
            50,
        )

        t0 = time.perf_counter()
        labels = label_speakers(translated)
        labeled = apply_labels(translated, labels)
        timings["speaker_labeling"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Step 5: Medical correction
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "correcting",
            "Medical correction & filtering...",
            65,
        )

        t0 = time.perf_counter()
        corrected = medical_correction(labeled)
        timings["medical_correction"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Step 6: Generate SOAP
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "generating",
            "Generating professional SOAP note with MedGemma...",
            80,
        )

        transcript_text = "\n".join(
            [
                f"{seg['speaker']} [{seg['start']}s]: {seg['text']}"
                for seg in corrected
            ]
        )

        log_stage("3b. TRANSCRIPT SENT TO MEDGEMMA", transcript_text)

        prior_text = format_prior_clinical_context(prior_clinical_context)
        if prior_text:
            log_stage("3c. PRIOR CLINICAL CONTEXT (reference only)", prior_text)

        loop = asyncio.get_event_loop()

        t0 = time.perf_counter()
        draft_soap = await loop.run_in_executor(
            None,
            lambda: generate_soap_note(transcript_text, prior_text),
        )
        timings["soap_generation"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Step 7: Endorsement
        # ──────────────────────────────────────────────────────

        await update_progress(
            db,
            record_id,
            "auditing",
            "Clinical review & final endorsement...",
            95,
        )

        t0 = time.perf_counter()
        final_soap = await loop.run_in_executor(
            None,
            lambda: endorse_soap_note(transcript_text, draft_soap, prior_text),
        )
        timings["endorsement"] = time.perf_counter() - t0

        if not soap_has_required_sections(final_soap or ""):
            logger.warning(
                "Endorsed SOAP missing required S/O/A/P sections "
                "(truncated/incomplete) — falling back to draft_soap"
            )
            if soap_has_required_sections(draft_soap or ""):
                final_soap = draft_soap
            else:
                logger.warning(
                    "Draft SOAP also incomplete — keeping endorsed output"
                )
        else:
            logger.info("Endorsed SOAP contains all required sections")

        # ──────────────────────────────────────────────────────
        # Save as pending_approval
        # ──────────────────────────────────────────────────────

        t0 = time.perf_counter()
        _finalize_consultation(
            db,
            consultation_id,
            status="pending_approval",
            soap_note=final_soap,
            transcript=transcript_text,
            corrected_transcript=json.dumps(corrected),
            processing_step="pending_approval",
            progress_message="AI SOAP Note ready — awaiting doctor approval",
            progress_percent=100,
        )
        timings["supabase_finalization"] = time.perf_counter() - t0

        # ──────────────────────────────────────────────────────
        # Cleanup
        # ──────────────────────────────────────────────────────

        for f in [raw_audio_path, clean_audio_path]:
            if f and os.path.exists(f):
                os.remove(f)

        logger.info("ALL STAGES COMPLETE — consultation_id: %s", record_id)
        logger.info("Status: pending_approval (awaiting doctor approval)")

        logger.info("=" * 70)
        logger.info("TIMING SUMMARY (process_audio)")
        logger.info("=" * 70)
        order = [
            "download",
            "clean_audio",
            "transcription",
            "speaker_labeling",
            "medical_correction",
            "soap_generation",
            "endorsement",
            "supabase_finalization",
        ]
        total = 0.0
        for key in order:
            if key in timings:
                sec = timings[key]
                total += sec
                logger.info("  %-22s %7.2fs", key, sec)
        logger.info("  %-22s %7.2fs", "TOTAL", total)
        logger.info("=" * 70)

        return {
            "status": "pending_approval",
            "record_id": record_id,
            "soap_note": final_soap,
            "message": "AI SOAP note generated. Doctor approval required.",
        }

    except Exception as e:
        error_msg = str(e)
        logger.error("Error: %s", error_msg)

        await update_progress(db, record_id, "error", f"Error: {error_msg}", 0)

        try:
            _finalize_consultation(
                db,
                consultation_id,
                status="error",
                error_message=error_msg,
                processing_step="error",
            )
        except Exception as finalize_err:
            logger.error("Failed to write error status: %s", finalize_err)
            try:
                db.rollback()
            except Exception:
                pass

        return {
            "status": "error",
            "record_id": record_id,
            "soap_note": None,
            "message": error_msg,
        }

    finally:
        for f in [raw_audio_path, clean_audio_path]:
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass
