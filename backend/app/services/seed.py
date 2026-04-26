"""
Seed services:
  - seed_presets: loads plant_presets.json into DB (idempotent, version-aware)
  - seed_hub: ensures a Device(kind="hub") row exists for the local hub
"""
from __future__ import annotations

import json
import logging
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Device, PlantProfile

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
            for k, v in _preset_fields(p).items():
                setattr(existing, k, v)
            existing.seed_version = file_version
            log.info("Updated preset: %s (version %d → %d)", p["name"], existing.seed_version, file_version)

    await db.commit()


async def seed_hub(db: AsyncSession) -> None:
    """Ensure a Device(kind='hub') row exists. Idempotent.

    The hub is the host this backend runs on — it never goes through the
    /announce → /pair flow that ESP devices use, so without this seed the
    UI would always show 'NOT DETECTED' on the Devices page.
    """
    result = await db.execute(select(Device).where(Device.kind == "hub").limit(1))
    if result.scalar_one_or_none() is not None:
        return
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "sierra-hub"
    db.add(Device(
        id=str(uuid.uuid4()),
        kind="hub",
        name=hostname or "Sierra Hub",
        firmware_version="local",
        last_seen=datetime.now(timezone.utc),
        paired_at=datetime.now(timezone.utc),
        pairing_method="local",
    ))
    await db.commit()
    log.info("Seeded local hub Device row (hostname=%s)", hostname)


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
