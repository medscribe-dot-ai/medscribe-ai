"""Audio download and extension detection (from Colab process_audio / detect_audio_extension)."""
from __future__ import annotations

import logging
import os
import tempfile

import requests

logger = logging.getLogger(__name__)


def detect_audio_extension(audio_response, bucket_path: str) -> str:
    """
    Detect the correct audio extension.

    Some Supabase files have no real extension in their filename.
    In that case, use the HTTP Content-Type returned by Supabase.
    """

    content_type = (
        audio_response.headers
        .get("Content-Type", "")
        .lower()
        .split(";")[0]
        .strip()
    )

    mime_to_ext = {
        "audio/aac": ".aac",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/wave": ".wav",
        "audio/mp4": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/ogg": ".ogg",
        "audio/webm": ".webm",
        "audio/flac": ".flac",
    }

    bucket_ext = os.path.splitext(bucket_path)[1].lower()

    valid_audio_exts = {
        ".aac",
        ".mp3",
        ".wav",
        ".m4a",
        ".ogg",
        ".webm",
        ".flac",
    }

    if bucket_ext in valid_audio_exts:
        ext = bucket_ext
        source = "bucket filename"
    else:
        ext = mime_to_ext.get(content_type, ".wav")
        source = "HTTP Content-Type"

    logger.info("Audio Content-Type: %s", content_type)
    logger.info("Audio bytes: %s", len(audio_response.content))
    logger.info("Bucket extension: %s", bucket_ext or "(none)")
    logger.info("Detected extension: %s (%s)", ext, source)

    return ext


def download_audio(audio_url: str, bucket_path: str, timeout: int = 60) -> str:
    """
    Download audio from URL to a temp file.
    Returns absolute path to the downloaded file (caller must delete).
    """
    audio_response = requests.get(audio_url, timeout=timeout)

    if audio_response.status_code != 200:
        raise ValueError(f"Audio download failed: {audio_response.status_code}")

    ext = detect_audio_extension(audio_response, bucket_path)

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_audio:
        tmp_audio.write(audio_response.content)
        raw_audio_path = tmp_audio.name

    return raw_audio_path
