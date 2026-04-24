"""
Seed services:
  - seed_presets: loads plant_presets.json into DB (idempotent, version-aware)
"""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import PlantProfile

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
