"""
Profile-driven scheduler — APScheduler-based, implements PRD §6.5 skip logic.

Skip priority (first match wins):
  1. manual skip-next flag set via API
  2. current moisture >= effective target
  3. rain forecast >= 2 mm in next 12 h
  4. last run < min_interval_hours ago
  5. else → water for min(effective_run, max_run_min) seconds
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.models.base import SessionLocal
from app.models.tables import MoistureReading, Run, Schedule, Zone
from app.services.mqtt_bridge import publish_valve_command, get_valve_state
from app.services.profile_engine import compute_effective
from app.services.weather import get_forecast

log = logging.getLogger(__name__)

_skip_next: set[str] = set()
_scheduler: Optional[AsyncIOScheduler] = None


# ── Skip-next flag ────────────────────────────────────────────────────────────

def mark_skip_next(zone_id: str) -> None:
    _skip_next.add(zone_id)


def consume_skip_next(zone_id: str) -> bool:
    """Return True (and clear the flag) if the zone was flagged to skip."""
    if zone_id in _skip_next:
        _skip_next.discard(zone_id)
        return True
    return False


# ── Scheduler lifecycle ───────────────────────────────────────────────────────

def start_scheduler(timezone_str: str) -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone=timezone_str)
    _scheduler.start()
    log.info("APScheduler started (tz=%s)", timezone_str)
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def get_scheduler() -> Optional[AsyncIOScheduler]:
    return _scheduler


async def reload_schedules(timezone_str: str) -> None:
    """Remove all schedule jobs and rebuild from DB. Call after CRUD changes."""
    global _scheduler
    if _scheduler is None:
        return
    for job in _scheduler.get_jobs():
        if job.id.startswith("sched_"):
            job.remove()

    async with SessionLocal() as db:
        result = await db.execute(
            select(Schedule).where(Schedule.enabled == True)  # noqa: E712
        )
        schedules = result.scalars().all()

    for s in schedules:
        _add_schedule_job(s, timezone_str)

    log.info("Reloaded %d schedule jobs", len(schedules))


def _add_schedule_job(schedule: Schedule, timezone_str: str) -> None:
    if _scheduler is None:
        return
    if not schedule.days_of_week:
        return

    dow = ",".join(str(d) for d in schedule.days_of_week)
    try:
        hour, minute = schedule.time_local.split(":")
    except ValueError:
        log.warning("Invalid time_local %r for schedule %s", schedule.time_local, schedule.id)
        return

    _scheduler.add_job(
        _run_schedule,
        CronTrigger(day_of_week=dow, hour=int(hour), minute=int(minute), timezone=timezone_str),
        args=[schedule.id],
        id=f"sched_{schedule.id}",
        replace_existing=True,
        misfire_grace_time=120,
    )


# ── Core execution logic ──────────────────────────────────────────────────────

async def _run_schedule(schedule_id: str) -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Schedule)
            .where(Schedule.id == schedule_id)
            .options(selectinload(Schedule.zone).selectinload(Zone.active_profile))
        )
        schedule = result.scalar_one_or_none()
        if schedule is None or not schedule.enabled:
            return

        zone = schedule.zone
        await _execute_zone_run(db, zone, schedule, schedule.duration_min)


async def _execute_zone_run(db, zone: Zone, schedule: Schedule, duration_min: float) -> None:
    zone_id = zone.id

    if zone.active_profile is None:
        log.info("Zone %s has no profile — skipping scheduled run", zone_id)
        return

    params = compute_effective(zone.active_profile, zone.growth_stage)
    now = datetime.now(timezone.utc)

    # 1. Manual skip-next flag
    if consume_skip_next(zone_id):
        await _record_skip(db, zone, schedule, params, "Watering paused for this cycle — resuming as usual next time.")
        return

    if schedule.smart:
        # 2. Moisture check
        latest_moisture = await _latest_moisture(db, zone_id)
        if latest_moisture is not None and latest_moisture >= params.moisture_target:
            await _record_skip(
                db, zone, schedule, params,
                f"Soil is well hydrated ({latest_moisture:.0f}%) — no water needed today.",
                moisture_before=latest_moisture,
            )
            return

        # 3. Rain forecast check
        try:
            forecast = await get_forecast()
            if forecast.rain_next_12h_mm >= 2.0:
                await _record_skip(
                    db, zone, schedule, params,
                    f"Rain on the way ({forecast.rain_next_12h_mm:.1f} mm forecast) — skipping to let nature do its work.",
                    moisture_before=latest_moisture,
                )
                return
        except Exception as exc:
            log.warning("Weather fetch failed during schedule check: %s — proceeding", exc)

        # 4. Minimum interval check
        last_run_at = await _last_run_time(db, zone_id)
        if last_run_at is not None:
            min_gap = timedelta(hours=params.min_interval_hours)
            if (now - last_run_at) < min_gap:
                hours_since = (now - last_run_at).total_seconds() / 3600
                await _record_skip(
                    db, zone, schedule, params,
                    f"Watered {hours_since:.1f} h ago — giving the roots time to breathe.",
                    moisture_before=latest_moisture,
                )
                return
    else:
        latest_moisture = await _latest_moisture(db, zone_id)

    # 5. Water — cap to effective max
    clamped = min(duration_min * (params.run_min / (schedule.duration_min or params.run_min)), params.max_run_min)
    clamped = min(params.run_min, params.max_run_min)

    duration_s = int(clamped * 60)
    await publish_valve_command(duration_s)

    run = Run(
        zone_id=zone_id,
        started_at=now,
        duration_min=clamped,
        trigger="schedule",
        profile_id_at_run=zone.active_profile_id,
        growth_stage_at_run=zone.growth_stage,
        moisture_before=latest_moisture if schedule.smart else None,
        skipped=False,
    )
    db.add(run)
    await db.commit()
    log.info("Zone %s: scheduled run started (%.1f min)", zone_id, clamped)


async def _record_skip(
    db,
    zone: Zone,
    schedule: Schedule,
    params,
    reason: str,
    moisture_before: Optional[float] = None,
) -> None:
    run = Run(
        zone_id=zone.id,
        started_at=datetime.now(timezone.utc),
        duration_min=0.0,
        trigger="schedule",
        profile_id_at_run=zone.active_profile_id,
        growth_stage_at_run=zone.growth_stage,
        moisture_before=moisture_before,
        skipped=True,
        skip_reason=reason,
    )
    db.add(run)
    await db.commit()
    log.info("Zone %s: skipped — %s", zone.id, reason)


async def _latest_moisture(db, zone_id: str) -> Optional[float]:
    result = await db.execute(
        select(MoistureReading)
        .where(MoistureReading.zone_id == zone_id)
        .order_by(desc(MoistureReading.timestamp))
        .limit(1)
    )
    reading = result.scalar_one_or_none()
    return reading.value_percent if reading else None


async def _last_run_time(db, zone_id: str) -> Optional[datetime]:
    result = await db.execute(
        select(Run)
        .where(Run.zone_id == zone_id, Run.skipped == False)  # noqa: E712
        .order_by(desc(Run.started_at))
        .limit(1)
    )
    run = result.scalar_one_or_none()
    return run.started_at if run else None
