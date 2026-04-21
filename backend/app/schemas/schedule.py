from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, field_validator


class ScheduleOut(BaseModel):
    id: str
    zone_id: str
    days_of_week: list
    time_local: str
    duration_min: float
    smart: bool
    enabled: bool

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    zone_id: str
    days_of_week: list
    time_local: str
    duration_min: float
    smart: bool = True
    enabled: bool = True

    @field_validator("days_of_week")
    @classmethod
    def valid_days(cls, v: list) -> list:
        if not v:
            raise ValueError("at least one day required")
        for d in v:
            if d not in range(7):
                raise ValueError("days must be 0–6 (Monday=0)")
        return sorted(set(v))

    @field_validator("time_local")
    @classmethod
    def valid_time(cls, v: str) -> str:
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("format must be HH:MM")
        try:
            h, m = int(parts[0]), int(parts[1])
        except ValueError:
            raise ValueError("format must be HH:MM")
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("invalid time")
        return f"{h:02d}:{m:02d}"

    @field_validator("duration_min")
    @classmethod
    def valid_duration(cls, v: float) -> float:
        if not (1.0 <= v <= 30.0):
            raise ValueError("duration_min must be between 1 and 30")
        return v


class ScheduleUpdate(BaseModel):
    days_of_week: Optional[list] = None
    time_local: Optional[str] = None
    duration_min: Optional[float] = None
    smart: Optional[bool] = None
    enabled: Optional[bool] = None
