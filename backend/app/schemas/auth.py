import re

from pydantic import BaseModel, Field, field_validator


_USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username", "password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v

    @field_validator("username")
    @classmethod
    def username_length(cls, v: str) -> str:
        if len(v) > 64:
            raise ValueError("too long")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) > 256:
            raise ValueError("too long")
        return v


class SessionResponse(BaseModel):
    username: str
    mock_mode: bool


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("username may only contain letters, digits, dot, underscore, hyphen")
        return v

    @field_validator("password")
    @classmethod
    def password_has_letter_and_digit(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("password must contain at least one letter and one digit")
        return v


class AuthStatusResponse(BaseModel):
    has_users: bool
    demo_mode: bool
