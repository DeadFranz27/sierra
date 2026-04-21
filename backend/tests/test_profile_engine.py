"""Unit tests for the profile engine — no DB needed."""
import pytest
from unittest.mock import MagicMock
from app.services.profile_engine import compute_effective, EffectiveParams


def _make_profile(**kwargs):
    defaults = dict(
        moisture_dry=40.0,
        moisture_target=65.0,
        moisture_wet=80.0,
        default_run_min=6.0,
        min_interval_hours=24.0,
        max_run_min=15.0,
    )
    defaults.update(kwargs)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def test_established_stage_unchanged():
    p = _make_profile()
    result = compute_effective(p, "established")
    assert result.moisture_target == 65.0
    assert result.run_min == 6.0
    assert result.min_interval_hours == 24.0


def test_seedling_raises_target():
    p = _make_profile()
    result = compute_effective(p, "seedling")
    assert result.moisture_target == 70.0   # +5 pp
    assert result.run_min == pytest.approx(3.6, rel=0.01)   # 0.6×
    assert result.min_interval_hours == pytest.approx(16.8, rel=0.01)  # 0.7×


def test_dormant_lowers_target():
    p = _make_profile()
    result = compute_effective(p, "dormant")
    assert result.moisture_target == 55.0  # -10 pp
    assert result.run_min == pytest.approx(3.0, rel=0.01)   # 0.5×
    assert result.min_interval_hours == pytest.approx(48.0, rel=0.01)  # 2×


def test_run_clamped_to_max():
    # default_run_min=14, max_run_min=15 → seedling: 14*0.6=8.4 < 15 OK
    # But if default=20 and max=15 → should clamp
    p = _make_profile(default_run_min=20.0, max_run_min=15.0)
    result = compute_effective(p, "established")
    assert result.run_min == 15.0


def test_target_never_exceeds_100():
    p = _make_profile(moisture_target=98.0, moisture_wet=99.0, moisture_dry=80.0)
    result = compute_effective(p, "seedling")
    assert result.moisture_target <= 100.0


def test_dry_never_below_0():
    p = _make_profile(moisture_dry=3.0, moisture_target=10.0, moisture_wet=20.0)
    result = compute_effective(p, "dormant")
    assert result.moisture_dry >= 0.0


def test_unknown_stage_falls_back_to_established():
    p = _make_profile()
    result = compute_effective(p, "unknown_stage")
    assert result.moisture_target == 65.0
    assert result.run_min == 6.0
