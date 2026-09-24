"""Unit tests for GET /ai-receptionist/doctors/search (no live DB writes)."""
import inspect
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import HTTPException

sys.modules.setdefault("ai_pipeline", MagicMock())

from main import (
    _ai_doctor_match_payload,
    _doctor_matches_ai_search,
    _normalize_ai_doctor_search_params,
    _strip_doctor_honorific,
    get_doctor,
    get_doctors,
    search_ai_receptionist_doctors,
    update_doctor,
)


def _doctor(**kwargs):
    user = SimpleNamespace(name=kwargs.pop("name", "Dr Example"))
    defaults = {
        "doctor_id": 12,
        "user_id": 100,
        "specialization": "Dermatology",
        "experience_years": 8,
        "availability_status": "available",
        "user": user,
    }
    defaults.update(kwargs)
    if "name" in kwargs:
        defaults["user"] = SimpleNamespace(name=kwargs["name"])
    return SimpleNamespace(**defaults)


def _db_with(rows):
    query = MagicMock()
    query.join.return_value = query
    query.filter.return_value = query
    query.order_by.return_value = query
    query.all.return_value = rows
    db = MagicMock()
    db.query.return_value = query
    return db


class AiReceptionistDoctorSearchTests(unittest.TestCase):
    def test_existing_doctor_endpoints_untouched(self):
        list_src = inspect.getsource(get_doctors)
        self.assertIn("db.query(models.Doctor).all()", list_src)
        self.assertIn("availability_status=d.availability_status", list_src)
        self.assertNotIn("ai-receptionist", list_src)

        detail_src = inspect.getsource(get_doctor)
        self.assertIn("doctor_schedule_", detail_src)
        self.assertIn("username", detail_src)
        self.assertIn("email", detail_src)

        update_src = inspect.getsource(update_doctor)
        self.assertIn("db.commit()", update_src)

    def test_empty_search_is_rejected(self):
        db = MagicMock()
        with self.assertRaises(HTTPException) as ctx:
            search_ai_receptionist_doctors(None, None, None, db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "invalid_search")
        db.query.assert_not_called()
        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_whitespace_search_is_rejected(self):
        db = MagicMock()
        with self.assertRaises(HTTPException) as ctx:
            search_ai_receptionist_doctors("   ", "  ", " ", db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "invalid_search")
        db.query.assert_not_called()

    def test_unique_name_lookup(self):
        rows = [
            _doctor(doctor_id=12, name="Ahmed Khan", specialization="Dermatology"),
            _doctor(doctor_id=13, name="Sara Malik", specialization="Cardiology"),
        ]
        db = _db_with(rows)
        result = search_ai_receptionist_doctors("Ahmed Khan", None, None, db)
        self.assertFalse(result["ambiguous"])
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["doctor_id"], 12)
        self.assertEqual(result["matches"][0]["doctor_name"], "Ahmed Khan")
        db.add.assert_not_called()
        db.commit.assert_not_called()
        db.delete.assert_not_called()

    def test_partial_and_honorific_name_lookup(self):
        rows = [_doctor(doctor_id=12, name="Ahmed Khan")]
        result = search_ai_receptionist_doctors("Dr Ahmed", None, None, _db_with(rows))
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["doctor_id"], 12)
        self.assertEqual(_strip_doctor_honorific("Dr Ahmed"), "Ahmed")

    def test_specialization_lookup(self):
        rows = [
            _doctor(doctor_id=12, name="Ahmed Khan", specialization="Dermatology"),
            _doctor(doctor_id=13, name="Sara Malik", specialization="Cardiology"),
        ]
        result = search_ai_receptionist_doctors(None, "derma", None, _db_with(rows))
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["specialization"], "Dermatology")

    def test_department_lookup_uses_specialization_column(self):
        rows = [
            _doctor(doctor_id=12, name="Ahmed Khan", specialization="Dermatology"),
            _doctor(doctor_id=13, name="Sara Malik", specialization="Cardiology"),
        ]
        result = search_ai_receptionist_doctors(None, None, "Dermatology", _db_with(rows))
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["department"], "Dermatology")
        self.assertEqual(result["matches"][0]["specialization"], "Dermatology")

    def test_multiple_matches_are_all_returned(self):
        rows = [
            _doctor(doctor_id=12, name="Ahmed Khan", specialization="Dermatology"),
            _doctor(doctor_id=15, name="Ahmed Raza", specialization="Dermatology"),
        ]
        result = search_ai_receptionist_doctors("Ahmed", "Dermatology", None, _db_with(rows))
        self.assertTrue(result["ambiguous"])
        self.assertEqual(len(result["matches"]), 2)
        self.assertEqual({m["doctor_id"] for m in result["matches"]}, {12, 15})

    def test_no_match_returns_empty_non_ambiguous(self):
        rows = [_doctor(doctor_id=13, name="Sara Malik", specialization="Cardiology")]
        result = search_ai_receptionist_doctors("Ahmed", None, None, _db_with(rows))
        self.assertEqual(result["matches"], [])
        self.assertFalse(result["ambiguous"])

    def test_payload_omits_private_user_fields(self):
        payload = _ai_doctor_match_payload(_doctor(name="Ahmed Khan"))
        self.assertEqual(payload["doctor_id"], 12)
        self.assertEqual(payload["doctor_name"], "Ahmed Khan")
        self.assertNotIn("email", payload)
        self.assertNotIn("username", payload)
        self.assertNotIn("phone", payload)
        self.assertNotIn("user_id", payload)
        self.assertNotIn("password_hash", payload)

    def test_helper_does_not_prefer_first_row(self):
        first = _doctor(doctor_id=1, name="Ahmed Khan")
        second = _doctor(doctor_id=2, name="Ahmed Raza")
        matched = [
            d for d in (first, second)
            if _doctor_matches_ai_search(d, "Ahmed", None, None)
        ]
        self.assertEqual(len(matched), 2)

    def test_normalize_params_strips_whitespace(self):
        name, spec, dept = _normalize_ai_doctor_search_params(" Ahmed ", " Dermatology ", " Skin ")
        self.assertEqual(name, "Ahmed")
        self.assertEqual(spec, "Dermatology")
        self.assertEqual(dept, "Skin")


if __name__ == "__main__":
    unittest.main()
