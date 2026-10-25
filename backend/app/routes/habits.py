from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool

from ..errors import ApiError
from ..rules import CATALOG, RULES
from ..schemas import (CatalogResponse, CheckInResult, Habit, HabitCreate, HabitList, Today, User)
from ..security import current_user
from ..service import check_in_locked, local_date, settle_day, today_summary
from ..store import store

router = APIRouter(tags=["habits"])


@router.get("/habits/catalog", response_model=CatalogResponse)
def catalog(user: User = Depends(current_user)):
    return {"habits": RULES["habits"]["catalog"]}


@router.get("/habits", response_model=HabitList)
def list_habits(user: User = Depends(current_user)):
    return {"habits": store.habits.get(user.id, [])}


@router.post("/habits", response_model=Habit, status_code=201)
def add_habit(body: HabitCreate, user: User = Depends(current_user)):
    item = CATALOG.get(body.catalog_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "No such habit in the catalog.")
    with store.user_lock(user.id):        # concurrent adds can't slip past the 5-habit limit
        mine = store.habits.setdefault(user.id, [])
        if any(h.catalog_id == body.catalog_id for h in mine):
            raise ApiError(409, "HABIT_ALREADY_ADDED", "You already added this habit.")
        if len(mine) >= RULES["habits"]["max_per_user"]:
            raise ApiError(409, "HABIT_LIMIT_REACHED", "You can have up to 5 habits.")
        habit = Habit(id=uuid.uuid4().hex, catalog_id=item["id"], name=item["name"], icon=item["icon"],
                      verification=item["verification"], created_at=datetime.now(timezone.utc))
        mine.append(habit)
        store.persist(user.id)
        return habit


@router.delete("/habits/{habit_id}", status_code=204)
def remove_habit(habit_id: str, user: User = Depends(current_user)):
    with store.user_lock(user.id):
        mine = store.habits.get(user.id, [])
        if not any(h.id == habit_id for h in mine):
            raise ApiError(404, "HABIT_NOT_FOUND", "Habit not found.")
        store.habits[user.id] = [h for h in mine if h.id != habit_id]
        # Today's check-ins are kept (keyed by catalog id), so re-adding cannot be used to re-earn points.
        settle_day(user, local_date(user))
        store.persist(user.id)
    return Response(status_code=204)


@router.get("/today", response_model=Today)
def today(user: User = Depends(current_user)):
    return today_summary(user)


@router.post("/habits/{habit_id}/check-ins", response_model=CheckInResult)
async def create_check_in(habit_id: str, request: Request, user: User = Depends(current_user)):
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form(max_files=1, max_fields=4)
        up = form.get("photo")
        if up is None or not hasattr(up, "read"):
            raise ApiError(422, "VALIDATION_ERROR", "Field 'photo' is required.")
        data = await up.read(RULES["verification"]["max_image_bytes"] + 1)
        # Gemini can take seconds: run off the event loop so one slow photo doesn't freeze every other user.
        return await run_in_threadpool(check_in_locked, user, habit_id, "photo", (data, up.content_type or ""))
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict) or body.get("method") != "tap":
        raise ApiError(422, "VALIDATION_ERROR", "Send {\"method\": \"tap\"} or a multipart 'photo'.")
    return await run_in_threadpool(check_in_locked, user, habit_id, "tap", None)
