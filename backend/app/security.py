from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import JWT_SECRET as SECRET
from .errors import ApiError
from .rules import RULES
from .schemas import User
from .store import store

_bearer = HTTPBearer(auto_error=False)


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=RULES["auth"]["token_ttl_seconds"])
    return jwt.encode({"sub": user_id, "iat": now, "exp": exp}, SECRET, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    if creds is None:
        raise ApiError(401, "UNAUTHENTICATED", "Please log in.")
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise ApiError(401, "UNAUTHENTICATED", "Please log in again.")
    user = store.users.get(str(payload.get("sub", "")))
    if user is None:
        raise ApiError(401, "UNAUTHENTICATED", "Please log in again.")
    return user
