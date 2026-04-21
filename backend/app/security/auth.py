from __future__ import annotations

import secrets
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from app.config import settings

_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)

# In-memory session store — replaced by DB in M3
_sessions: dict[str, str] = {}  # token → username


def hash_password(plain: str) -> str:
    peppered = plain + settings.argon2_pepper
    return _ph.hash(peppered)


def verify_password(plain: str, hashed: str) -> bool:
    peppered = plain + settings.argon2_pepper
    try:
        return _ph.verify(hashed, peppered)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_session(username: str) -> str:
    token = secrets.token_hex(32)  # 256-bit
    _sessions[token] = username
    return token


def get_session_user(token: str) -> Optional[str]:
    return _sessions.get(token)


def delete_session(token: str) -> None:
    _sessions.pop(token, None)
