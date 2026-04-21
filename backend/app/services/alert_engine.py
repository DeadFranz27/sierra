"""
Alert engine — PRD §9.2.

Rules:
- Each alert kind is created once per state-transition entry (not re-emitted on heartbeat).
- Auto-resolves when triggering state clears.
- valve_fault and valve_offline_mid_watering require user acknowledgment — not auto-resolved.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Alert

log = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


SEVERITY_MAP: dict[str, str] = {
    "reservoir_empty": "warning",
    "sensor_trouble": "warning",
    "valve_fault": "error",
    "valve_offline_mid_watering": "error",
    "hub_degraded": "error",
    "sense_implausible": "warning",
    "device_offline": "info",
}

# These kinds require explicit user acknowledgment before auto-resolve is allowed
MANUAL_RESOLVE = {"valve_fault", "valve_offline_mid_watering"}


async def emit(
    db: AsyncSession,
    kind: str,
    message: str,
    zone_id: Optional[str] = None,
    device_id: Optional[str] = None,
) -> Alert:
    """Create alert if no active unresolved one of the same kind+scope exists."""
    stmt = select(Alert).where(
        and_(
            Alert.kind == kind,
            Alert.resolved_at.is_(None),
            Alert.zone_id == zone_id,
            Alert.device_id == device_id,
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        log.debug("Alert %s already active — not re-emitting", kind)
        return existing

    alert = Alert(
        kind=kind,
        severity=SEVERITY_MAP.get(kind, "warning"),
        message=message,
        zone_id=zone_id,
        device_id=device_id,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    log.info("Alert emitted: %s — %s", kind, message)
    return alert


async def resolve(
    db: AsyncSession,
    kind: str,
    zone_id: Optional[str] = None,
    device_id: Optional[str] = None,
) -> None:
    """Auto-resolve active alerts of given kind+scope (skip manual-resolve kinds)."""
    if kind in MANUAL_RESOLVE:
        return

    stmt = select(Alert).where(
        and_(
            Alert.kind == kind,
            Alert.resolved_at.is_(None),
            Alert.zone_id == zone_id,
            Alert.device_id == device_id,
        )
    )
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    for alert in alerts:
        alert.resolved_at = _now()
        log.info("Alert auto-resolved: %s", kind)
    if alerts:
        await db.commit()


async def acknowledge(db: AsyncSession, alert_id: str) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert and not alert.acknowledged_at:
        alert.acknowledged_at = _now()
        await db.commit()
        await db.refresh(alert)
    return alert
