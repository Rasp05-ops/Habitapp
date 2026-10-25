from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app
from app.store import reset_store

BASE = "/api/v1"
client = TestClient(app)


def jpg(seed: bytes = b"g", n: int = 2000) -> bytes:
    """A fake photo that passes the magic-byte check. >=1000 bytes passes the dev mock verifier."""
    return b"\xff\xd8\xff\xe0" + (seed * n)[:n]


@pytest.fixture(autouse=True)
def _fresh():
    reset_store()


def login(phone="+919876543210"):
    assert client.post(f"{BASE}/auth/otp/request", json={"phone": phone}).status_code == 200
    r = client.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "otp": "123456"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()


def test_every_contract_path_is_implemented_and_nothing_extra():
    spec = yaml.safe_load((Path(__file__).resolve().parents[2] / "contract" / "openapi.yaml").read_text())
    verbs = {"get", "post", "patch", "put", "delete"}
    expected = {(m.upper(), p) for p, item in spec["paths"].items() for m in item if m in verbs}
    actual = {(m.upper(), p.removeprefix(BASE)) for p, item in app.openapi()["paths"].items() for m in item}
    assert expected == actual


def test_auth_required_and_error_shape():
    r = client.get(f"{BASE}/today")
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHENTICATED"
    assert client.post(f"{BASE}/auth/otp/request", json={"phone": "123"}).json()["error"]["code"] == "VALIDATION_ERROR"
    bad = client.post(f"{BASE}/auth/otp/verify", json={"phone": "+919876543210", "otp": "000000"})
    assert bad.json()["error"]["code"] == "INVALID_OTP"


def test_signup_then_login_same_account():
    _, first = login()
    assert first["is_new_user"] is True and first["user"]["name"] is None
    _, second = login()
    assert second["is_new_user"] is False and second["user"]["id"] == first["user"]["id"]


def test_password_registration_rejects_duplicate_username():
    first = client.post(f"{BASE}/auth/register", json={"username": "habit_user", "password": "password123"})
    assert first.status_code == 201
    duplicate = client.post(f"{BASE}/auth/register", json={"username": "HABIT_USER", "password": "password456"})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "USERNAME_TAKEN"


def test_full_day_flow():
    h, _ = login()
    assert client.patch(f"{BASE}/me", headers=h, json={"name": "Riya Sharma", "language": "hi", "leaderboard_opt_in": True}).json()["name"] == "Riya Sharma"
    ids = {}
    for cid in ["water", "sleep", "read", "study"]:
        r = client.post(f"{BASE}/habits", headers=h, json={"catalog_id": cid})
        assert r.status_code == 201
        ids[cid] = r.json()["id"]
    assert client.post(f"{BASE}/habits", headers=h, json={"catalog_id": "water"}).json()["error"]["code"] == "HABIT_ALREADY_ADDED"

    # tap habits
    r = client.post(f"{BASE}/habits/{ids['water']}/check-ins", headers=h, json={"method": "tap"}).json()
    assert r["status"] == "done" and r["points_awarded"] == 10
    assert client.post(f"{BASE}/habits/{ids['water']}/check-ins", headers=h, json={"method": "tap"}).json()["status"] == "already_done"
    client.post(f"{BASE}/habits/{ids['sleep']}/check-ins", headers=h, json={"method": "tap"})

    # wrong method
    r = client.post(f"{BASE}/habits/{ids['read']}/check-ins", headers=h, json={"method": "tap"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "WRONG_VERIFICATION_METHOD"

    # good photo completes the 3rd habit -> daily target reached
    r = client.post(f"{BASE}/habits/{ids['read']}/check-ins", headers=h, files={"photo": ("a.jpg", jpg(), "image/jpeg")}).json()
    assert r["status"] == "done"
    assert [b["type"] for b in r["bonuses"]] == ["daily_target"]
    assert r["progress"]["streak"]["current"] == 1 and r["progress"]["target_reached"] is True

    # bad photos: retry, retry, then done_unverified at reduced points
    out = [client.post(f"{BASE}/habits/{ids['study']}/check-ins", headers=h, files={"photo": ("a.jpg", jpg(c, 10), "image/jpeg")}).json() for c in (b"a", b"b", b"c")]
    assert [o["status"] for o in out] == ["retry", "retry", "done_unverified"]
    assert out[0]["retries_left"] == 2 and out[2]["points_awarded"] == 5
    # reused photo is flagged
    assert client.post(f"{BASE}/habits/{ids['read']}/check-ins", headers=h, files={"photo": ("a.jpg", jpg(), "image/jpeg")}).json()["status"] == "already_done"

    t = client.get(f"{BASE}/today", headers=h).json()
    assert t["progress"]["completed_count"] == 4 and t["progress"]["points"]["lifetime"] == 10 + 10 + 10 + 20 + 5

    lb = client.get(f"{BASE}/leaderboard/weekly", headers=h).json()
    assert lb["me"]["rank"] == 1 and lb["me"]["display_name"] == "Riya S."
    g = client.get(f"{BASE}/games", headers=h).json()
    assert g["games"][0]["unlocked"] is False and t["progress"]["next_unlock"]["game_id"] == "memory_match"
    cal = client.get(f"{BASE}/history/calendar?month={t['date'][:7]}", headers=h).json()
    assert cal["days"][0]["target_reached"] is True


def test_streak_freeze_and_reset(monkeypatch):
    from datetime import datetime, timedelta, timezone
    from app import service

    h, _ = login()
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 1})
    hid = client.post(f"{BASE}/habits", headers=h, json={"catalog_id": "water"}).json()["id"]
    base = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
    clock = {"now": base}
    monkeypatch.setattr(service, "now_utc", lambda: clock["now"])
    client.post(f"{BASE}/habits/{hid}/check-ins", headers=h, json={"method": "tap"})
    assert client.get(f"{BASE}/today", headers=h).json()["progress"]["streak"]["current"] == 1
    clock["now"] = base + timedelta(days=2)       # missed 1 day -> a freeze is used, streak kept
    s = client.get(f"{BASE}/today", headers=h).json()["progress"]["streak"]
    assert s["current"] == 1 and s["freezes_left"] == 1
    clock["now"] = base + timedelta(days=6)       # missed 3 more days, only 1 freeze left -> reset
    s = client.get(f"{BASE}/today", headers=h).json()["progress"]["streak"]
    assert s["current"] == 0 and s["best"] == 1


# ======================= regression tests for the holes found in the review =======================
def _habit(h, cid):
    return client.post(f"{BASE}/habits", headers=h, json={"catalog_id": cid}).json()["id"]


def _tap(h, hid):
    return client.post(f"{BASE}/habits/{hid}/check-ins", headers=h, json={"method": "tap"}).json()


def test_delete_and_readd_habit_cannot_farm_points():
    h, _ = login()
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 1})
    for _ in range(4):
        hid = _habit(h, "water")
        _tap(h, hid)
        client.delete(f"{BASE}/habits/{hid}", headers=h)
    assert client.get(f"{BASE}/today", headers=h).json()["progress"]["points"]["lifetime"] == 10 + 20


def test_blank_name_is_rejected_and_names_are_cleaned():
    h, _ = login()
    r = client.patch(f"{BASE}/me", headers=h, json={"name": "   "})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.patch(f"{BASE}/me", headers=h, json={"name": "  Riya   Sharma ", "leaderboard_opt_in": True}).json()["name"] == "Riya Sharma"
    assert client.get(f"{BASE}/leaderboard/weekly", headers=h).status_code == 200


def test_target_cannot_exceed_habits_owned():
    h, _ = login()
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 5})
    for cid in ("water", "sleep"):
        _tap(h, _habit(h, cid))
    p = client.get(f"{BASE}/today", headers=h).json()["progress"]
    assert p["daily_target"] == 2 and p["target_reached"] is True and p["streak"]["current"] == 1


def test_lowering_target_after_finishing_still_counts_the_day():
    h, _ = login()
    ids = [_habit(h, c) for c in ("water", "sleep", "read")]
    _tap(h, ids[0]); _tap(h, ids[1])
    assert client.get(f"{BASE}/today", headers=h).json()["progress"]["streak"]["current"] == 0
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 2})
    p = client.get(f"{BASE}/today", headers=h).json()["progress"]
    assert p["streak"]["current"] == 1 and p["points"]["lifetime"] == 10 + 10 + 20
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 2})            # idempotent: no double bonus
    assert client.get(f"{BASE}/today", headers=h).json()["progress"]["points"]["lifetime"] == 40


def test_otp_is_burned_after_five_wrong_guesses():
    phone = "+919833333333"
    client.post(f"{BASE}/auth/otp/request", json={"phone": phone})
    codes = [client.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "otp": f"{i:06d}"}).json()["error"]["code"] for i in range(1, 6)]
    assert codes[:4] == ["INVALID_OTP"] * 4 and codes[4] == "TOO_MANY_REQUESTS"
    # even the right code no longer works until a new one is requested
    assert client.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "otp": "123456"}).status_code == 400


def test_otp_request_limit_per_phone():
    phone = "+919855555555"
    codes = [client.post(f"{BASE}/auth/otp/request", json={"phone": phone}).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]


def test_photo_type_is_checked_by_content_not_header():
    h, _ = login()
    hid = _habit(h, "study")
    exe = client.post(f"{BASE}/habits/{hid}/check-ins", headers=h, files={"photo": ("x.jpg", b"MZ" + b"\x00" * 3000, "image/jpeg")})
    assert exe.status_code == 415 and exe.json()["error"]["code"] == "UNSUPPORTED_IMAGE_TYPE"
    big = client.post(f"{BASE}/habits/{hid}/check-ins", headers=h, files={"photo": ("x.jpg", jpg(n=5 * 1024 * 1024 + 10), "image/jpeg")})
    assert big.status_code == 413 and big.json()["error"]["code"] == "IMAGE_TOO_LARGE"


def test_near_duplicate_photo_is_caught_even_when_bytes_differ():
    import io
    from PIL import Image, ImageDraw
    def pic(extra_quality):
        im = Image.new("RGB", (320, 240), "white"); d = ImageDraw.Draw(im)
        d.rectangle((20, 30, 200, 120), fill="black"); d.ellipse((150, 100, 300, 220), fill="gray")
        b = io.BytesIO(); im.save(b, "JPEG", quality=extra_quality); return b.getvalue()
    a, b = pic(90), pic(70)
    assert a != b
    h, _ = login()
    ids = (_habit(h, "study"), _habit(h, "read"))
    assert client.post(f"{BASE}/habits/{ids[0]}/check-ins", headers=h, files={"photo": ("a.jpg", a, "image/jpeg")}).json()["status"] == "done"
    r = client.post(f"{BASE}/habits/{ids[1]}/check-ins", headers=h, files={"photo": ("b.jpg", b, "image/jpeg")}).json()
    assert r["status"] == "retry" and r["message_key"] == "checkin.retry.reused"


def test_leaderboard_ties_share_a_rank():
    for i, phone in enumerate(["+919800000001", "+919800000002", "+919800000003"]):
        h, _ = login(phone)
        client.patch(f"{BASE}/me", headers=h, json={"name": f"User {chr(65 + i)}", "leaderboard_opt_in": True, "daily_target": 1})
        _tap(h, _habit(h, "water"))
        if i == 2:
            _tap(h, _habit(h, "sleep"))
    lb = client.get(f"{BASE}/leaderboard/weekly", headers=h).json()
    assert [e["rank"] for e in lb["entries"]] == [1, 2, 2]


def test_onboarding_cannot_be_completed_empty():
    h, _ = login()
    assert client.patch(f"{BASE}/me", headers=h, json={"onboarding_completed": True}).status_code == 422
    client.patch(f"{BASE}/me", headers=h, json={"name": "Asha"})
    _habit(h, "water")
    assert client.patch(f"{BASE}/me", headers=h, json={"onboarding_completed": True}).json()["onboarding_completed"] is True


def test_today_never_moves_backwards_when_timezone_changes(monkeypatch):
    from datetime import datetime, timezone
    from app import service
    h, _ = login()
    client.patch(f"{BASE}/me", headers=h, json={"daily_target": 1})
    hid = _habit(h, "water")
    monkeypatch.setattr(service, "now_utc", lambda: datetime(2026, 10, 5, 20, 0, tzinfo=timezone.utc))
    _tap(h, hid)                                                       # Kolkata: Oct 6
    client.patch(f"{BASE}/me", headers=h, json={"timezone": "Pacific/Honolulu"})   # Honolulu would be Oct 5
    t = client.get(f"{BASE}/today", headers=h).json()
    assert t["date"] == "2026-10-06" and t["habits"][0]["status"] == "done"


def test_malformed_requests_never_leak_a_stack_trace():
    h, _ = login()
    r = client.patch(f"{BASE}/me", headers={**h, "Content-Type": "application/json"}, content=b"{bad")
    assert r.status_code == 422 and set(r.json()) == {"error"}
    assert client.get(f"{BASE}/nope").json()["error"]["code"] == "NOT_FOUND"


def test_production_refuses_to_start_with_a_weak_secret():
    import importlib, os, pytest
    from app import config
    old = dict(os.environ)
    try:
        os.environ.update({"HABIT_NO_DOTENV": "1", "APP_ENV": "prod", "JWT_SECRET": "change-me-to-a-long-random-string-32+chars"})
        with pytest.raises(RuntimeError):
            importlib.reload(config)
        os.environ.pop("APP_ENV")        # unset must also mean production, not dev
        with pytest.raises(RuntimeError):
            importlib.reload(config)
    finally:
        os.environ.clear(); os.environ.update(old); importlib.reload(config)
