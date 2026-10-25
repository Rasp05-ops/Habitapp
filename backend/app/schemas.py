"""Pydantic models. Keep in sync with contract/openapi.yaml (tests check the paths)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .rules import RULES

PHONE = r"^\+[1-9]\d{9,14}$"
Language = Literal["en", "hi"]
Verification = Literal["tap", "photo"]


class LocalizedName(BaseModel):
    en: str
    hi: str


class OtpRequest(BaseModel):
    phone: str = Field(pattern=PHONE)


class OtpRequestResult(BaseModel):
    sent: bool
    expires_in_seconds: int


class OtpVerify(BaseModel):
    phone: str = Field(pattern=PHONE)
    otp: str = Field(pattern=r"^\d{6}$")


class PasswordLogin(BaseModel):
    username: str = Field(pattern=r"^[A-Za-z0-9_]{3,30}$")
    password: str = Field(min_length=8, max_length=128)


class Register(PasswordLogin):
    """Credentials are accepted only at explicit registration, never as an implicit login signup."""
    pass


class User(BaseModel):
    id: str
    username: str
    phone: str
    name: Optional[str] = None
    language: Language = "en"
    timezone: str = "Asia/Kolkata"
    daily_target: int
    leaderboard_opt_in: bool = False
    onboarding_completed: bool = False


class AuthResult(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in_seconds: int
    is_new_user: bool
    user: User


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    language: Optional[Language] = None
    timezone: Optional[str] = None
    daily_target: Optional[int] = Field(
        None, ge=RULES["habits"]["min_daily_target"], le=RULES["habits"]["max_daily_target"]
    )
    leaderboard_opt_in: Optional[bool] = None
    onboarding_completed: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = " ".join(v.split())                      # trims and collapses whitespace
        if not v or any(ord(ch) < 32 for ch in v):
            raise ValueError("name must not be blank")
        return v


class CatalogHabit(BaseModel):
    id: str
    name: LocalizedName
    icon: str
    verification: Verification
    points: int


class CatalogResponse(BaseModel):
    habits: list[CatalogHabit]


class Habit(BaseModel):
    id: str
    catalog_id: str
    name: LocalizedName
    icon: str
    verification: Verification
    created_at: datetime


class HabitList(BaseModel):
    habits: list[Habit]


class HabitCreate(BaseModel):
    catalog_id: str


class Streak(BaseModel):
    current: int
    best: int
    freezes_left: int
    completed_today: bool
    last_completed_date: Optional[date] = None


class PointsSummary(BaseModel):
    lifetime: int
    weekly: int
    today: int


class NextUnlock(BaseModel):
    game_id: str
    name: LocalizedName
    required_points: int
    lifetime_points: int


class Progress(BaseModel):
    completed_count: int
    daily_target: int
    target_reached: bool
    streak: Streak
    points: PointsSummary
    next_unlock: Optional[NextUnlock] = None


class TodayHabit(BaseModel):
    habit: Habit
    status: Literal["pending", "done", "done_unverified"]
    retries_left: Optional[int] = None
    points_earned: int


class Today(BaseModel):
    date: date
    habits: list[TodayHabit]
    progress: Progress


class Bonus(BaseModel):
    type: Literal["daily_target", "streak_milestone"]
    points: int
    streak_days: Optional[int] = None


class CheckInResult(BaseModel):
    status: Literal["done", "done_unverified", "retry", "already_done"]
    message_key: str
    points_awarded: int
    retries_left: Optional[int] = None
    bonuses: list[Bonus]
    progress: Progress


class StoryQuestion(BaseModel):
    id: str
    prompt: str
    options: list[str]


class DailyStory(BaseModel):
    id: str
    title: str
    summary: str
    video_id: str
    questions: list[StoryQuestion]
    watched: bool
    quiz_completed: bool
    quiz_points: int


class StoryQuizSubmission(BaseModel):
    answers: dict[str, int]


class CalendarDay(BaseModel):
    date: date
    completed_count: int
    target_reached: bool


class CalendarResponse(BaseModel):
    month: str
    days: list[CalendarDay]


class Game(BaseModel):
    id: str
    name: LocalizedName
    icon: str
    required_points: int
    unlocked: bool


class GamesResponse(BaseModel):
    lifetime_points: int
    games: list[Game]


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    weekly_points: int
    is_me: bool


class LeaderboardResponse(BaseModel):
    week_start: date
    week_end: date
    opted_in: bool
    entries: list[LeaderboardEntry]
    me: Optional[LeaderboardEntry] = None
