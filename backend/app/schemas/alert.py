from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

ALERT_KINDS = {
    "reservoir_empty",
    "sensor_trouble",
    "valve_fault",
    "valve_offline_mid_watering",
    "hub_degraded",
    "sense_implausible",
    "device_offline",
}

ALERT_SEVERITIES = {"info", "warning", "error"}


class AlertOut(BaseModel):
    id: str
    zone_id: Optional[str] = None
    device_id: Optional[str] = None
    kind: str
    severity: str
    message: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
