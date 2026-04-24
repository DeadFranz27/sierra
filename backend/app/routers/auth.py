from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import User
from app.schemas.auth import (
    AuthStatusResponse,
    LoginRequest,
    SessionResponse,
    SetupRequest,
)
from app.security.auth import (
    create_session,
    delete_session,
    hash_password,
    verify_password,
)
from app.security.deps import get_current_user
from app.security.rate_limit import limiter
from app.config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "sierra_session"
COOKIE_MAX_AGE = 86400 * 7  # 7 days


def _set_session_cookie(response: Response, username: str) -> None:
    token = create_session(username)
    secure_cookie = os.environ.get("SIERRA_ENV", "development").lower() != "test"
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    has_users = result.scalar_one_or_none() is not None
    return AuthStatusResponse(has_users=has_users, demo_mode=settings.demo_mode)


@router.post("/setup", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def setup(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        raw = await request.json()
        body = SetupRequest(**raw)
    except HTTPException:
        raise
    except Exception as e:
        # Surface pydantic validation errors so the frontend can show them inline.
        detail = str(e) if e.args else "Invalid request body"
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

    result = await db.execute(select(User).where(User.is_demo.is_(False)).limit(1))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already complete")

    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        is_demo=False,
    )
    db.add(user)
    await db.commit()

    _set_session_cookie(response, user.username)
    log.info("Setup successful — first user created: username=%s", user.username)
    return SessionResponse(username=user.username, mock_mode=settings.mock_mode)


@router.post("/login", response_model=SessionResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        raw = await request.json()
        body = LoginRequest(**raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request body")

    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        log.warning("Failed login attempt for username=%s from %s", body.username, get_remote_address(request))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _set_session_cookie(response, user.username)
    log.info("Login successful for username=%s", user.username)
    return SessionResponse(username=user.username, mock_mode=settings.mock_mode)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, request: Request, _: str = Depends(get_current_user)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        delete_session(token)
    response.delete_cookie(key=COOKIE_NAME, path="/")


@router.get("/me", response_model=SessionResponse)
async def me(username: str = Depends(get_current_user)):
    return SessionResponse(username=username, mock_mode=settings.mock_mode)
