from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class PlantProfileOut(BaseModel):
    id: str
    name: str
    description: str
    is_preset: bool
    preset_key: Optional[str]
    category: Optional[str] = None
    moisture_dry: float
    moisture_target: float
    moisture_wet: float
    default_run_min: float
    min_interval_hours: float
    max_run_min: float
    sun_preference: str
    season_active: list
    created_at: datetime
    forked_from_id: Optional[str]

    model_config = {"from_attributes": True}


class PlantProfileCreate(BaseModel):
    name: str
    description: str = ""
    moisture_dry: float
    moisture_target: float
    moisture_wet: float
    default_run_min: float
    min_interval_hours: float
    max_run_min: float
    sun_preference: str = "full"
    season_active: list = []
    forked_from_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        if len(v) > 64:
            raise ValueError("too long")
        return v.strip()

    @field_validator("moisture_dry", "moisture_target", "moisture_wet")
    @classmethod
    def in_range(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("must be between 0 and 100")
        return v

    @field_validator("default_run_min", "max_run_min")
    @classmethod
    def valid_run(cls, v: float) -> float:
        if not (1.0 <= v <= 30.0):
            raise ValueError("must be between 1 and 30")
        return v

    @field_validator("min_interval_hours")
    @classmethod
    def valid_interval(cls, v: float) -> float:
        if not (1.0 <= v <= 336.0):
            raise ValueError("must be between 1 and 336 hours")
        return v

    @field_validator("sun_preference")
    @classmethod
    def valid_sun(cls, v: str) -> str:
        if v not in ("full", "partial", "shade"):
            raise ValueError("must be full, partial, or shade")
        return v

    def validate_thresholds(self) -> None:
        if not (self.moisture_dry < self.moisture_target < self.moisture_wet):
            raise ValueError("moisture_dry < moisture_target < moisture_wet required")
        if self.max_run_min < self.default_run_min:
            raise ValueError("max_run_min must be >= default_run_min")


class PlantProfileUpdate(PlantProfileCreate):
    pass
