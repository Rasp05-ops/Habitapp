import hmac
import hashlib
import secrets
import random
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Request

from ..config import IS_DEV, OTP_MAX_ATTEMPTS, OTP_REQUESTS_PER_IP_PER_HOUR
from ..errors import ApiError
from ..rules import RULES
from ..schemas import (AuthResult, OtpRequest, OtpRequestResult, OtpVerify, PasswordLogin, User, UserUpdate, Register)
from ..security import create_token, current_user
from ..service import local_date, settle_day
from ..store import store

router = APIRouter(tags=["auth"])
A = RULES["auth"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _recent(stamps: list[datetime]) -> list[datetime]:
    cutoff = _now() - timedelta(hours=1)
    return [t for t in stamps if t > cutoff]


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return f"{salt.hex()}${digest.hex()}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 240_000).hex()
        return hmac.compare_digest(expected, digest_hex)
    except (ValueError, TypeError):
        return False


@router.post("/auth/login", response_model=AuthResult)
def login(body: PasswordLogin):
    with store.auth_lock:
        uid = store.username_index.get(body.username.lower())
        if uid is None:
            raise ApiError(401, "INVALID_CREDENTIALS", "Username or password is incorrect.")
        user = store.users[uid]
        encoded = store.password_hashes.get(uid)
        if encoded is None or not _password_matches(body.password, encoded):
            raise ApiError(401, "INVALID_CREDENTIALS", "Username or password is incorrect.")
    return AuthResult(access_token=create_token(uid), expires_in_seconds=A["token_ttl_seconds"], is_new_user=False, user=user)


@router.post("/auth/register", response_model=AuthResult, status_code=201)
def register(body: Register):
    with store.auth_lock:
        if body.username.lower() in store.username_index:
            raise ApiError(409, "USERNAME_TAKEN", "That username is already registered.")
        uid = secrets.token_hex(16)
        user = User(id=uid, username=body.username, phone="", daily_target=RULES["habits"]["default_daily_target"])
        store.users[uid], store.username_index[body.username.lower()] = user, uid
        store.habits[uid] = []
        store.password_hashes[uid] = _password_hash(body.password)
        store.persist(uid)
    return AuthResult(access_token=create_token(uid), expires_in_seconds=A["token_ttl_seconds"], is_new_user=True, user=user)


@router.post("/auth/otp/request", response_model=OtpRequestResult)
def request_otp(body: OtpRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    with store.auth_lock:
        by_ip, by_phone = _recent(store.ip_requests.get(ip, [])), _recent(store.otp_requests.get(body.phone, []))
        if len(by_ip) >= OTP_REQUESTS_PER_IP_PER_HOUR or len(by_phone) >= A["otp_requests_per_hour"]:
            raise ApiError(429, "TOO_MANY_REQUESTS", "Too many tries. Please wait a while.")
        store.ip_requests[ip], store.otp_requests[body.phone] = by_ip + [_now()], by_phone + [_now()]
        code = "123456" if IS_DEV else f"{random.SystemRandom().randrange(10**6):06d}"
        store.otps[body.phone] = {"code": code, "attempts": 0,
                                  "expires": _now() + timedelta(seconds=A["otp_ttl_seconds"])}
    if not IS_DEV:
        pass  # TODO: send `code` by SMS through your provider
    return OtpRequestResult(sent=True, expires_in_seconds=A["otp_ttl_seconds"])


@router.post("/auth/otp/verify", response_model=AuthResult)
def verify_otp(body: OtpVerify):
    with store.auth_lock:            # also prevents two simultaneous verifies creating two accounts
        rec = store.otps.get(body.phone)
        if rec is None:
            raise ApiError(400, "INVALID_OTP", "That code is not correct.")
        if rec["expires"] < _now():
            del store.otps[body.phone]
            raise ApiError(400, "OTP_EXPIRED", "That code has expired. Ask for a new one.")
        if not hmac.compare_digest(rec["code"], body.otp):
            rec["attempts"] += 1
            if rec["attempts"] >= OTP_MAX_ATTEMPTS:      # burn the code: brute force needs a fresh (rate-limited) one
                del store.otps[body.phone]
                raise ApiError(429, "TOO_MANY_REQUESTS", "Too many wrong codes. Ask for a new one.")
            raise ApiError(400, "INVALID_OTP", "That code is not correct.")
        del store.otps[body.phone]
        uid = store.phone_index.get(body.phone)
        is_new = uid is None
        if is_new:
            uid = uuid.uuid4().hex
            store.users[uid] = User(id=uid, username=body.phone, phone=body.phone, daily_target=RULES["habits"]["default_daily_target"])
            store.phone_index[body.phone] = uid
            store.username_index[body.phone.lower()] = uid
            store.habits[uid] = []
        user = store.users[uid]
        store.persist(uid)
    return AuthResult(access_token=create_token(uid), expires_in_seconds=A["token_ttl_seconds"],
                      is_new_user=is_new, user=user)


@router.get("/me", response_model=User)
def get_me(user: User = Depends(current_user)):
    return user


@router.patch("/me", response_model=User)
def update_me(body: UserUpdate, user: User = Depends(current_user)):
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "timezone" in changes:
        try:
            ZoneInfo(changes["timezone"])
        except (ZoneInfoNotFoundError, ValueError, OSError):
            raise ApiError(422, "VALIDATION_ERROR", "Unknown timezone.")
    with store.user_lock(user.id):
        if changes.get("onboarding_completed") and not (changes.get("name") or user.name):
            raise ApiError(422, "VALIDATION_ERROR", "Finish onboarding with a name.")
        if changes.get("onboarding_completed") and not store.habits.get(user.id):
            raise ApiError(422, "VALIDATION_ERROR", "Finish onboarding with at least one habit.")
        updated = user.model_copy(update=changes)
        store.users[user.id] = updated
        if "daily_target" in changes or "timezone" in changes:   # lowering the target can complete today
            settle_day(updated, local_date(updated))
        store.persist(user.id)
        return updated
