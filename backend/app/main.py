import logging

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import CORS_ORIGINS, IS_DEV, MAX_BODY_BYTES
from .db import check_db
from .errors import ApiError
from .routes import auth, habits, progress, stories
from .rules import RULES

log = logging.getLogger("habit")

# API docs are only exposed in dev; production keeps the surface small.
app = FastAPI(title="Student Habit App API", version=RULES["version"],
              docs_url="/docs" if IS_DEV else None, redoc_url=None, openapi_url="/openapi.json" if IS_DEV else None)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS,
                   allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.middleware("http")
async def _guard(request: Request, call_next):
    """Reject oversized bodies before they are parsed, and add safe default headers."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return _err(413, "IMAGE_TOO_LARGE", "Request body is too large.")
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


@app.exception_handler(ApiError)
async def _api_error(_: Request, exc: ApiError):
    return _err(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body")
    return _err(422, "VALIDATION_ERROR", f"{where}: {first['msg']}")


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, exc: StarletteHTTPException):
    return _err(exc.status_code, "NOT_FOUND" if exc.status_code in (404, 405) else "INTERNAL_ERROR", str(exc.detail))


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error", exc_info=exc)       # details go to logs, never to the client
    return _err(500, "INTERNAL_ERROR", "Something went wrong.")


api = APIRouter(prefix="/api/v1")


@api.get("/health", tags=["meta"])
def health():
    check_db()
    return {"status": "ok"}


for r in (auth.router, habits.router, progress.router, stories.router):
    api.include_router(r)
app.include_router(api)
