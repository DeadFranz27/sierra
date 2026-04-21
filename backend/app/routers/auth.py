from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from slowapi.util import get_remote_address

from app.schemas.auth import LoginRequest, SessionResponse
from app.security.auth import verify_password, create_session, delete_session
from app.security.deps import get_current_user
from app.security.rate_limit import limiter
from app.config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_DEMO_USERNAME = "demo"
COOKIE_NAME = "sierra_session"
COOKIE_MAX_AGE = 86400 * 7  # 7 days


@router.post("/login", response_model=SessionResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response):
    # Manually parse body to keep slowapi's request-first signature compatible.
    try:
        raw = await request.json()
        body = LoginRequest(**raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request body")

    demo_hash: Optional[str] = settings.demo_password_hash
    valid = (
        demo_hash is not None
        and body.username == _DEMO_USERNAME
        and verify_password(body.password, demo_hash)
    )
    if not valid:
        log.warning("Failed login attempt for username=%s from %s", body.username, get_remote_address(request))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_session(body.username)
    # secure=True in production; tests run over http://testserver so we allow override.
    import os as _os
    secure_cookie = _os.environ.get("SIERRA_ENV", "development").lower() != "test"
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    log.info("Login successful for username=%s", body.username)
    return SessionResponse(username=body.username, mock_mode=settings.mock_mode)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, request: Request, _: str = Depends(get_current_user)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        delete_session(token)
    response.delete_cookie(key=COOKIE_NAME, path="/")


@router.get("/me", response_model=SessionResponse)
async def me(username: str = Depends(get_current_user)):
    return SessionResponse(username=username, mock_mode=settings.mock_mode)
