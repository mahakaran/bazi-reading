"""
Focused tests for the two NEW backend features:
  (a) PATCH /api/birth-profiles/{profile_id}      — edit a saved person
  (b) DELETE /api/birth-profiles/{profile_id}     — delete (regression: still works, cascades readings)
  (c) POST  /api/readings/compatibility           — premium-only compatibility reading

All previously-tested endpoints (auth, profile create/list, single reading, Stripe) are
not retested here per the main agent's request.

Public base URL is used per system prompt.
"""

import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = "https://destiny-chart-7.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "bazi_iching_app"

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _signup(suffix: str):
    email = f"TEST_{suffix}_{uuid.uuid4().hex[:8]}@bazi.app"
    r = requests.post(
        f"{BASE_URL}/auth/signup",
        json={"email": email, "password": "test123", "name": f"TEST_{suffix}"},
        timeout=30,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    body = r.json()
    return email, body["token"], body["user"]["id"]


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_profile(token, name="Alice"):
    body = {
        "name": name,
        "birth_year": 1990,
        "birth_month": 5,
        "birth_day": 15,
        "birth_hour": 14,
        "birth_minute": 30,
        "birthplace": "Singapore",
        "gender": "female",
    }
    r = requests.post(f"{BASE_URL}/birth-profiles", json=body, headers=_auth(token), timeout=30)
    return r


def _set_premium(email: str, value: bool = True):
    db.users.update_one({"email": email.lower()}, {"$set": {"is_premium": value}})


def _cleanup(email: str):
    user = db.users.find_one({"email": email.lower()})
    if not user:
        return
    uid = user["user_id"]
    db.readings.delete_many({"user_id": uid})
    db.birth_profiles.delete_many({"user_id": uid})
    db.users.delete_one({"user_id": uid})


# ==================================================================
# PATCH /api/birth-profiles/{profile_id}
# ==================================================================
class TestPatchBirthProfile:
    @classmethod
    def setup_class(cls):
        cls.email_a, cls.token_a, cls.uid_a = _signup("patch_a")
        cls.email_b, cls.token_b, cls.uid_b = _signup("patch_b")
        # premium so user_a can have multiple profiles if needed
        _set_premium(cls.email_a, True)
        r = _make_profile(cls.token_a, "Alice")
        assert r.status_code == 200, r.text
        cls.profile_id = r.json()["profile_id"]

    @classmethod
    def teardown_class(cls):
        _cleanup(cls.email_a)
        _cleanup(cls.email_b)

    def test_patch_updates_partial_fields(self):
        r = requests.patch(
            f"{BASE_URL}/birth-profiles/{self.profile_id}",
            json={"name": "Alice Renamed", "birthplace": "Tokyo"},
            headers=_auth(self.token_a),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["profile_id"] == self.profile_id
        assert doc["name"] == "Alice Renamed"
        assert doc["birthplace"] == "Tokyo"
        # untouched field preserved
        assert doc["birth_year"] == 1990

        # GET verification (list endpoint, since no GET-single profile endpoint exists)
        list_r = requests.get(f"{BASE_URL}/birth-profiles", headers=_auth(self.token_a), timeout=30)
        assert list_r.status_code == 200
        found = next((p for p in list_r.json() if p["profile_id"] == self.profile_id), None)
        assert found is not None
        assert found["name"] == "Alice Renamed"
        assert found["birthplace"] == "Tokyo"

    def test_patch_empty_body_returns_400(self):
        r = requests.patch(
            f"{BASE_URL}/birth-profiles/{self.profile_id}",
            json={},
            headers=_auth(self.token_a),
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_patch_non_owner_returns_404(self):
        # user B tries to patch user A's profile
        r = requests.patch(
            f"{BASE_URL}/birth-profiles/{self.profile_id}",
            json={"name": "Hacked"},
            headers=_auth(self.token_b),
            timeout=30,
        )
        assert r.status_code == 404, f"expected 404 (owner-isolation), got {r.status_code} {r.text}"

    def test_patch_unknown_profile_returns_404(self):
        r = requests.patch(
            f"{BASE_URL}/birth-profiles/bp_doesnotexist",
            json={"name": "Nope"},
            headers=_auth(self.token_a),
            timeout=30,
        )
        assert r.status_code == 404


# ==================================================================
# DELETE /api/birth-profiles/{profile_id}  (regression + cascade)
# ==================================================================
class TestDeleteBirthProfile:
    @classmethod
    def setup_class(cls):
        cls.email, cls.token, cls.uid = _signup("delete")
        _set_premium(cls.email, True)
        r = _make_profile(cls.token, "DeleteMe")
        assert r.status_code == 200, r.text
        cls.profile_id = r.json()["profile_id"]
        # Insert a synthetic reading tied to this profile to verify cascade
        cls.reading_id = f"rd_{uuid.uuid4().hex[:12]}"
        db.readings.insert_one({
            "reading_id": cls.reading_id,
            "user_id": cls.uid,
            "birth_profile_id": cls.profile_id,
            "reading_type": "bazi_iching",
            "generated_text": "TEST seed",
            "created_at": __import__("datetime").datetime.utcnow(),
        })

    @classmethod
    def teardown_class(cls):
        _cleanup(cls.email)

    def test_delete_profile_and_cascade_readings(self):
        # confirm reading exists pre-delete
        pre = db.readings.count_documents({"birth_profile_id": self.profile_id})
        assert pre >= 1, "test seed reading missing"

        r = requests.delete(
            f"{BASE_URL}/birth-profiles/{self.profile_id}",
            headers=_auth(self.token),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Profile gone — list shouldn't include it
        list_r = requests.get(f"{BASE_URL}/birth-profiles", headers=_auth(self.token), timeout=30)
        assert all(p["profile_id"] != self.profile_id for p in list_r.json())

        # Cascade: readings tied to this profile_id removed
        post = db.readings.count_documents({"birth_profile_id": self.profile_id})
        assert post == 0, f"cascade failed: {post} readings remain"

    def test_delete_unknown_returns_404(self):
        r = requests.delete(
            f"{BASE_URL}/birth-profiles/bp_nonexistent",
            headers=_auth(self.token),
            timeout=30,
        )
        assert r.status_code == 404


# ==================================================================
# POST /api/readings/compatibility
# ==================================================================
class TestCompatibility:
    @classmethod
    def setup_class(cls):
        # Free user (no premium) — for 402 test
        cls.free_email, cls.free_token, cls.free_uid = _signup("compat_free")
        # Need 2 profiles; free can only have 1, so seed second one via mongo directly
        r = _make_profile(cls.free_token, "Free Alice")
        assert r.status_code == 200
        cls.free_pid_a = r.json()["profile_id"]
        cls.free_pid_b = f"bp_{uuid.uuid4().hex[:12]}"
        db.birth_profiles.insert_one({
            "profile_id": cls.free_pid_b, "user_id": cls.free_uid,
            "name": "Free Bob", "birth_year": 1992, "birth_month": 7, "birth_day": 8,
            "birth_hour": 9, "birth_minute": 15, "birthplace": "Tokyo", "gender": "male",
            "created_at": __import__("datetime").datetime.utcnow(),
        })

        # Premium user — for happy path / 400 / 404 tests
        cls.prem_email, cls.prem_token, cls.prem_uid = _signup("compat_prem")
        _set_premium(cls.prem_email, True)
        ra = _make_profile(cls.prem_token, "Prem Alice")
        assert ra.status_code == 200
        cls.prem_pid_a = ra.json()["profile_id"]
        rb = requests.post(
            f"{BASE_URL}/birth-profiles",
            json={
                "name": "Prem Bob", "birth_year": 1988, "birth_month": 3, "birth_day": 22,
                "birth_hour": 6, "birth_minute": 45, "birthplace": "Hong Kong", "gender": "male",
            },
            headers=_auth(cls.prem_token), timeout=30,
        )
        assert rb.status_code == 200, rb.text
        cls.prem_pid_b = rb.json()["profile_id"]

    @classmethod
    def teardown_class(cls):
        _cleanup(cls.free_email)
        _cleanup(cls.prem_email)

    def test_free_user_gets_402(self):
        r = requests.post(
            f"{BASE_URL}/readings/compatibility",
            json={"profile_id_a": self.free_pid_a, "profile_id_b": self.free_pid_b},
            headers=_auth(self.free_token), timeout=30,
        )
        assert r.status_code == 402, f"expected 402, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        assert "Premium" in detail and "Compatibility" in detail, f"unexpected detail: {detail}"

    def test_same_profile_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/readings/compatibility",
            json={"profile_id_a": self.prem_pid_a, "profile_id_b": self.prem_pid_a},
            headers=_auth(self.prem_token), timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_unknown_profile_returns_404(self):
        r = requests.post(
            f"{BASE_URL}/readings/compatibility",
            json={"profile_id_a": self.prem_pid_a, "profile_id_b": "bp_doesnotexist"},
            headers=_auth(self.prem_token), timeout=30,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_premium_happy_path_or_503(self):
        # NOTE: per instructions, accept 503 as graceful degradation if LLM is flaky.
        # LLM has 2 retries × 25s each → up to ~52s on backend.
        r = requests.post(
            f"{BASE_URL}/readings/compatibility",
            json={"profile_id_a": self.prem_pid_a, "profile_id_b": self.prem_pid_b},
            headers=_auth(self.prem_token), timeout=90,
        )
        assert r.status_code in (200, 503), f"unexpected {r.status_code}: {r.text[:300]}"

        if r.status_code == 503:
            pytest.skip("LLM upstream unavailable (graceful 503) — acceptable per spec")

        data = r.json()
        assert data["reading_type"] == "compatibility"
        text = data["generated_text"]
        for header in [
            "## Elemental Harmony",
            "## Communication Style",
            "## Strengths of the Relationship",
            "## Disclaimer",
        ]:
            assert header in text, f"missing required markdown header: {header}"

        cp = data["compatibility_profiles"]
        assert isinstance(cp, list) and len(cp) == 2
        for snap in cp:
            assert "name" in snap and snap["name"]
            assert "birth_year" in snap
            assert "birth_month" in snap
            assert "birth_day" in snap

        # GET /api/readings should include this compatibility reading
        lr = requests.get(f"{BASE_URL}/readings", headers=_auth(self.prem_token), timeout=30)
        assert lr.status_code == 200
        ids = [r2["reading_id"] for r2 in lr.json()]
        assert data["reading_id"] in ids, "new compatibility reading missing from /readings list"
        # Ensure it appears with the right type
        from_list = next(r2 for r2 in lr.json() if r2["reading_id"] == data["reading_id"])
        assert from_list["reading_type"] == "compatibility"
