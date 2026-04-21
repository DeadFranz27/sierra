"""
Seed services:
  - seed_presets: loads plant_presets.json into DB (idempotent, version-aware)
  - seed_mock_history: populates 7 days of fake data when MOCK_MODE=true
"""
from __future__ import annotations

import json
import logging
import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import PlantProfile, Zone, Device, Schedule, MoistureReading, Run

log = logging.getLogger(__name__)

PRESETS_PATH = Path(__file__).parent.parent / "data" / "plant_presets.json"


async def seed_presets(db: AsyncSession) -> None:
    """Load plant presets from JSON. Idempotent and version-aware."""
    raw = json.loads(PRESETS_PATH.read_text())
    file_version: int = raw["version"]

    for p in raw["presets"]:
        result = await db.execute(
            select(PlantProfile).where(PlantProfile.preset_key == p["preset_key"])
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            profile = PlantProfile(
                id=str(uuid.uuid4()),
                is_preset=True,
                seed_version=file_version,
                **_preset_fields(p),
            )
            db.add(profile)
            log.info("Seeded new preset: %s", p["name"])
        elif existing.seed_version < file_version:
            # Update fields but preserve the id and any zone assignments
            for k, v in _preset_fields(p).items():
                setattr(existing, k, v)
            existing.seed_version = file_version
            log.info("Updated preset: %s (version %d → %d)", p["name"], existing.seed_version, file_version)

    await db.commit()


def _preset_fields(p: dict) -> dict:
    return {
        "preset_key": p["preset_key"],
        "name": p["name"],
        "description": p["description"],
        "moisture_dry": float(p["moisture_dry"]),
        "moisture_target": float(p["moisture_target"]),
        "moisture_wet": float(p["moisture_wet"]),
        "default_run_min": float(p["default_run_min"]),
        "min_interval_hours": float(p["min_interval_hours"]),
        "max_run_min": float(p["max_run_min"]),
        "sun_preference": p["sun_preference"],
        "season_active": p["season_active"],
        "category": p.get("category"),
    }


async def seed_mock_history(db: AsyncSession) -> None:
    """Populate 7 days of realistic mock data. Skipped if any zone already exists."""
    result = await db.execute(select(func.count()).select_from(Zone))
    count = result.scalar_one()
    if count > 0:
        log.info("Mock seed skipped — data already present")
        return

    # Find turfgrass preset
    result = await db.execute(
        select(PlantProfile).where(PlantProfile.preset_key == "turfgrass")
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        log.warning("Turfgrass preset not found — run seed_presets first")
        return

    # Create hub device
    hub = Device(
        id=str(uuid.uuid4()),
        kind="hub",
        name="Sierra Hub",
        firmware_version="0.1.0-mock",
        last_seen=datetime.now(timezone.utc),
        wifi_rssi=-54.0,
    )
    db.add(hub)

    # Create sense device
    sense = Device(
        id=str(uuid.uuid4()),
        kind="sense",
        name="Sierra Sense",
        firmware_version="0.1.0-mock",
        last_seen=datetime.now(timezone.utc),
        wifi_rssi=-58.0,
    )
    db.add(sense)

    # Create zone
    zone = Zone(
        id=str(uuid.uuid4()),
        name="Back lawn",
        area_m2=20.0,
        valve_device_id=hub.id,
        sensor_device_id=sense.id,
        active_profile_id=profile.id,
        growth_stage="established",
        profile_assigned_at=datetime.now(timezone.utc),
    )
    db.add(zone)

    # Create schedule: Mon/Wed/Fri 06:00, smart ON
    schedule = Schedule(
        id=str(uuid.uuid4()),
        zone_id=zone.id,
        days_of_week=[0, 2, 4],   # Mon, Wed, Fri
        time_local="06:00",
        duration_min=6.0,
        smart=True,
        enabled=True,
    )
    db.add(schedule)

    # Generate 7 days of moisture history (sinusoidal + watering jumps)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    readings = _generate_moisture_history(zone.id, start, now)
    for r in readings:
        db.add(r)

    # Create 3 past runs
    for i, (started, duration) in enumerate([
        (now - timedelta(days=6, hours=18), 6.0),
        (now - timedelta(days=4, hours=18), 6.0),
        (now - timedelta(days=2, hours=18), 6.0),
    ]):
        run = Run(
            id=str(uuid.uuid4()),
            zone_id=zone.id,
            started_at=started,
            ended_at=started + timedelta(minutes=duration),
            duration_min=duration,
            trigger="scheduled",
            profile_id_at_run=profile.id,
            growth_stage_at_run="established",
            moisture_before=round(random.uniform(38, 48), 1),
            moisture_after=round(random.uniform(60, 68), 1),
            skipped=False,
        )
        db.add(run)

    await db.commit()
    log.info("Mock history seeded — zone '%s' with 7 days of data", zone.name)


def _generate_moisture_history(
    zone_id: str,
    start: datetime,
    end: datetime,
) -> list[MoistureReading]:
    """Realistic daily sinusoid with watering jumps every ~48 h."""
    readings = []
    current = start
    moisture = 55.0
    watering_times = [
        start + timedelta(days=1),
        start + timedelta(days=3),
        start + timedelta(days=5),
    ]

    while current < end:
        # Sinusoidal daily pattern: higher at dawn, lower at dusk
        hour = current.hour + current.minute / 60.0
        daily_factor = 0.5 + 0.5 * math.cos(2 * math.pi * (hour - 6) / 24)

        # Check if near a watering event
        for wt in watering_times:
            if abs((current - wt).total_seconds()) < 600:
                moisture = min(moisture + 18.0, 80.0)

        # Natural drying (slightly faster midday)
        et = 0.008 * (1.2 - 0.4 * daily_factor)
        moisture = max(30.0, moisture - et * 60)  # per-minute rate
        noise = random.gauss(0, 0.15)
        value = round(max(0.0, min(100.0, moisture + noise)), 1)

        readings.append(MoistureReading(
            id=str(uuid.uuid4()),
            zone_id=zone_id,
            timestamp=current,
            value_percent=value,
            temp_c=round(random.uniform(18.0, 26.0), 1),
        ))
        current += timedelta(minutes=10)   # one reading every 10 min

    return readings
