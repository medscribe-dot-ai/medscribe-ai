"""Unit tests for POST /ai-receptionist/book-appointment (no live DB writes)."""
import datetime
import inspect
import sys
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

# Avoid importing the SOAP/audio pipeline just to test booking helpers.
sys.modules.setdefault("ai_pipeline", MagicMock())

import models
import schemas
from main import (
    _reraise_as_ai_booking_error,
    book_ai_receptionist_appointment,
    create_appointment,
)


FUTURE_UTC = datetime.datetime(2030, 6, 10, 5, 0, 0, tzinfo=datetime.timezone.utc)
FULL_WEEK_SCHEDULE = {
    day: "09:00 AM - 05:00 PM"
    for day in ("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
}


def _db(patient=True, doctor=True):
    session = MagicMock()
    patient_row = MagicMock() if patient else None
    doctor_row = MagicMock() if doctor else None

    def query(model):
        q = MagicMock()
        if model is models.Patient:
            q.filter.return_value.first.return_value = patient_row
        elif model is models.Doctor:
            q.filter.return_value.first.return_value = doctor_row
        else:
            q.filter.return_value.first.return_value = None
            q.filter.return_value.all.return_value = []
        return q

    session.query.side_effect = query
    return session


def _payload(**overrides):
    data = {
        "patient_id": 1,
        "doctor_id": 12,
        "scheduled_time": FUTURE_UTC,
        "status": "scheduled",
    }
    data.update(overrides)
    return schemas.AiReceptionistBookRequest(**data)


class AiReceptionistBookingTests(unittest.TestCase):
    def test_create_appointment_logic_still_present(self):
        source = inspect.getsource(create_appointment)
        self.assertIn("_validate_against_doctor_schedule", source)
        self.assertIn("_generate_queue_token", source)
        self.assertIn("assigned_doctor_id", source)
        self.assertIn("already booked", source)
        self.assertIn("with_for_update", source)

    def test_patient_not_found(self):
        with patch("main.create_appointment") as mock_create:
            with self.assertRaises(HTTPException) as ctx:
                book_ai_receptionist_appointment(_payload(), _db(patient=False, doctor=True))
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(ctx.exception.detail["code"], "patient_not_found")
        mock_create.assert_not_called()

    def test_doctor_not_found(self):
        with patch("main.create_appointment") as mock_create:
            with self.assertRaises(HTTPException) as ctx:
                book_ai_receptionist_appointment(_payload(), _db(patient=True, doctor=False))
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(ctx.exception.detail["code"], "doctor_not_found")
        mock_create.assert_not_called()

    def test_rejects_unavailable_doctor(self):
        with patch("main.create_appointment") as mock_create, patch(
            "main._load_doctor_schedule", return_value={}
        ):
            with self.assertRaises(HTTPException) as ctx:
                book_ai_receptionist_appointment(_payload(), _db())
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.detail["code"], "doctor_unavailable")
        mock_create.assert_not_called()

    def test_rejects_already_booked_slot(self):
        # 05:00 UTC = 10:00 AM Asia/Karachi → 600 minutes from midnight
        with patch("main.create_appointment") as mock_create, patch(
            "main._load_doctor_schedule", return_value=FULL_WEEK_SCHEDULE
        ), patch("main._booked_slot_minutes_for_doctor_date", return_value={600}):
            with self.assertRaises(HTTPException) as ctx:
                book_ai_receptionist_appointment(_payload(), _db())
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.detail["code"], "slot_already_booked")
        mock_create.assert_not_called()

    def test_rejects_misaligned_datetime(self):
        odd_time = datetime.datetime(2030, 6, 10, 5, 7, 0, tzinfo=datetime.timezone.utc)
        with patch("main.create_appointment") as mock_create, patch(
            "main._load_doctor_schedule", return_value=FULL_WEEK_SCHEDULE
        ), patch("main._booked_slot_minutes_for_doctor_date", return_value=set()):
            with self.assertRaises(HTTPException) as ctx:
                book_ai_receptionist_appointment(_payload(scheduled_time=odd_time), _db())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "invalid_datetime")
        mock_create.assert_not_called()

    def test_books_valid_free_slot_via_existing_create_appointment(self):
        fake_created = {
            "appointment_id": 55,
            "patient_id": 1,
            "patient_name": "Test Patient",
            "patient_code": "P-2030-001",
            "doctor_id": 12,
            "doctor_name": "Dr Example",
            "scheduled_time": FUTURE_UTC.replace(tzinfo=None),
            "status": "scheduled",
            "queue_token": None,
            "department": "General",
            "doctor_specialization": "General",
        }
        with patch("main.create_appointment", return_value=fake_created) as mock_create, patch(
            "main._load_doctor_schedule", return_value=FULL_WEEK_SCHEDULE
        ), patch("main._booked_slot_minutes_for_doctor_date", return_value=set()):
            result = book_ai_receptionist_appointment(_payload(), _db())

        mock_create.assert_called_once()
        args, _kwargs = mock_create.call_args
        booked_payload = args[0]
        self.assertIsInstance(booked_payload, schemas.AppointmentCreate)
        self.assertEqual(booked_payload.patient_id, 1)
        self.assertEqual(booked_payload.doctor_id, 12)
        self.assertEqual(booked_payload.status, "scheduled")
        self.assertEqual(result["appointment_id"], 55)
        self.assertEqual(result["patient_name"], "Test Patient")
        self.assertEqual(result["doctor_name"], "Dr Example")
        self.assertEqual(result["date"], "2030-06-10")
        self.assertEqual(result["time"], "10:00 AM")
        self.assertEqual(result["scheduled_time"], "2030-06-10T05:00:00.000Z")
        self.assertIsNone(result["queue_token"])

    def test_maps_existing_booking_conflict_error(self):
        exc = HTTPException(
            status_code=409,
            detail="This time slot is already booked for this doctor. Please choose another available slot.",
        )
        with self.assertRaises(HTTPException) as ctx:
            _reraise_as_ai_booking_error(exc)
        self.assertEqual(ctx.exception.detail["code"], "slot_already_booked")
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
