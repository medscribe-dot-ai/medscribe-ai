"""Audio cleaning / enhancement (from Colab clean_audio)."""
from __future__ import annotations

import logging
import os
import subprocess

import numpy as np
import noisereduce as nr
import soundfile as sf

logger = logging.getLogger(__name__)


def clean_audio(input_path, output_path):

    ext = os.path.splitext(input_path)[1].lower()

    logger.info("Input audio: %s", input_path)
    logger.info("Detected extension: %s", ext)

    # ──────────────────────────────────────────────────────────
    # Convert non-WAV formats using FFmpeg
    # ──────────────────────────────────────────────────────────

    if ext != ".wav":

        logger.info("Converting %s to WAV 16kHz Mono...", ext)

        converted_path = os.path.splitext(input_path)[0] + "_converted.wav"

        result = subprocess.run(
            [
                "ffmpeg",
                "-i",
                input_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-y",
                converted_path,
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            logger.error("FFmpeg conversion failed")
            logger.error("%s", result.stderr[-3000:])
            raise RuntimeError(
                "FFmpeg conversion failed:\n" f"{result.stderr[-3000:]}"
            )

        if not os.path.exists(converted_path):
            raise RuntimeError(
                "FFmpeg reported success but converted WAV file was not created."
            )

        input_path = converted_path
        logger.info("Conversion done!")

    # ──────────────────────────────────────────────────────────
    # WAV → standardized 16kHz mono WAV
    # ──────────────────────────────────────────────────────────

    else:

        logger.info("Ensuring correct format...")

        converted_path = os.path.splitext(input_path)[0] + "_16k.wav"

        result = subprocess.run(
            [
                "ffmpeg",
                "-i",
                input_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-y",
                converted_path,
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            logger.error("FFmpeg WAV conversion failed")
            logger.error("%s", result.stderr[-3000:])
            raise RuntimeError(
                "FFmpeg WAV conversion failed:\n" f"{result.stderr[-3000:]}"
            )

        if not os.path.exists(converted_path):
            raise RuntimeError(
                "FFmpeg reported success but standardized WAV file was not created."
            )

        input_path = converted_path
        logger.info("Format verified!")

    # ──────────────────────────────────────────────────────────
    # Load standardized WAV
    # ──────────────────────────────────────────────────────────

    try:
        data, rate = sf.read(input_path)
    except Exception as e:
        raise RuntimeError(f"soundfile could not open converted audio: {e}")

    logger.info(
        "Audio loaded — Duration: %.1fs, Rate: %sHz",
        len(data) / rate,
        rate,
    )

    # ──────────────────────────────────────────────────────────
    # Volume analysis
    # ──────────────────────────────────────────────────────────

    avg_volume = np.mean(np.abs(data))
    logger.info("Original volume: %.4f", avg_volume)

    # ──────────────────────────────────────────────────────────
    # Noise reduction
    # ──────────────────────────────────────────────────────────

    logger.info("Gentle noise removal...")

    noise_sample = data[0 : int(rate * 0.5)]

    cleaned = nr.reduce_noise(
        y=data,
        sr=rate,
        y_noise=noise_sample,
        prop_decrease=0.6,
        stationary=False,
    )

    avg_cleaned = np.mean(np.abs(cleaned))
    logger.info("After cleaning volume: %.4f", avg_cleaned)

    # ──────────────────────────────────────────────────────────
    # Volume boost
    # ──────────────────────────────────────────────────────────

    if avg_cleaned < 0.15:
        logger.info("Volume too low — boosting...")
        boost = 0.25 / (avg_cleaned + 1e-9)
        cleaned = np.clip(cleaned * boost, -1.0, 1.0)
        logger.info("After boost: %.4f", np.mean(np.abs(cleaned)))
    else:
        logger.info("Volume good — no boost needed")

    # ──────────────────────────────────────────────────────────
    # Save cleaned WAV
    # ──────────────────────────────────────────────────────────

    sf.write(output_path, cleaned, rate)
    logger.info("Clean audio saved at: %s", output_path)
