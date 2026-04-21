from __future__ import annotations

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, field_validator


TOTAL_STEPS = 9


class OnboardingProgressOut(BaseModel):
    id: str
    current_step: int
    state_snapshot: Optional[dict] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    is_complete: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_flag(cls, obj: Any) -> "OnboardingProgressOut":
        out = cls.model_validate(obj)
        out.is_complete = obj.completed_at is not None
        return out


class OnboardingProgressUpdate(BaseModel):
    current_step: int
    state_snapshot: Optional[dict] = None

    @field_validator("current_step")
    @classmethod
    def valid_step(cls, v: int) -> int:
        if not (1 <= v <= TOTAL_STEPS):
            raise ValueError(f"current_step must be between 1 and {TOTAL_STEPS}")
        return v
