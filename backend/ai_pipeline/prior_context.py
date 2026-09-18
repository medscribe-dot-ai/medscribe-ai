"""Prior clinical context formatting (from Colab format_prior_clinical_context)."""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Cap prior context so today's transcript stays fully available in the prompt.
_PRIOR_CONTEXT_CHAR_CAP = 1400


def format_prior_clinical_context(prior: Optional[dict]) -> str:
    """Convert optional prior_clinical_context into labelled reference-only text."""
    if not prior or not isinstance(prior, dict):
        return ""
    visits = prior.get("visits") or []
    if not isinstance(visits, list) or not visits:
        return ""
    v = visits[0]
    if not isinstance(v, dict):
        return ""

    lines = ["=== PRIOR COMPLETED VISIT — REFERENCE ONLY ==="]
    if v.get("scheduled_time"):
        lines.append(f"Date: {v.get('scheduled_time')}")
    if v.get("doctor_name"):
        lines.append(f"Doctor: {v.get('doctor_name')}")
    if v.get("assessment"):
        lines.append(f"Assessment: {v.get('assessment')}")
    if v.get("plan"):
        lines.append(f"Plan: {v.get('plan')}")
    if v.get("subjective"):
        lines.append(f"Subjective: {v.get('subjective')}")
    if v.get("objective"):
        lines.append(f"Objective: {v.get('objective')}")
    if v.get("soap_note_excerpt") and not (v.get("assessment") or v.get("plan")):
        lines.append(f"SOAP excerpt: {v.get('soap_note_excerpt')}")
    lines.append("=== END PRIOR VISIT ===")
    if len(lines) <= 2:
        return ""

    text_block = "\n".join(lines)
    if len(text_block) > _PRIOR_CONTEXT_CHAR_CAP:
        text_block = text_block[: _PRIOR_CONTEXT_CHAR_CAP - 1].rstrip() + "…"
        logger.warning(
            "Prior clinical context truncated to %s chars",
            _PRIOR_CONTEXT_CHAR_CAP,
        )
    return text_block
