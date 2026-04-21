from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.base import get_db
from app.models.tables import MoistureReading, PlantProfile, Run, Zone
from app.schemas.zone import (
    AssignProfileRequest, GrowthStageUpdate, MoistureReadingOut,
    RunOut, WaterRequest, ZoneCreate, ZoneOut, ZoneUpdate,
    CalibrationCaptureOut, CalibrationCompleteRequest,
)
from app.security.deps import get_current_user
from app.config import settings
from app.services import mqtt_bridge
from app.services.profile_engine import compute_effective

log = logging.getLogger(__name__)
router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("", response_model=list[ZoneOut])
async def list_zones(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Zone).options(selectinload(Zone.active_profile))
    )
    return result.scalars().all()


@router.post("", response_model=ZoneOut, status_code=status.HTTP_201_CREATED)
async def create_zone(
    body: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = Zone(**body.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone, ["active_profile"])
    return zone


@router.get("/{zone_id}", response_model=ZoneOut)
async def get_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id, load_profile=True)
    return zone


@router.patch("/{zone_id}", response_model=ZoneOut)
async def update_zone(
    zone_id: str,
    body: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id, load_profile=True)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(zone, k, v)
    await db.commit()
    await db.refresh(zone, ["active_profile"])
    return zone


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id)
    await db.delete(zone)
    await db.commit()


@router.post("/{zone_id}/profile", response_model=ZoneOut)
async def assign_profile(
    zone_id: str,
    body: AssignProfileRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id)

    result = await db.execute(select(PlantProfile).where(PlantProfile.id == body.profile_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Plant profile not found")

    # Stop any in-progress run and close valve (PRD §6.6)
    if mqtt_bridge.get_valve_state() == "OPEN":
        await mqtt_bridge.publish_valve_close()
        log.info("Valve closed due to profile change on zone %s", zone_id)

    zone.active_profile_id = body.profile_id
    zone.profile_assigned_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(zone, ["active_profile"])
    return zone


@router.patch("/{zone_id}/growth-stage", response_model=ZoneOut)
async def update_growth_stage(
    zone_id: str,
    body: GrowthStageUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id, load_profile=True)
    zone.growth_stage = body.growth_stage
    await db.commit()
    await db.refresh(zone, ["active_profile"])
    return zone


@router.post("/{zone_id}/water", response_model=RunOut, status_code=status.HTTP_201_CREATED)
async def water_now(
    zone_id: str,
    body: WaterRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id, load_profile=True)

    if zone.active_profile is None:
        raise HTTPException(status_code=409, detail="Zone has no active plant profile")

    params = compute_effective(zone.active_profile, zone.growth_stage)
    requested = body.duration_min if body.duration_min is not None else params.run_min
    # Always enforce max_run_min — hard cap per PRD §6.6 and §BE-9
    clamped = min(requested, params.max_run_min)

    # Get latest moisture reading
    result = await db.execute(
        select(MoistureReading)
        .where(MoistureReading.zone_id == zone_id)
        .order_by(desc(MoistureReading.timestamp))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    moisture_before = latest.value_percent if latest else None

    duration_s = int(clamped * 60)
    await mqtt_bridge.publish_valve_command(duration_s)

    run = Run(
        zone_id=zone_id,
        started_at=datetime.now(timezone.utc),
        duration_min=clamped,
        trigger="manual",
        profile_id_at_run=zone.active_profile_id,
        growth_stage_at_run=zone.growth_stage,
        moisture_before=moisture_before,
        skipped=False,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


@router.post("/{zone_id}/skip-next", status_code=status.HTTP_204_NO_CONTENT)
async def skip_next(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    await _get_zone_or_404(db, zone_id)
    # Skip logic is handled by the scheduler in M4 — this endpoint sets a flag
    # stored in-memory (simple for PoC, persisted in M4 scheduler).
    from app.services import scheduler as sched_svc
    sched_svc.mark_skip_next(zone_id)


@router.get("/{zone_id}/history", response_model=list[MoistureReadingOut])
async def moisture_history(
    zone_id: str,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if hours not in (24, 168):  # 24h or 7d
        raise HTTPException(status_code=422, detail="hours must be 24 or 168")
    await _get_zone_or_404(db, zone_id)
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(MoistureReading)
        .where(MoistureReading.zone_id == zone_id)
        .where(MoistureReading.timestamp >= since)
        .order_by(MoistureReading.timestamp)
    )
    return result.scalars().all()


@router.get("/{zone_id}/runs", response_model=list[RunOut])
async def run_history(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    await _get_zone_or_404(db, zone_id)
    result = await db.execute(
        select(Run)
        .where(Run.zone_id == zone_id)
        .order_by(desc(Run.started_at))
        .limit(10)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Calibration endpoints — PRD §7.3 BE-15
# ---------------------------------------------------------------------------

@router.post("/{zone_id}/calibration/dry", response_model=CalibrationCaptureOut)
async def calibrate_dry(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """
    Start a 20-second dry capture window (~2 Hz).
    In mock mode, returns a simulated raw value immediately.
    On real hardware, reads raw ADC samples from MQTT bridge.
    """
    await _get_zone_or_404(db, zone_id)

    if settings.mock_mode:
        import random
        raw = round(2800 + random.uniform(-50, 50), 1)
        return CalibrationCaptureOut(raw_value=raw, samples=40, duration_s=20)

    raw = await mqtt_bridge.capture_raw_adc(zone_id, duration_s=20)
    if raw is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="No raw ADC readings received from sensor")
    return CalibrationCaptureOut(raw_value=raw, samples=40, duration_s=20)


@router.post("/{zone_id}/calibration/wet", response_model=CalibrationCaptureOut)
async def calibrate_wet(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Start a 20-second wet capture window."""
    await _get_zone_or_404(db, zone_id)

    if settings.mock_mode:
        import random
        raw = round(1200 + random.uniform(-50, 50), 1)
        return CalibrationCaptureOut(raw_value=raw, samples=40, duration_s=20)

    raw = await mqtt_bridge.capture_raw_adc(zone_id, duration_s=20)
    if raw is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="No raw ADC readings received from sensor")
    return CalibrationCaptureOut(raw_value=raw, samples=40, duration_s=20)


@router.post("/{zone_id}/calibration/complete", response_model=ZoneOut)
async def calibration_complete(
    zone_id: str,
    body: CalibrationCompleteRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """
    Save calibration pair and mark zone as calibrated.
    Validates raw_wet < raw_dry (capacitive sensors are lower when wet).
    """
    from fastapi import HTTPException
    if body.raw_wet >= body.raw_dry:
        raise HTTPException(
            status_code=422,
            detail="raw_wet must be less than raw_dry (capacitive sensor reads lower when wet)"
        )

    zone = await _get_zone_or_404(db, zone_id, load_profile=True)
    zone.calibration_dry_raw = body.raw_dry
    zone.calibration_wet_raw = body.raw_wet
    zone.is_calibrated = True
    zone.calibrated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(zone, ["active_profile"])

    log.info("Zone %s calibrated: dry=%.1f wet=%.1f", zone_id, body.raw_dry, body.raw_wet)
    return zone


async def _get_zone_or_404(
    db: AsyncSession,
    zone_id: str,
    load_profile: bool = False,
) -> Zone:
    q = select(Zone).where(Zone.id == zone_id)
    if load_profile:
        q = q.options(selectinload(Zone.active_profile))
    result = await db.execute(q)
    zone = result.scalar_one_or_none()
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone
