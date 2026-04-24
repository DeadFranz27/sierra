from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------

class DeviceOut(BaseModel):
    id: str
    kind: str
    name: str
    firmware_version: str
    actuator_type: Optional[str] = None
    mac: Optional[str] = None
    last_seen: Optional[datetime] = None
    wifi_rssi: Optional[float] = None
    ip_address: Optional[str] = None
    valve_state: Optional[str] = None
    water_level: Optional[bool] = None
    error_flag: bool = False
    error_message: Optional[str] = None
    paired_at: Optional[datetime] = None
    pairing_method: Optional[str] = None
    pending_unpair: bool = False

    model_config = {"from_attributes": True}


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    error_flag: Optional[bool] = None
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# DeviceCandidate
# ---------------------------------------------------------------------------

class DeviceCandidateOut(BaseModel):
    id: str
    kind: str
    mac: str
    ip: str
    port: Optional[int] = None
    hostname: Optional[str] = None
    firmware_version: str
    announced_at: datetime
    last_seen_at: datetime
    claimed_at: Optional[datetime] = None
    expires_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pairing
# ---------------------------------------------------------------------------

class PairRequest(BaseModel):
    pairing_code: str
    device_id: Optional[str] = None   # candidate UUID (preferred)
    ip: Optional[str] = None           # fallback manual IP


class PairResponse(BaseModel):
    device: DeviceOut
    message: str
