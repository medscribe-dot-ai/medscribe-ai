"""Speaker labeling (from Colab label_speakers / apply_labels)."""
from __future__ import annotations

import json
import logging
import re

from .config import get_groq_client, log_stage

logger = logging.getLogger(__name__)


def _split_transcript_sentences(transcript_text: str):
    """Same sentence split used by apply_labels (keep in sync)."""
    return [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+|\n", (transcript_text or "").strip())
        if s.strip()
    ]


def _conservative_speaker_labels(n: int):
    """Deterministic fallback labels when LLM labeling fails validation."""
    labels = []
    for i in range(n):
        speaker = "DOCTOR" if i % 2 == 0 else "PATIENT"
        labels.append({"index": i, "speaker": speaker})
    return labels


def label_speakers(transcript_text):

    logger.info("Labeling speakers with Groq...")

    sentences = _split_transcript_sentences(transcript_text)
    n = len(sentences)

    if n == 0:
        logger.warning("No sentences to label — returning empty list")
        return []

    prompt = f"""
You are a medical conversation analyzer. Label each sentence as either DOCTOR or PATIENT.

Transcript:
{transcript_text}

Return ONLY a JSON list like: [{{"index": 0, "speaker": "DOCTOR"}}, ...]
Each index corresponds to a sentence (split by period/newline).
You MUST return exactly {n} objects with indices 0 through {n - 1}.
"""

    groq_client = get_groq_client()

    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        temperature=0.0,
        max_tokens=2048,
    )

    raw = completion.choices[0].message.content or ""
    labels = None

    try:
        labels = json.loads(raw)
    except Exception:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            try:
                labels = json.loads(match.group())
            except Exception:
                labels = None

    def _labels_valid(lbls) -> bool:
        if not isinstance(lbls, list) or len(lbls) != n:
            return False
        indices = []
        for item in lbls:
            if not isinstance(item, dict):
                return False
            speaker = str(item.get("speaker", "")).upper().strip()
            if speaker not in ("DOCTOR", "PATIENT"):
                return False
            idx = item.get("index")
            if not isinstance(idx, int):
                return False
            indices.append(idx)
        if sorted(indices) != list(range(n)):
            return False
        return True

    if not _labels_valid(labels):
        got = 0 if not isinstance(labels, list) else len(labels)
        logger.warning(
            "Speaker label validation failed (got %s vs %s sentences) — using conservative fallback",
            got,
            n,
        )
        labels = _conservative_speaker_labels(n)
    else:
        normalized = []
        for item in labels:
            speaker = str(item.get("speaker", "")).upper().strip()
            normalized.append(
                {
                    "index": item["index"],
                    "speaker": speaker,
                }
            )
        labels = sorted(normalized, key=lambda x: x["index"])

    logger.info("%s speaker labels assigned", len(labels))

    return labels


def apply_labels(transcript_text, labels):

    sentences = re.split(r"(?<=[.!?])\s+|\n", transcript_text.strip())

    label_map = {item["index"]: item["speaker"] for item in labels}

    result = []

    for i, sentence in enumerate(sentences):

        if sentence.strip():

            result.append(
                {
                    "speaker": label_map.get(i, "UNKNOWN"),
                    "start": i * 3,
                    "text": sentence.strip(),
                }
            )

    labeled_display = "\n".join(
        [f"[{seg['speaker']}]: {seg['text']}" for seg in result]
    )

    log_stage("2. SPEAKER-LABELED TRANSCRIPT", labeled_display)

    return result
