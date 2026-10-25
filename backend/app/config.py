"""Runtime configuration. Fails closed: anything not explicitly APP_ENV=dev is treated as production."""
import os
import secrets
from pathlib import Path

try:  # optional (HABIT_NO_DOTENV=1 skips it, used by tests), makes `cp .env.example .env` work without extra uvicorn flags
    from dotenv import load_dotenv
    if not os.getenv("HABIT_NO_DOTENV"):
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:  # pragma: no cover
    pass

APP_ENV = os.getenv("APP_ENV", "prod").strip().lower()
IS_DEV = APP_ENV == "dev"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    if IS_DEV:
        DATABASE_URL = f"sqlite:///{Path(__file__).resolve().parents[1] / 'habit.db'}"
    else:
        raise RuntimeError("DATABASE_URL must be set when APP_ENV is not 'dev'.")
if not IS_DEV and DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("Production deployments must use PostgreSQL, not SQLite.")

JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if IS_DEV and not JWT_SECRET:
    JWT_SECRET = "dev-only-secret-never-use-in-production-0123456789"
if not IS_DEV and (len(JWT_SECRET) < 32 or JWT_SECRET.lower().startswith("change-me")):
    raise RuntimeError("JWT_SECRET must be set to a random string of 32+ characters when APP_ENV is not 'dev'.")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
if not IS_DEV and (not CORS_ORIGINS or "*" in CORS_ORIGINS):
    raise RuntimeError("CORS_ORIGINS must contain explicit production origins.")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not IS_DEV and (not GEMINI_API_KEY or GEMINI_API_KEY.startswith("#")):
    raise RuntimeError("GEMINI_API_KEY must be configured in production.")

# Hardening limits that are not part of the shared game contract
OTP_MAX_ATTEMPTS = 5              # wrong guesses before the code is burned
OTP_REQUESTS_PER_IP_PER_HOUR = 30  # stops one device from spamming SMS to many numbers
MAX_BODY_BYTES = 6 * 1024 * 1024   # whole request; photos are capped lower in rules
PHASH_MAX_DISTANCE = 4             # near-duplicate photo threshold (0-64 bits)
