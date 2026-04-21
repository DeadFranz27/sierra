from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class ProfileSummary(BaseModel):
    id: str
    name: str
    description: str
    moisture_dry: float
    moisture_target: float
    moisture_wet: float
    default_run_min: float
    max_run_min: float
    is_preset: bool


class ZoneOut(BaseModel):
    id: str
    name: str
    area_m2: Optional[float]
    valve_device_id: str
    sensor_device_id: str
    active_profile_id: Optional[str]
    active_profile: Optional[ProfileSummary]
    growth_stage: str
    profile_assigned_at: Optional[datetime]
    is_calibrated: bool = False
    calibration_dry_raw: Optional[float] = None
    calibration_wet_raw: Optional[float] = None
    calibrated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ZoneCreate(BaseModel):
    name: str
    area_m2: Optional[float] = None
    valve_device_id: str
    sensor_device_id: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        if len(v) > 64:
            raise ValueError("too long")
        return v.strip()


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    area_m2: Optional[float] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("must not be empty")
            if len(v) > 64:
                raise ValueError("too long")
            return v.strip()
        return v


class GrowthStageUpdate(BaseModel):
    growth_stage: str

    @field_validator("growth_stage")
    @classmethod
    def valid_stage(cls, v: str) -> str:
        if v not in ("seedling", "established", "dormant"):
            raise ValueError("must be seedling, established, or dormant")
        return v


class AssignProfileRequest(BaseModel):
    profile_id: str


class WaterRequest(BaseModel):
    duration_min: Optional[float] = None

    @field_validator("duration_min")
    @classmethod
    def valid_duration(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v <= 0 or v > 30):
            raise ValueError("duration_min must be between 0 and 30")
        return v


class MoistureReadingOut(BaseModel):
    timestamp: datetime
    value_percent: float
    temp_c: Optional[float]

    model_config = {"from_attributes": True}


class RunOut(BaseModel):
    id: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_min: Optional[float]
    trigger: str
    moisture_before: Optional[float]
    moisture_after: Optional[float]
    skipped: bool
    skip_reason: Optional[str]
    valve_fault_detected: bool = False

    model_config = {"from_attributes": True}


class CalibrationCaptureOut(BaseModel):
    raw_value: float
    samples: int
    duration_s: int


class CalibrationCompleteRequest(BaseModel):
    raw_dry: float
    raw_wet: float
