import calendar as cal
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from ..errors import ApiError
from ..rules import RULES
from ..schemas import (CalendarDay, CalendarResponse, GamesResponse, LeaderboardEntry,
                       LeaderboardResponse, User)
from ..security import current_user
from ..service import ist_date, lifetime_points, week_start
from ..store import store

router = APIRouter(tags=["progress"])


@router.get("/games", response_model=GamesResponse)
def games(user: User = Depends(current_user)):
    lp = lifetime_points(user.id)
    return {"lifetime_points": lp,
            "games": [{**g, "unlocked": lp >= g["required_points"]} for g in RULES["games"]]}


@router.get("/history/calendar", response_model=CalendarResponse)
def calendar(month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), user: User = Depends(current_user)):
    y, m = int(month[:4]), int(month[5:])
    counts: dict[date, int] = {}
    for (uid, _hid, d), _rec in store.checkins.items():
        if uid == user.id and d.year == y and d.month == m:
            counts[d] = counts.get(d, 0) + 1
    reached = store.target_days.get(user.id, set())
    days = [CalendarDay(date=d, completed_count=n, target_reached=d in reached)
            for d, n in sorted(counts.items())]
    return CalendarResponse(month=month, days=days)


def _display_name(name: str | None) -> str:
    parts = (name or "").split() or ["Student"]
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


@router.get("/leaderboard/weekly", response_model=LeaderboardResponse)
def weekly(limit: int = Query(RULES["leaderboard"]["default_limit"], ge=1, le=RULES["leaderboard"]["max_limit"]),
           user: User = Depends(current_user)):
    ws = week_start(ist_date())
    totals: dict[str, int] = {}
    for e in store.ledger:
        if e["ist_date"] >= ws:
            totals[e["user_id"]] = totals.get(e["user_id"], 0) + e["points"]
    ranked = sorted(((uid, p) for uid, p in totals.items()
                     if p > 0 and store.users[uid].leaderboard_opt_in), key=lambda t: (-t[1], t[0]))
    entries, rank, prev = [], 0, None
    for i, (uid, p) in enumerate(ranked):
        if p != prev:                       # equal points share a rank (1, 1, 3), not an arbitrary order
            rank, prev = i + 1, p
        entries.append(LeaderboardEntry(rank=rank, display_name=_display_name(store.users[uid].name),
                                        weekly_points=p, is_me=uid == user.id))
    me = next((e for e in entries if e.is_me), None)
    return LeaderboardResponse(week_start=ws, week_end=ws + timedelta(days=6),
                               opted_in=user.leaderboard_opt_in, entries=entries[:limit], me=me)
