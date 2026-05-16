"""BaZi & I Ching backend API tests."""
import uuid
import time
import pytest

BASE = "https://destiny-chart-7.preview.emergentagent.com/api"

# Shared state between tests
STATE = {}


# --- Health ---
def test_root_health(api):
    r = api.get(f"{BASE}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


# --- Auth: signup ---
def test_signup_creates_user_and_returns_token(api):
    email = f"TEST_signup_{uuid.uuid4().hex[:8]}@bazi.app"
    r = api.post(f"{BASE}/auth/signup", json={"email": email, "password": "test123", "name": "Test Signup"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert "user" in data
    assert data["user"]["email"] == email.lower()
    assert data["user"]["is_premium"] is False
    STATE["fresh_email"] = email
    STATE["fresh_token"] = data["token"]
    STATE["fresh_user_id"] = data["user"]["id"]


def test_signup_duplicate_email_400(api):
    email = STATE.get("fresh_email")
    assert email
    r = api.post(f"{BASE}/auth/signup", json={"email": email, "password": "test123"})
    assert r.status_code == 400


# --- Auth: login ---
def test_login_with_seed_test_user(api):
    r = api.post(f"{BASE}/auth/login", json={"email": "test@bazi.app", "password": "test123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    STATE["test_token"] = data["token"]
    STATE["test_user"] = data["user"]


def test_login_stripe_user(api):
    r = api.post(f"{BASE}/auth/login", json={"email": "stripe@bazi.app", "password": "test123"})
    assert r.status_code == 200, r.text
    STATE["stripe_token"] = r.json()["token"]
    STATE["stripe_user"] = r.json()["user"]


def test_login_invalid_password(api):
    r = api.post(f"{BASE}/auth/login", json={"email": "test@bazi.app", "password": "wrongpass"})
    assert r.status_code == 401


# --- Auth: me ---
def test_me_with_jwt(api):
    token = STATE["fresh_token"]
    r = api.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == STATE["fresh_email"].lower()


def test_me_invalid_token_rejected(api):
    r = api.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer not-a-valid-token-123"})
    assert r.status_code == 401


def test_me_missing_token(api):
    r = api.get(f"{BASE}/auth/me")
    assert r.status_code == 401


# --- Birth Profiles ---
def test_create_birth_profile_for_fresh_user(api):
    token = STATE["fresh_token"]
    payload = {
        "name": "TEST Person",
        "birth_year": 1990,
        "birth_month": 6,
        "birth_day": 15,
        "birth_hour": 10,
        "birth_minute": 30,
        "birthplace": "San Francisco, CA",
        "gender": "F",
    }
    r = api.post(f"{BASE}/birth-profiles", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["profile_id"].startswith("bp_")
    assert data["name"] == "TEST Person"
    assert "_id" not in data
    STATE["fresh_profile_id"] = data["profile_id"]


def test_free_user_blocked_from_second_profile(api):
    # The seed user test@bazi.app already has 1 profile
    token = STATE["test_token"]
    payload = {
        "name": "TEST Second",
        "birth_year": 1985,
        "birth_month": 3,
        "birth_day": 10,
        "birth_hour": 14,
        "birth_minute": 0,
        "birthplace": "NYC",
    }
    r = api.post(f"{BASE}/birth-profiles", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 402, r.text


def test_list_birth_profiles(api):
    token = STATE["fresh_token"]
    r = api.get(f"{BASE}/birth-profiles", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    profiles = r.json()
    assert isinstance(profiles, list) and len(profiles) >= 1
    assert any(p["profile_id"] == STATE["fresh_profile_id"] for p in profiles)


# --- Readings ---
def test_generate_reading_for_fresh_user(api):
    token = STATE["fresh_token"]
    pid = STATE["fresh_profile_id"]
    r = api.post(f"{BASE}/readings/generate/{pid}", headers={"Authorization": f"Bearer {token}"}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["reading_id"].startswith("rd_")
    text = data["generated_text"]
    # Verify expected section headers
    expected_headers = [
        "## Overall Energetic Profile",
        "## Five Elements",  # could be "## Five Elements Interpretation"
        "## I Ching Guidance",
        "## Disclaimer",
    ]
    for h in expected_headers:
        assert h in text, f"Missing header '{h}' in reading. Got first 500 chars: {text[:500]}"
    STATE["fresh_reading_id"] = data["reading_id"]


def test_free_user_blocked_from_second_reading(api):
    # test@bazi.app already has a reading per seed
    token = STATE["test_token"]
    # Get their profile id
    pr = api.get(f"{BASE}/birth-profiles", headers={"Authorization": f"Bearer {token}"})
    assert pr.status_code == 200
    profiles = pr.json()
    if not profiles:
        pytest.skip("Seed user has no birth profile")
    pid = profiles[0]["profile_id"]
    r = api.post(f"{BASE}/readings/generate/{pid}", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 402, r.text


def test_list_readings(api):
    token = STATE["fresh_token"]
    r = api.get(f"{BASE}/readings", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    readings = r.json()
    assert isinstance(readings, list) and len(readings) >= 1
    assert any(rd["reading_id"] == STATE["fresh_reading_id"] for rd in readings)


def test_get_single_reading(api):
    token = STATE["fresh_token"]
    rid = STATE["fresh_reading_id"]
    r = api.get(f"{BASE}/readings/{rid}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["reading_id"] == rid


def test_get_reading_unauthorized_user_404(api):
    # Try fetching fresh user's reading with stripe user's token
    rid = STATE["fresh_reading_id"]
    token = STATE["stripe_token"]
    r = api.get(f"{BASE}/readings/{rid}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404


# --- Stripe ---
def test_stripe_create_checkout_session(api):
    token = STATE["stripe_token"]
    r = api.post(
        f"{BASE}/stripe/create-checkout-session",
        json={"origin_url": "https://destiny-chart-7.preview.emergentagent.com"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data and data["url"].startswith("http")
    assert "session_id" in data
    STATE["stripe_session_id"] = data["session_id"]


def test_stripe_poll_session(api):
    token = STATE["stripe_token"]
    sid = STATE["stripe_session_id"]
    r = api.get(f"{BASE}/stripe/session/{sid}", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "payment_status" in data
    # For fresh sessions, unpaid/open is expected
    assert data["payment_status"] in ("unpaid", "paid", "no_payment_required")


# --- Logout ---
def test_logout(api):
    token = STATE["fresh_token"]
    r = api.post(f"{BASE}/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # JWT still valid since logout only removes session_token records;
    # this is current backend behavior - documented in report.


# --- Cleanup ---
def test_zzz_cleanup_fresh_user(api):
    """Best-effort cleanup of test data."""
    token = STATE.get("fresh_token")
    if not token:
        return
    # Delete profile (cascades to readings)
    pid = STATE.get("fresh_profile_id")
    if pid:
        api.delete(f"{BASE}/birth-profiles/{pid}", headers={"Authorization": f"Bearer {token}"})
