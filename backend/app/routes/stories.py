from fastapi import APIRouter, Depends

from ..errors import ApiError
from ..rules import STORIES, STORY_QUIZ_POINTS
from ..schemas import DailyStory, StoryQuizSubmission, User
from ..security import current_user
from ..service import ist_date
from ..store import store

router = APIRouter(tags=["stories"])


def _story(story_id: str) -> dict:
    story = next((item for item in STORIES if item["id"] == story_id), None)
    if story is None:
        raise ApiError(404, "NOT_FOUND", "Story not found.")
    return story


def _today_story() -> dict:
    return STORIES[ist_date().toordinal() % len(STORIES)]


def _today(user: User, story: dict) -> DailyStory:
    progress = store.story_progress.get((user.id, story["id"], ist_date()), {})
    return DailyStory(
        id=story["id"], title=story["title"], summary=story["summary"],
        video_id=story["video_id"], questions=story["questions"],
        watched=bool(progress.get("watched")), quiz_completed=bool(progress.get("quiz_completed")),
        quiz_points=STORY_QUIZ_POINTS,
    )


@router.get("/stories/today", response_model=DailyStory)
def today_story(user: User = Depends(current_user)):
    return _today(user, _today_story())


@router.post("/stories/{story_id}/watched", response_model=DailyStory)
def watched(story_id: str, user: User = Depends(current_user)):
    story = _story(story_id)
    if story["id"] != _today_story()["id"]:
        raise ApiError(409, "STORY_NOT_CURRENT", "That story is not available today.")
    key = (user.id, story_id, ist_date())
    progress = store.story_progress.setdefault(key, {})
    progress["watched"] = True
    store.persist(user.id)
    return _today(user, story)


@router.post("/stories/{story_id}/quiz", response_model=DailyStory)
def quiz(story_id: str, body: StoryQuizSubmission, user: User = Depends(current_user)):
    story = _story(story_id)
    if story["id"] != _today_story()["id"]:
        raise ApiError(409, "STORY_NOT_CURRENT", "That story is not available today.")
    key = (user.id, story_id, ist_date())
    progress = store.story_progress.setdefault(key, {})
    if not progress.get("watched"):
        raise ApiError(409, "STORY_NOT_WATCHED", "Watch the story before taking the quiz.")
    if progress.get("quiz_completed"):
        return _today(user, story)
    if any(body.answers.get(question_id) != answer for question_id, answer in story["answers"].items()):
        raise ApiError(422, "QUIZ_INCORRECT", "Answer every question correctly to earn points.")
    progress["quiz_completed"] = True
    store.ledger.append({"user_id": user.id, "points": STORY_QUIZ_POINTS, "kind": "story_quiz",
                         "local_date": ist_date(), "ist_date": ist_date()})
    store.persist(user.id)
    return _today(user, story)
