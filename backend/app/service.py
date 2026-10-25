"""All game logic (streaks, points, check-ins). Routes stay thin and call into here."""
from __future__ import annotations

import hashlib
import io
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import gemini_service
from .config import PHASH_MAX_DISTANCE
from .errors import ApiError
from .rules import CATALOG, RULES
from .schemas import (Bonus, CheckInResult, Habit, NextUnlock, PointsSummary,
                      Progress, Streak, Today, TodayHabit, User)
from .store import store

POINTS = RULES["points"]
VER = RULES["verification"]
MAX_ATTEMPTS = VER["max_attempts_per_habit_per_day"]


# ---- time helpers (tests monkeypatch now_utc) -------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def local_date(user: User) -> date:
    """The user's 'today'. Never earlier than the last day they were active, so hopping to a
    timezone that is 'behind' cannot replay a day that was already played."""
    raw = now_utc().astimezone(ZoneInfo(user.timezone)).date()
    return max(raw, store.last_active.get(user.id, raw))


def ist_date() -> date:
    return now_utc().astimezone(ZoneInfo(RULES["leaderboard"]["timezone"])).date()


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday


# ---- points ----------------------------------------------------------------------------
def _award(user: User, points: int, kind: str, today: date) -> None:
    store.ledger.append({"user_id": user.id, "points": points, "kind": kind,
                         "local_date": today, "ist_date": ist_date()})


def lifetime_points(user_id: str) -> int:
    return sum(e["points"] for e in store.ledger if e["user_id"] == user_id)


def build_points(user: User) -> PointsSummary:
    today, ws = local_date(user), week_start(ist_date())
    mine = [e for e in store.ledger if e["user_id"] == user.id]
    return PointsSummary(
        lifetime=sum(e["points"] for e in mine),
        weekly=sum(e["points"] for e in mine if e["ist_date"] >= ws),
        today=sum(e["points"] for e in mine if e["local_date"] == today),
    )


def next_unlock(lifetime: int) -> NextUnlock | None:
    for g in RULES["games"]:
        if g["required_points"] > lifetime:
            return NextUnlock(game_id=g["id"], name=g["name"],
                              required_points=g["required_points"], lifetime_points=lifetime)
    return None


# ---- streak ----------------------------------------------------------------------------
def refresh_streak(user: User) -> dict:
    """Lazily applies month refill + missed days. Safe to call on every request (idempotent)."""
    s, today = store.streak_for(user.id), local_date(user)
    month = today.strftime("%Y-%m")
    if s["freeze_month"] != month:
        s["freezes_left"], s["freeze_month"] = RULES["streak"]["freezes_per_month"], month
    if s["current"] > 0 and s["last_streak_date"]:
        missed = (today - s["last_streak_date"]).days - 1  # today is still open, so not "missed"
        if missed > 0:
            if missed <= s["freezes_left"]:
                s["freezes_left"] -= missed
                s["last_streak_date"] = today - timedelta(days=1)
            else:
                s["current"] = 0
    return s


def build_streak(user: User) -> Streak:
    s = refresh_streak(user)
    return Streak(current=s["current"], best=s["best"], freezes_left=s["freezes_left"],
                  completed_today=local_date(user) in store.target_days.get(user.id, set()),
                  last_completed_date=s["last_streak_date"])


def _register_streak_day(user: User, today: date) -> int:
    s = refresh_streak(user)
    s["current"] += 1
    s["best"] = max(s["best"], s["current"])
    s["last_streak_date"] = today
    return s["current"]


# ---- progress / today ------------------------------------------------------------------
def effective_target(user: User) -> int:
    """The target can never exceed the habits the student actually has (otherwise it is unreachable)."""
    n = len(store.habits.get(user.id, []))
    return max(1, min(user.daily_target, n)) if n else user.daily_target


def _done_count(user: User, today: date) -> int:
    return sum(1 for h in store.habits.get(user.id, [])
               if (user.id, h.catalog_id, today) in store.checkins)


def settle_day(user: User, today: date) -> list[Bonus]:
    """Awards the daily-target bonus + streak day exactly once per day, whatever triggered the change
    (a check-in, a lowered target, a removed habit). Idempotent."""
    reached = store.target_days.setdefault(user.id, set())
    if today in reached or not store.habits.get(user.id) or _done_count(user, today) < effective_target(user):
        return []
    reached.add(today)
    store.last_active[user.id] = max(today, store.last_active.get(user.id, today))
    bonuses = [Bonus(type="daily_target", points=POINTS["daily_target_bonus"])]
    _award(user, POINTS["daily_target_bonus"], "daily_target", today)
    days = _register_streak_day(user, today)
    milestone = POINTS["streak_milestones"].get(str(days))
    if milestone:
        _award(user, milestone, "streak_milestone", today)
        bonuses.append(Bonus(type="streak_milestone", points=milestone, streak_days=days))
    return bonuses


def build_progress(user: User) -> Progress:
    today = local_date(user)
    done, target = _done_count(user, today), effective_target(user)
    points = build_points(user)
    return Progress(completed_count=done, daily_target=target,
                    target_reached=bool(store.habits.get(user.id)) and done >= target,
                    streak=build_streak(user), points=points, next_unlock=next_unlock(points.lifetime))


def today_summary(user: User) -> Today:
    today, items = local_date(user), []
    for h in store.habits.get(user.id, []):
        rec = store.checkins.get((user.id, h.catalog_id, today))
        attempts = store.attempts.get((user.id, h.catalog_id, today), 0)
        items.append(TodayHabit(
            habit=h,
            status=rec["status"] if rec else "pending",
            retries_left=(max(0, MAX_ATTEMPTS - attempts) if h.verification == "photo" and not rec else None),
            points_earned=rec["points"] if rec else 0))
    return Today(date=today, habits=items, progress=build_progress(user))


# ---- photo helpers ---------------------------------------------------------------------
def sniff_image(data: bytes) -> str | None:
    """Trust the bytes, not the client's Content-Type header."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _dhash(data: bytes) -> int | None:
    """64-bit difference hash: survives re-compression/resizing, so re-sending yesterday's photo is caught
    even if the bytes differ. Returns None when the image can't be decoded or carries no information."""
    try:
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = 40_000_000
        im = Image.open(io.BytesIO(data)).convert("L").resize((9, 8))
        px = im.tobytes()
    except Exception:
        return None
    bits = 0
    for r in range(8):
        for c in range(8):
            bits = (bits << 1) | (px[r * 9 + c] > px[r * 9 + c + 1])
    return bits if 8 <= bin(bits).count("1") <= 56 else None   # flat/dark frames all look alike: skip


def _is_reused(user_id: str, digest: str, phash: int | None) -> bool:
    if digest in store.image_hashes.get(user_id, set()):
        return True
    return phash is not None and any(bin(phash ^ p).count("1") <= PHASH_MAX_DISTANCE
                                     for p in store.image_phashes.get(user_id, []))


def _remember_image(user_id: str, digest: str, phash: int | None) -> None:
    store.image_hashes.setdefault(user_id, set()).add(digest)
    if phash is not None:
        hashes = store.image_phashes.setdefault(user_id, [])
        hashes.append(phash)
        del hashes[:-500]


# ---- check-in --------------------------------------------------------------------------
def _result(user, status, key, points=0, retries=None, bonuses=None) -> CheckInResult:
    return CheckInResult(status=status, message_key=key, points_awarded=points,
                         retries_left=retries, bonuses=bonuses or [], progress=build_progress(user))


def check_in_locked(user: User, habit_id: str, method: str, photo: tuple[bytes, str] | None) -> CheckInResult:
    with store.user_lock(user.id):
        return check_in(user, habit_id, method, photo)


def check_in(user: User, habit_id: str, method: str, photo: tuple[bytes, str] | None) -> CheckInResult:
    habit: Habit | None = next((h for h in store.habits.get(user.id, []) if h.id == habit_id), None)
    if habit is None:
        raise ApiError(404, "HABIT_NOT_FOUND", "Habit not found.")
    today = local_date(user)
    key = (user.id, habit.catalog_id, today)
    if key in store.checkins:
        return _result(user, "already_done", "checkin.already_done")

    base = CATALOG[habit.catalog_id]["points"]
    if habit.verification == "tap":
        if method != "tap" or photo is not None:
            raise ApiError(400, "WRONG_VERIFICATION_METHOD", "This habit is done with a tap, not a photo.")
        status, msg, points = "done", "checkin.done", base
    else:
        if photo is None:
            raise ApiError(400, "WRONG_VERIFICATION_METHOD", "This habit needs a photo.")
        data, _declared = photo
        if len(data) > VER["max_image_bytes"]:
            raise ApiError(413, "IMAGE_TOO_LARGE", "Photo is too large.")
        mime = sniff_image(data)
        if mime is None or mime not in VER["allowed_mime_types"]:
            raise ApiError(415, "UNSUPPORTED_IMAGE_TYPE", "Use a JPEG, PNG or WebP photo.")
        digest, phash = hashlib.sha256(data).hexdigest(), _dhash(data)
        if _is_reused(user.id, digest, phash):
            reason = "reused"
        else:
            try:
                verdict = gemini_service.verify(habit.catalog_id, data, mime)
            except gemini_service.VerificationUnavailable:
                raise ApiError(503, "VERIFICATION_UNAVAILABLE", "Photo check is unavailable. Try later.")
            ok = verdict.reason == "ok" and verdict.confidence >= VER["min_confidence"]
            reason = "ok" if ok else (verdict.reason if verdict.reason != "ok" else "unclear")
        _remember_image(user.id, digest, phash)
        if reason == "ok":
            status, msg, points = "done", "checkin.done", base
        else:
            store.attempts[key] = store.attempts.get(key, 0) + 1
            left = max(0, MAX_ATTEMPTS - store.attempts[key])
            if left > 0:
                return _result(user, "retry", f"checkin.retry.{reason}", 0, left)
            status, msg, points = "done_unverified", "checkin.done_unverified", POINTS["unverified_habit"]

    store.checkins[key] = {"status": status, "points": points}
    store.last_active[user.id] = max(today, store.last_active.get(user.id, today))
    _award(user, points, "habit", today)
    bonuses = settle_day(user, today)
    store.persist(user.id)
    return _result(user, status, msg, points, None, bonuses)
