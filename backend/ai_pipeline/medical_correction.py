"""Medical terminology correction (from Colab medical_correction)."""
from __future__ import annotations

import json
import logging
import re

from .config import get_groq_client, log_stage

logger = logging.getLogger(__name__)


def medical_correction(segments):

    logger.info("Medical term correction with Groq...")

    text = "\n".join([f"{s['speaker']}: {s['text']}" for s in segments])

    prompt = f"""You are a medical transcription corrector. Fix medical terminology only.

Transcript:
{text}

Return the SAME structure as JSON:
[{{"speaker": "DOCTOR", "start": 0, "text": "corrected text"}}, ...]"""

    try:
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

        raw = completion.choices[0].message.content

        match = re.search(r"\[.*\]", raw, re.DOTALL)

        if match:
            corrected = json.loads(match.group())

            logger.info("Medical correction done — %s segments", len(corrected))

            corrected_display = "\n".join(
                [f"[{seg['speaker']}]: {seg['text']}" for seg in corrected]
            )

            log_stage("3. MEDICALLY CORRECTED TRANSCRIPT", corrected_display)

            return corrected

    except Exception as e:
        logger.warning("Medical correction failed, using original: %s", e)

    fallback_display = "\n".join(
        [f"[{seg['speaker']}]: {seg['text']}" for seg in segments]
    )

    log_stage(
        "3. MEDICALLY CORRECTED TRANSCRIPT (fallback — original used)",
        fallback_display,
    )

    return segments
