"""Consultation progress updates via SQLAlchemy (replaces Colab supabase writes)."""
from __future__ import annotations

import datetime
import logging

logger = logging.getLogger(__name__)


async def update_progress(db, record_id, step: str, message: str, percent: int = None):
    """
    Mirror of Colab update_progress field writes.
    Uses SQLAlchemy session instead of supabase.table(...).update.
    """
    try:
        from models import Consultation

        consultation = (
            db.query(Consultation)
            .filter(Consultation.consultation_id == int(record_id))
            .first()
        )
        if not consultation:
            logger.warning("Progress update skipped: consultation %s not found", record_id)
            return

        # Preserve notebook behavior: progress updates set status to processing
        consultation.status = "processing"
        consultation.processing_step = step
        consultation.progress_message = message
        consultation.progress_percent = percent or 0
        consultation.updated_at = datetime.datetime.utcnow()
        db.commit()

        logger.info("[%s] %s (%s%%)", step, message, percent or 0)

    except Exception as e:
        logger.warning("Progress update skipped: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
