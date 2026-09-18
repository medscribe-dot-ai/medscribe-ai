"""AI pipeline configuration — env-based secrets (no Colab userdata)."""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from groq import Groq

logger = logging.getLogger(__name__)


def get_groq_api_key() -> str:
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Set it in the environment before running the AI pipeline."
        )
    return key


@lru_cache(maxsize=1)
def get_groq_client() -> Groq:
    return Groq(api_key=get_groq_api_key())


def log_stage(stage_name: str, content: str, max_chars: int = 3000) -> None:
    """Replacement for notebook _show_stage — logs instead of Colab display."""
    text = content or ""
    truncated = text if len(text) <= max_chars else text[:max_chars] + "\n... [truncated] ..."
    logger.info("STAGE OUTPUT: %s\n%s", stage_name, truncated)
