"""Focused retest for two backend fixes:
FIX 1: POST /api/readings/generate/{profile_id} - retry-with-backoff + 75s timeout; on total fail -> HTTP 503
FIX 2: GET /api/stripe/session/{session_id} - tolerant of upstream 404; returns 200 {payment_status:'unpaid', status:'open'}
"""
import uuid
import pytest

BASE = "https://destiny-chart-7.preview.emergentagent.com/api"

STATE = {}


# ---------- helpers ----------
def _signup_fresh(api):
    email = f"TEST_retest_{uuid.uuid4().hex[:8]}@bazi.app"
    r = api.post(f"{BASE}/auth/signup", json={"email": email, "password": "test123", "name": "Retest"})
    assert r.status_code == 200, r.text
    return r.json()["token"], email


# ---------- FIX 1: Reading generation ----------
def test_fix1_reading_generation_succeeds_or_503(api):
    """Create fresh user + profile, generate reading. Accept 200 (with all '## ' headers) or 503 (graceful)."""
    token, email = _signup_fresh(api)
    STATE["fix1_token"] = token
    STATE["fix1_email"] = email

    # create birth profile
    profile_payload = {
        "name": "TEST RetestPerson",
        "birth_year": 1992,
        "birth_month": 7,
        "birth_day": 4,
        "birth_hour": 9,
        "birth_minute": 15,
        "birthplace": "Seattle, WA",
        "gender": "M",
    }
    pr = api.post(f"{BASE}/birth-profiles", json=profile_payload,
                  headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert pr.status_code == 200, pr.text
    pid = pr.json()["profile_id"]
    STATE["fix1_pid"] = pid

    # Generate reading - allow up to ~3*75s + buffer (the route does retry-with-backoff)
    r = api.post(f"{BASE}/readings/generate/{pid}",
                 headers={"Authorization": f"Bearer {token}"}, timeout=260)

    # ACCEPTABLE: 200 success OR 503 graceful upstream-unavailable
    assert r.status_code in (200, 503), (
        f"Expected 200 (success) or 503 (graceful). Got {r.status_code}: {r.text[:500]}"
    )

    if r.status_code == 503:
        # Graceful degradation path - verify message is present and NOT a 500
        body = r.json()
        assert "detail" in body
        detail = body["detail"]
        assert "temporarily unavailable" in detail.lower() or "try again" in detail.lower(), (
            f"503 detail should be user-friendly, got: {detail}"
        )
        pytest.skip(f"LLM upstream unavailable - accepted 503 graceful response: {detail[:120]}")
        return

    # 200 success path - verify markdown structure
    data = r.json()
    assert data["reading_id"].startswith("rd_")
    assert "_id" not in data
    text = data["generated_text"]
    assert isinstance(text, str) and len(text) > 500, f"Reading text too short: {len(text) if isinstance(text,str) else 'N/A'}"

    required_headers = [
        "## Overall Energetic Profile",
        "## Five Elements",         # matches "Five Elements Interpretation"
        "## I Ching Guidance",
        "## Disclaimer",
    ]
    missing = [h for h in required_headers if h not in text]
    assert not missing, f"Missing required markdown headers: {missing}. First 800 chars: {text[:800]}"

    STATE["fix1_reading_id"] = data["reading_id"]


def test_fix1_reading_status_never_500(api):
    """Sanity: re-poll generate without quota left should return 402, never 500."""
    # If previous test succeeded the user has 1 reading; second attempt should be 402 (quota), not 500.
    token = STATE.get("fix1_token")
    pid = STATE.get("fix1_pid")
    rid = STATE.get("fix1_reading_id")
    if not (token and pid and rid):
        pytest.skip("Prior reading not generated (likely upstream 503); cannot test quota gate.")
    r = api.post(f"{BASE}/readings/generate/{pid}",
                 headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 402, f"Expected 402 quota gate. Got {r.status_code}: {r.text[:300]}"


# ---------- FIX 2: Stripe poll tolerant of 404 ----------
def test_fix2_stripe_login_and_create_session(api):
    r = api.post(f"{BASE}/auth/login", json={"email": "stripe@bazi.app", "password": "test123"})
    assert r.status_code == 200, r.text
    STATE["stripe_token"] = r.json()["token"]

    r = api.post(
        f"{BASE}/stripe/create-checkout-session",
        json={"origin_url": "https://destiny-chart-7.preview.emergentagent.com"},
        headers={"Authorization": f"Bearer {STATE['stripe_token']}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_id" in data and isinstance(data["session_id"], str) and len(data["session_id"]) > 5
    assert "url" in data and data["url"].startswith("http")
    STATE["stripe_sid"] = data["session_id"]


def test_fix2_stripe_poll_returns_200_even_when_proxy_404s(api):
    """Immediately poll the just-created session. Must be 200 (NOT 400)."""
    token = STATE.get("stripe_token")
    sid = STATE.get("stripe_sid")
    assert token and sid, "Pre-req: session creation must succeed"

    r = api.get(f"{BASE}/stripe/session/{sid}",
                headers={"Authorization": f"Bearer {token}"}, timeout=30)

    # The key assertion: must be 200, not 400 (the prior bug)
    assert r.status_code == 200, (
        f"FIX 2 REGRESSION: expected 200 even when proxy 404s, got {r.status_code}: {r.text[:400]}"
    )
    data = r.json()
    assert "payment_status" in data, f"Missing payment_status in body: {data}"
    assert "status" in data, f"Missing status in body: {data}"
    # For fresh session that proxy might 404 on, expect unpaid/open
    assert data["payment_status"] in ("unpaid", "paid", "no_payment_required"), (
        f"Unexpected payment_status: {data['payment_status']}"
    )
    assert data["status"] in ("open", "complete", "expired"), (
        f"Unexpected status: {data['status']}"
    )


def test_fix2_stripe_poll_unknown_session_owned_by_other_user_returns_404(api):
    """Sanity: random session_id not in DB should be 404 (auth/ownership check), not 200."""
    token = STATE.get("stripe_token")
    assert token
    bogus_sid = f"cs_test_{uuid.uuid4().hex}"
    r = api.get(f"{BASE}/stripe/session/{bogus_sid}",
                headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 404, f"Expected 404 for unknown session, got {r.status_code}"


# ---------- Cleanup ----------
def test_zzz_cleanup(api):
    token = STATE.get("fix1_token")
    pid = STATE.get("fix1_pid")
    if token and pid:
        api.delete(f"{BASE}/birth-profiles/{pid}", headers={"Authorization": f"Bearer {token}"})
