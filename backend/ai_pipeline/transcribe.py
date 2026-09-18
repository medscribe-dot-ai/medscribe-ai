"""Whisper transcription / translation via Groq (from Colab transcribe_and_translate)."""
from __future__ import annotations

import logging
import os

import langdetect

from .config import get_groq_client, log_stage

logger = logging.getLogger(__name__)


def transcribe_and_translate(audio_path):

    logger.info("Running Groq Whisper translation...")

    file_size = os.path.getsize(audio_path) / (1024 * 1024)
    logger.info("File size: %.1f MB", file_size)

    groq_client = get_groq_client()

    with open(audio_path, "rb") as audio_file:
        response = groq_client.audio.translations.create(
            file=audio_file,
            model="whisper-large-v3",
        )

    translated_text = response.text
    logger.info("Translation done — %s chars", len(translated_text))

    try:
        detected_lang = langdetect.detect(translated_text[:300])
        logger.info("Detected language: %s", detected_lang)

        if detected_lang != "en":
            logger.warning(
                "Non-English detected (%s) — retrying with whisper-large-v3-turbo...",
                detected_lang,
            )

            with open(audio_path, "rb") as audio_file:
                response = groq_client.audio.translations.create(
                    file=audio_file,
                    model="whisper-large-v3-turbo",
                )

            translated_text = response.text
            logger.info("Turbo translation done — %s chars", len(translated_text))

    except Exception as e:
        logger.warning("Language detection skipped: %s", e)

    log_stage("1. RAW TRANSCRIPT (Whisper Output)", translated_text)

    return translated_text
