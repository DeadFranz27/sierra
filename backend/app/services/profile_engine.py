"""
Plant profile engine — computes effective thresholds and run parameters
from an active PlantProfile + growth stage. No hardcoded values anywhere.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models.tables import PlantProfile

# Growth stage multipliers per PRD §6.4
_STAGE_MODIFIERS = {
    "seedling": {
        "threshold_shift": +5.0,
        "duration_multiplier": 0.6,
        "interval_multiplier": 0.7,
    },
    "established": {
        "threshold_shift": 0.0,
        "duration_multiplier": 1.0,
        "interval_multiplier": 1.0,
    },
    "dormant": {
        "threshold_shift": -10.0,
        "duration_multiplier": 0.5,
        "interval_multiplier": 2.0,
    },
}


@dataclass(frozen=True)
class EffectiveParams:
    moisture_dry: float
    moisture_target: float
    moisture_wet: float
    run_min: float        # clamped to max_run_min
    min_interval_hours: float
    max_run_min: float


def compute_effective(profile: PlantProfile, growth_stage: str) -> EffectiveParams:
    mod = _STAGE_MODIFIERS.get(growth_stage, _STAGE_MODIFIERS["established"])

    shift = mod["threshold_shift"]
    effective_target = max(0.0, min(100.0, profile.moisture_target + shift))
    effective_dry = max(0.0, min(effective_target - 1, profile.moisture_dry + shift))
    effective_wet = max(effective_target + 1, min(100.0, profile.moisture_wet + shift))

    raw_run = profile.default_run_min * mod["duration_multiplier"]
    effective_run = min(raw_run, profile.max_run_min)

    effective_interval = profile.min_interval_hours * mod["interval_multiplier"]

    return EffectiveParams(
        moisture_dry=round(effective_dry, 1),
        moisture_target=round(effective_target, 1),
        moisture_wet=round(effective_wet, 1),
        run_min=round(effective_run, 2),
        min_interval_hours=round(effective_interval, 2),
        max_run_min=profile.max_run_min,
    )
