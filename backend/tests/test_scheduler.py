"""Tests for M4: scheduler skip logic, weather integration, mock control endpoints."""
from __future__ import annotations

import asyncio
import os
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("SIERRA_ENV", "test")
os.environ.setdefault("SESSION_SECRET", "a" * 64)
os.environ.setdefault("ARGON2_PEPPER", "b" * 64)
os.environ.setdefault("MQTT_USER", "test-backend")
os.environ.setdefault("MQTT_PASS", "test-pass")
os.environ.setdefault("SIERRA_HUB_MQTT_USER", "test-hub")
os.environ.setdefault("SIERRA_HUB_MQTT_PASS", "test-hub-pass")
os.environ.setdefault("MOCK_MODE", "true")


# ── skip-next flag ────────────────────────────────────────────────────────────

def test_skip_next_flag():
    from app.services.scheduler import mark_skip_next, consume_skip_next
    zone_id = "zone-skip-test"
    assert not consume_skip_next(zone_id)      # no flag → False
    mark_skip_next(zone_id)
    assert consume_skip_next(zone_id)          # flag present → True, consumed
    assert not consume_skip_next(zone_id)      # consumed → False again


# ── Weather service ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_weather_mock_fallback():
    """When mock-hub is unreachable, returns sunny defaults."""
    from app.services.weather import _mock_forecast
    with patch("httpx.AsyncClient") as mock_cls:
        instance = AsyncMock()
        instance.__aenter__.return_value = instance
        instance.__aexit__.return_value = False
        instance.get.side_effect = Exception("connection refused")
        mock_cls.return_value = instance

        result = await _mock_forecast()

    assert result.condition == "sunny"
    assert result.rain_next_12h_mm == 0.0
    assert result.temp_c == 20.0


@pytest.mark.asyncio
async def test_weather_mock_parses_state():
    """Parses weather from mock-hub /state correctly."""
    from app.services.weather import _mock_forecast
    fake_state = {
        "weather": {
            "condition": "rainy",
            "rain_forecast_mm": 5.5,
            "temp_c": 12.3,
        }
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = fake_state

    with patch("httpx.AsyncClient") as mock_cls:
        instance = AsyncMock()
        instance.__aenter__.return_value = instance
        instance.__aexit__.return_value = False
        instance.get.return_value = mock_resp
        mock_cls.return_value = instance

        result = await _mock_forecast()

    assert result.condition == "rainy"
    assert result.rain_next_12h_mm == 5.5
    assert result.temp_c == 12.3


@pytest.mark.asyncio
async def test_weather_condition_thresholds():
    """WeatherForecast condition is sunny/cloudy/rainy based on 12h precipitation sum."""
    from app.services.weather import WeatherForecast

    def _make_forecast(rain_mm: float) -> WeatherForecast:
        if rain_mm >= 2.0:
            condition = "rainy"
        elif rain_mm >= 0.5:
            condition = "cloudy"
        else:
            condition = "sunny"
        return WeatherForecast(rain_next_12h_mm=rain_mm, condition=condition, temp_c=20.0)

    assert _make_forecast(0.0).condition == "sunny"
    assert _make_forecast(0.4).condition == "sunny"
    assert _make_forecast(0.5).condition == "cloudy"
    assert _make_forecast(1.9).condition == "cloudy"
    assert _make_forecast(2.0).condition == "rainy"
    assert _make_forecast(10.0).condition == "rainy"


@pytest.mark.asyncio
async def test_open_meteo_fallback_on_error():
    """Open-Meteo fallback returns sunny defaults on network error."""
    from app.services.weather import _open_meteo_forecast

    with patch("httpx.AsyncClient") as mock_cls:
        instance = AsyncMock()
        instance.__aenter__.return_value = instance
        instance.__aexit__.return_value = False
        instance.get.side_effect = Exception("timeout")
        mock_cls.return_value = instance

        result = await _open_meteo_forecast()

    assert result.condition == "sunny"
    assert result.rain_next_12h_mm == 0.0


# ── Scheduler skip logic (unit) ───────────────────────────────────────────────

def _make_zone_with_profile(
    moisture_target=60.0,
    min_interval_hours=4.0,
    max_run_min=20.0,
    growth_stage="established",
    smart=True,
):
    """Build mock zone+profile+schedule objects without DB."""
    from app.models.tables import PlantProfile, Zone, Schedule

    profile = MagicMock(spec=PlantProfile)
    profile.id = "p-test"
    profile.moisture_dry = 30.0
    profile.moisture_target = moisture_target
    profile.moisture_wet = 80.0
    profile.default_run_min = 10.0
    profile.min_interval_hours = min_interval_hours
    profile.max_run_min = max_run_min

    zone = MagicMock(spec=Zone)
    zone.id = "z-test"
    zone.growth_stage = growth_stage
    zone.active_profile_id = profile.id
    zone.active_profile = profile

    schedule = MagicMock(spec=Schedule)
    schedule.id = "s-test"
    schedule.zone_id = zone.id
    schedule.zone = zone
    schedule.days_of_week = [1]
    schedule.time_local = "06:00"
    schedule.duration_min = 10.0
    schedule.smart = smart
    schedule.enabled = True

    return zone, schedule


@pytest.mark.asyncio
async def test_skip_when_moisture_at_target():
    """Smart schedule skips when latest moisture >= effective_target."""
    from app.services.scheduler import _execute_zone_run
    from app.services.weather import WeatherForecast

    zone, schedule = _make_zone_with_profile(moisture_target=60.0)
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    published = []
    with patch("app.services.scheduler.publish_valve_command", new=AsyncMock(side_effect=lambda d: published.append(d))):
        with patch("app.services.scheduler.get_forecast", new=AsyncMock(return_value=WeatherForecast(0.0, "sunny", 20.0))):
            with patch("app.services.scheduler._latest_moisture", new=AsyncMock(return_value=65.0)):
                await _execute_zone_run(db, zone, schedule, schedule.duration_min)

    assert len(published) == 0


@pytest.mark.asyncio
async def test_skip_when_rain_forecast():
    """Smart schedule skips when rain forecast >= 2mm."""
    from app.services.scheduler import _execute_zone_run
    from app.services.weather import WeatherForecast

    zone, schedule = _make_zone_with_profile()
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    published = []
    rainy = WeatherForecast(rain_next_12h_mm=3.5, condition="rainy", temp_c=15.0)

    with patch("app.services.scheduler.publish_valve_command", new=AsyncMock(side_effect=lambda d: published.append(d))):
        with patch("app.services.scheduler.get_forecast", new=AsyncMock(return_value=rainy)):
            with patch("app.services.scheduler._latest_moisture", new=AsyncMock(return_value=45.0)):
                with patch("app.services.scheduler._last_run_time", new=AsyncMock(return_value=None)):
                    await _execute_zone_run(db, zone, schedule, schedule.duration_min)

    assert len(published) == 0


@pytest.mark.asyncio
async def test_skip_min_interval():
    """Smart schedule skips when last run was too recent."""
    from app.services.scheduler import _execute_zone_run
    from app.services.weather import WeatherForecast

    zone, schedule = _make_zone_with_profile(min_interval_hours=8.0)
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    recent = datetime.now(timezone.utc) - timedelta(hours=2)
    published = []
    clear = WeatherForecast(rain_next_12h_mm=0.0, condition="sunny", temp_c=22.0)

    with patch("app.services.scheduler.publish_valve_command", new=AsyncMock(side_effect=lambda d: published.append(d))):
        with patch("app.services.scheduler.get_forecast", new=AsyncMock(return_value=clear)):
            with patch("app.services.scheduler._latest_moisture", new=AsyncMock(return_value=45.0)):
                with patch("app.services.scheduler._last_run_time", new=AsyncMock(return_value=recent)):
                    await _execute_zone_run(db, zone, schedule, schedule.duration_min)

    assert len(published) == 0


# ── Mock control router ───────────────────────────────────────────────────────

def test_mock_state_requires_auth(client):
    resp = client.get("/api/mock/state")
    assert resp.status_code == 401


def test_mock_endpoints_return_404_in_prod_mode(auth_client):
    import app.routers.mock_control as mc
    original = mc.settings.mock_mode
    mc.settings.__dict__["mock_mode"] = False
    try:
        resp = auth_client.get("/api/mock/state")
        assert resp.status_code == 404
    finally:
        mc.settings.__dict__["mock_mode"] = original


def test_mock_state_proxies_to_hub(auth_client):
    """When mock-hub is reachable, /api/mock/state returns its data."""
    fake_state = {"moisture": 55.0, "weather": {"condition": "sunny"}}
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = fake_state

    with patch("httpx.AsyncClient") as mock_cls:
        instance = AsyncMock()
        instance.__aenter__.return_value = instance
        instance.__aexit__.return_value = False
        instance.get.return_value = mock_resp
        mock_cls.return_value = instance

        resp = auth_client.get("/api/mock/state")

    assert resp.status_code == 200
    assert resp.json()["moisture"] == 55.0


# ── Schedule CRUD triggers reload ─────────────────────────────────────────────

def test_create_schedule_triggers_reload(auth_client):
    """POST /schedules calls reload_schedules after commit."""
    # First create a zone to reference
    zone_resp = auth_client.post("/api/zones", json={
        "name": "SchedReloadZone",
        "valve_device_id": "v-sched",
        "sensor_device_id": "s-sched",
    })
    assert zone_resp.status_code == 201
    zone_id = zone_resp.json()["id"]

    with patch("app.services.scheduler.reload_schedules", new=AsyncMock()) as mock_reload:
        resp = auth_client.post("/api/schedules", json={
            "zone_id": zone_id,
            "days_of_week": [1, 3, 5],
            "time_local": "07:00",
            "duration_min": 15.0,
        })
        assert resp.status_code == 201
        mock_reload.assert_awaited_once()


def test_delete_schedule_triggers_reload(auth_client):
    """DELETE /schedules/{id} calls reload_schedules."""
    zone_resp = auth_client.post("/api/zones", json={
        "name": "SchedDeleteZone",
        "valve_device_id": "v-del",
        "sensor_device_id": "s-del",
    })
    zone_id = zone_resp.json()["id"]

    sched_resp = auth_client.post("/api/schedules", json={
        "zone_id": zone_id,
        "days_of_week": [2],
        "time_local": "08:00",
        "duration_min": 5.0,
    })
    sched_id = sched_resp.json()["id"]

    with patch("app.services.scheduler.reload_schedules", new=AsyncMock()) as mock_reload:
        resp = auth_client.delete(f"/api/schedules/{sched_id}")
        assert resp.status_code == 204
        mock_reload.assert_awaited_once()
