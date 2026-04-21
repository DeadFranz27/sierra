from __future__ import annotations

from typing import Optional

from fastapi import Cookie, HTTPException, status
from app.security.auth import get_session_user


def get_current_user(sierra_session: Optional[str] = Cookie(default=None)) -> str:
    if not sierra_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = get_session_user(sierra_session)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user
