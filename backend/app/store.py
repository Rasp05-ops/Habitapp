"""Process-local cache backed by SQLAlchemy.

The cache keeps the existing service API cheap while every write is snapshotted to the
database. A later process loads the same state, including photo replay protection.
"""
from __future__ import annotations
import json
import threading
from datetime import date, datetime
from .db import Base, SessionLocal, UserRow, HabitRow, CheckinRow, LedgerRow, StateRow, init_db
from sqlalchemy import delete, text
from .config import DATABASE_URL
from .rules import RULES
from .schemas import Habit, User

def _json(v):
    return json.dumps(v, default=lambda x: x.isoformat() if isinstance(x, (date, datetime)) else x)

class Store:
    def __init__(self) -> None:
        init_db()
        self.users: dict[str, User] = {}
        self.phone_index: dict[str, str] = {}
        self.username_index: dict[str, str] = {}
        self.password_hashes: dict[str, str] = {}
        self.habits: dict[str, list[Habit]] = {}
        self.checkins: dict[tuple[str, str, date], dict] = {}
        self.ledger: list[dict] = []
        self.streaks: dict[str, dict] = {}
        self.attempts: dict[tuple[str, str, date], int] = {}
        self.image_hashes: dict[str, set[str]] = {}
        self.image_phashes: dict[str, list[int]] = {}
        self.target_days: dict[str, set[date]] = {}
        self.last_active: dict[str, date] = {}
        self.story_progress: dict[tuple[str, str, date], dict] = {}
        self.otps: dict[str, dict] = {}
        self.otp_requests: dict[str, list[datetime]] = {}
        self.ip_requests: dict[str, list[datetime]] = {}
        self._locks: dict[str, threading.Lock] = {}
        self.auth_lock = threading.Lock()
        self._load()

    def _load(self):
        with SessionLocal() as s:
            for r in s.query(UserRow).all():
                u = User.model_validate(json.loads(r.data))
                self.users[u.id] = u
                self.username_index[u.username.lower()] = u.id
                if u.phone: self.phone_index[u.phone] = u.id
                if r.password_hash: self.password_hashes[u.id] = r.password_hash
            for r in s.query(HabitRow).all():
                self.habits.setdefault(r.user_id, []).append(Habit.model_validate(json.loads(r.data)))
            for r in s.query(CheckinRow).all():
                d = r.day
                self.checkins[(r.user_id, r.catalog_id, d)] = json.loads(r.data)
            for r in s.query(LedgerRow).order_by(LedgerRow.id).all():
                x = json.loads(r.data); x["local_date"] = date.fromisoformat(x["local_date"]); x["ist_date"] = date.fromisoformat(x["ist_date"])
                self.ledger.append(x)
            for r in s.query(StateRow).all():
                x = json.loads(r.data)
                self.streaks[r.user_id] = x.get("streak", self._default_streak())
                if self.streaks[r.user_id].get("last_streak_date"):
                    self.streaks[r.user_id]["last_streak_date"] = date.fromisoformat(self.streaks[r.user_id]["last_streak_date"])
                self.attempts.update({(r.user_id, k.split("|")[0], date.fromisoformat(k.split("|")[1])): v for k,v in x.get("attempts", {}).items()})
                self.image_hashes[r.user_id] = set(x.get("image_hashes", []))
                self.image_phashes[r.user_id] = x.get("image_phashes", [])
                self.target_days[r.user_id] = {date.fromisoformat(d) for d in x.get("target_days", [])}
                if x.get("last_active"): self.last_active[r.user_id] = date.fromisoformat(x["last_active"])
                for key, value in x.get("story_progress", {}).items():
                    story_id, day = key.split("|", 1)
                    self.story_progress[(r.user_id, story_id, date.fromisoformat(day))] = value

    def _default_streak(self):
        return {"current": 0, "best": 0, "freezes_left": RULES["streak"]["freezes_per_month"], "freeze_month": None, "last_streak_date": None}

    def persist(self, user_id: str | None = None) -> None:
        """Persist one aggregate without deleting unrelated users."""
        with SessionLocal.begin() as s:
            if user_id is None:
                raise ValueError("persist requires a user_id")
            if not DATABASE_URL.startswith("sqlite"):
                s.execute(text("SELECT pg_advisory_xact_lock(hashtext(:uid))"), {"uid": user_id})
            for model, column in ((UserRow, UserRow.id), (HabitRow, HabitRow.user_id),
                                  (CheckinRow, CheckinRow.user_id), (LedgerRow, LedgerRow.user_id),
                                  (StateRow, StateRow.user_id)):
                s.execute(delete(model).where(column == user_id))
            u = self.users[user_id]
            s.add(UserRow(id=user_id, username=u.username.lower(), phone=u.phone, data=_json(u.model_dump()), password_hash=self.password_hashes.get(user_id)))
            for h in self.habits.get(user_id, []):
                s.add(HabitRow(id=h.id, user_id=user_id, data=_json(h.model_dump())))
            for (owner, cid, d), data in self.checkins.items():
                if owner == user_id:
                    s.add(CheckinRow(id=f"{user_id}|{cid}|{d.isoformat()}", user_id=user_id, catalog_id=cid, day=d, data=_json(data)))
            for e in self.ledger:
                if e["user_id"] == user_id:
                    s.add(LedgerRow(user_id=user_id, data=_json(e)))
            attempts = {f"{cid}|{d.isoformat()}": n for (owner,cid,d),n in self.attempts.items() if owner == user_id}
            stories = {f"{story}|{d.isoformat()}": value for (owner, story, d), value in self.story_progress.items() if owner == user_id}
            s.add(StateRow(user_id=user_id, data=_json({"streak": self.streaks.get(user_id, self._default_streak()),
                "attempts": attempts, "image_hashes": list(self.image_hashes.get(user_id, set())),
                "image_phashes": self.image_phashes.get(user_id, []), "target_days": [d.isoformat() for d in self.target_days.get(user_id, set())],
                "last_active": self.last_active.get(user_id).isoformat() if self.last_active.get(user_id) else None,
                "story_progress": stories})))

    def create_user(self, user: User, password_hash: str) -> None:
        """Create credentials in one database transaction before updating the cache."""
        with SessionLocal.begin() as s:
            s.add(UserRow(
                id=user.id,
                username=user.username.lower(),
                phone=user.phone,
                data=_json(user.model_dump()),
                password_hash=password_hash,
            ))
            s.add(StateRow(user_id=user.id, data=_json({"streak": self._default_streak(),
                "attempts": {}, "image_hashes": [], "image_phashes": [], "target_days": [],
                "last_active": None, "story_progress": {}})))

        self.users[user.id] = user
        self.username_index[user.username.lower()] = user.id
        self.habits[user.id] = []
        self.password_hashes[user.id] = password_hash

    def user_lock(self, user_id: str) -> threading.Lock:
        return self._locks.setdefault(user_id, threading.Lock())
    def streak_for(self, user_id: str) -> dict:
        return self.streaks.setdefault(user_id, self._default_streak())

store = Store()

def reset_store() -> None:
    with SessionLocal.begin() as s:
        s.query(UserRow).delete(); s.query(HabitRow).delete(); s.query(CheckinRow).delete()
        s.query(LedgerRow).delete(); s.query(StateRow).delete()
    # Keep the object identity imported by routes/services while resetting test state.
    store.__init__()
