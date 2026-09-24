"""Unit tests for GET /ai-receptionist/patients/search (no live DB writes)."""
import inspect
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

sys.modules.setdefault("ai_pipeline", MagicMock())

from main import (
    _ai_patient_match_payload,
    _patient_matches_ai_search,
    _normalize_ai_search_params,
    register_patient,
    search_ai_receptionist_patients,
    search_patients,
)


def _patient(**kwargs):
    user = SimpleNamespace(name=kwargs.pop("doctor_name", None))
    assigned = SimpleNamespace(user=user) if user.name else None
    defaults = {
        "patient_id": 1,
        "patient_code": "P-2026-001",
        "name": "Ali Khan",
        "phone": "0300-1111111",
        "age": 34,
        "department": "General",
        "assigned_doctor_id": 12 if assigned else None,
        "assigned_doctor": assigned,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _db_with(rows):
    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.all.return_value = rows
    db = MagicMock()
    db.query.return_value = query
    return db


class AiReceptionistPatientSearchTests(unittest.TestCase):
    def test_existing_list_and_register_logic_untouched(self):
        list_src = inspect.getsource(search_patients)
        self.assertIn("models.Patient.name.ilike", list_src)
        self.assertIn("models.Patient.patient_code.ilike", list_src)
        self.assertIn("models.Patient.phone.ilike", list_src)
        self.assertIn("latest_clinical_summary", list_src)

        register_src = inspect.getsource(register_patient)
        self.assertIn("P-{year}-", register_src)
        self.assertIn("duplicate_phone", register_src)
        self.assertIn("allow_duplicate_phone", register_src)

    def test_empty_search_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            search_ai_receptionist_patients(None, None, None, MagicMock())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "invalid_search")

    def test_whitespace_search_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            search_ai_receptionist_patients("   ", "  ", " -- ", MagicMock())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "invalid_search")

    def test_exact_patient_code_returns_one_patient(self):
        rows = [
            _patient(patient_id=1, patient_code="P-2026-001", name="Ali Khan"),
            _patient(patient_id=2, patient_code="P-2026-002", name="Sara Ahmed"),
        ]
        result = search_ai_receptionist_patients("P-2026-001", None, None, _db_with(rows))
        self.assertFalse(result["ambiguous"])
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["patient_id"], 1)
        self.assertEqual(result["matches"][0]["patient_code"], "P-2026-001")
        self.assertEqual(result["matches"][0]["patient_name"], "Ali Khan")

    def test_unique_phone_returns_one_patient(self):
        rows = [
            _patient(patient_id=1, phone="0300-1111111", name="Ali Khan"),
            _patient(patient_id=2, phone="0300-2222222", name="Sara Ahmed"),
        ]
        result = search_ai_receptionist_patients(None, None, "03001111111", _db_with(rows))
        self.assertFalse(result["ambiguous"])
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["patient_id"], 1)

    def test_multiple_name_matches_are_all_returned(self):
        rows = [
            _patient(patient_id=1, patient_code="P-2026-001", name="Ali Khan", age=34, phone="0300-1111111"),
            _patient(patient_id=2, patient_code="P-2026-009", name="Ali Khan", age=62, phone="0300-9999999"),
        ]
        result = search_ai_receptionist_patients(None, "Ali Khan", None, _db_with(rows))
        self.assertTrue(result["ambiguous"])
        self.assertEqual(len(result["matches"]), 2)
        ids = {m["patient_id"] for m in result["matches"]}
        self.assertEqual(ids, {1, 2})
        self.assertNotEqual(result["matches"][0]["patient_code"], result["matches"][1]["patient_code"])

    def test_no_match_returns_empty_non_ambiguous(self):
        rows = [_patient(patient_id=1, patient_code="P-2026-001", name="Sara Ahmed")]
        result = search_ai_receptionist_patients("P-2026-999", None, None, _db_with(rows))
        self.assertEqual(result["matches"], [])
        self.assertFalse(result["ambiguous"])

    def test_name_match_helper_does_not_prefer_first_row(self):
        first = _patient(patient_id=1, name="Ali Khan")
        second = _patient(patient_id=2, name="Ali Khan")
        matched = [
            p for p in (first, second)
            if _patient_matches_ai_search(p, None, "Ali Khan", None)
        ]
        self.assertEqual(len(matched), 2)

    def test_payload_includes_assigned_doctor_when_present(self):
        payload = _ai_patient_match_payload(
            _patient(doctor_name="Dr Example", assigned_doctor_id=12)
        )
        self.assertEqual(payload["assigned_doctor_id"], 12)
        self.assertEqual(payload["assigned_doctor_name"], "Dr Example")
        self.assertEqual(payload["department"], "General")
        self.assertNotIn("temp_password", payload)
        self.assertNotIn("latest_clinical_summary", payload)

    def test_normalize_params_strips_and_normalizes_phone(self):
        code, name, phone = _normalize_ai_search_params(" P-2026-001 ", " Ali ", "0300-111 1111")
        self.assertEqual(code, "P-2026-001")
        self.assertEqual(name, "Ali")
        self.assertEqual(phone, "03001111111")


if __name__ == "__main__":
    unittest.main()
