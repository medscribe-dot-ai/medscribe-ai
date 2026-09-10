from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Legacy patient columns (idempotent)
    conn.execute(text("""
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_code VARCHAR(50) UNIQUE;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS department VARCHAR(255);
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'waiting';
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor_id INTEGER;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS registered_by INTEGER;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    """))

    # Resolve existing double-bookings so the unique index can be created.
    # Keep the earliest appointment_id; cancel the rest (frees the slot for rebooking).
    cancelled = conn.execute(text("""
        WITH ranked AS (
            SELECT appointment_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY doctor_id, date_trunc('minute', scheduled_time)
                       ORDER BY appointment_id
                   ) AS rn
            FROM appointments
            WHERE scheduled_time IS NOT NULL
              AND status IS DISTINCT FROM 'cancelled'
        )
        UPDATE appointments a
        SET status = 'cancelled'
        FROM ranked r
        WHERE a.appointment_id = r.appointment_id
          AND r.rn > 1
        RETURNING a.appointment_id
    """)).fetchall()
    if cancelled:
        print(f"Cancelled {len(cancelled)} duplicate active slot(s): {[r[0] for r in cancelled]}")

    # Prevent concurrent double-booking of the same doctor + minute slot.
    # Cancelled rows are excluded so a freed slot can be rebooked.
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_doctor_slot_active
        ON appointments (doctor_id, (date_trunc('minute', scheduled_time)))
        WHERE scheduled_time IS NOT NULL
          AND status IS DISTINCT FROM 'cancelled';
    """))

    # SOAP clinical summary for next-visit / receptionist (additive, nullable)
    conn.execute(text("""
        ALTER TABLE soap_reports
        ADD COLUMN IF NOT EXISTS clinical_summary TEXT;
    """))

    conn.commit()
    print(
        "Migration complete: patients columns + active appointment slot unique index "
        "+ soap_reports.clinical_summary."
    )
