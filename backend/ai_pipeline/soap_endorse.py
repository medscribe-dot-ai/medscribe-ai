"""SOAP endorsement / section validation (from Colab endorse_soap_note)."""
from __future__ import annotations

import logging
import re

from .config import get_groq_client, log_stage

logger = logging.getLogger(__name__)


def soap_has_required_sections(soap_text: str) -> bool:
    """Robust check that Subjective/Objective/Assessment/Plan headers exist."""
    if not soap_text or not str(soap_text).strip():
        return False
    text = str(soap_text)
    patterns = {
        "subjective": r"(?i)(?:^|\n)[^\n]*\bSubjective\b",
        "objective": r"(?i)(?:^|\n)[^\n]*\bObjective\b",
        "assessment": r"(?i)(?:^|\n)[^\n]*\bAssessment\b",
        "plan": r"(?i)(?:^|\n)[^\n]*\bPlan\b",
    }
    return all(re.search(p, text) for p in patterns.values())


def endorse_soap_note(
    transcript,
    draft_soap,
    prior_context_text: str = ""
):

    ENDORSEMENT_PROMPT = f"""
    You are a Senior Medical Auditor. Your goal is to provide a FINAL ENDORSEMENT for a SOAP note.

    ### CRITICAL TASKS:
    1. SOURCE GROUNDING: If the draft suggests clinical logic, diagnoses, differentials, investigations, medicines, doses, vitals, exam findings, or treatments that are NOT supported by the transcript, REMOVE them. Do NOT preserve unsupported [Inferred] inventions merely because they seem clinically reasonable.
    2. LABELING: For retained, transcript-supported items that need labels, ensure they are clearly labeled as [Inferred - verify dose] or similar — do NOT keep unsupported suggestions by relabeling them.
    3. FIDELITY: Ensure all facts from the transcript are present.
    4. ACCURACY: Ensure the diagnosis matches the doctor's intent (only if a diagnosis was stated).
    5. PRIOR CONTEXT: If PRIOR CLINICAL CONTEXT is provided, treat it as historical reference only. Do NOT remove legitimate longitudinal continuity solely because it is absent from today's transcript. Do NOT invent today's findings from prior context alone. If prior conflicts with today's transcript, today's transcript wins.

    ORIGINAL TRANSCRIPT (TODAY):
    {transcript}

    PRIOR CLINICAL CONTEXT (historical reference only — may be empty):
    {prior_context_text if prior_context_text else "(none)"}

    DRAFT SOAP NOTE (from MedGemma):
    {draft_soap}

    ### FINAL OUTPUT:
    Return the refined SOAP note. Ensure the Medications section includes only drugs supported by the transcript (preserve doctor-stated medications from the draft).
    At the very end, add: "✅ CLINICAL ENDORSEMENT: Verified by Llama-3.3-70B Audit Agent."

    ## AUDIT DISCREPANCIES:
    List any changes made from the draft, using this format:
    - [REMOVED] Item X — Reason: Not in transcript / Fabricated
    - [ADDED LABEL] Item Y — Changed from [Inferred] to [Inferred - verify before use]
    - [MOVED] Item Z — Moved from Investigations to Medications
    - [CORRECTED] Diagnosis confidence changed from HIGH to MODERATE

    If no changes were needed, write: "✅ No discrepancies found. Draft accepted as-is.

    ### STRICT FORMATTING RULES (DO NOT BREAK):
    1. Section headers MUST be exactly: "S — Subjective:", "O — Objective:", "A — Assessment:", "P — Plan:"
        - No markdown like ###, **, or *
        - No preamble like "FINAL OUTPUT:" before headers
      2. Medications MUST use em-dash (—) NOT hyphen (-):
        Tab. Paracetamol 500mg — Oral — TDS — 3–5 days — [Inferred - verify dose]
      3. Investigations MUST use em-dash (—):
        CBC/Blood CP — Venous Blood — STAT — [Doctor ordered]
      4. ALL labels on retained, transcript-supported items MUST be preserved exactly as written in the draft.
      5. Do NOT wrap in markdown code blocks.
    """

    try:
        groq_client = get_groq_client()

        completion = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content":
                        "You are a strict medical auditor "
                        "ensuring clinical safety."
                },
                {
                    "role": "user",
                    "content": ENDORSEMENT_PROMPT
                }
            ],
            temperature=0.0,
            max_tokens=4096
        )

        endorsed = (
            completion.choices[0]
            .message.content
        )

        log_stage(
            "5. FINAL ENDORSED SOAP NOTE "
            "(Llama-3.3-70B Audit)",
            endorsed
        )

        return endorsed

    except Exception as e:

        error_result = (
            f"Endorsement failed: {e}\n\n"
            f"Original Draft:\n{draft_soap}"
        )

        log_stage(
            "5. FINAL ENDORSED SOAP NOTE "
            "(endorsement failed — draft shown)",
            error_result
        )

        return error_result
