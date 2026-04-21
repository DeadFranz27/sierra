"""
Admin HTTP API for mock-hub — bound to 127.0.0.1:8765 only.
No auth required: loopback-only binding is the security boundary.
Used by developers and demo scripts only.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator

from physics import PhysicsState, WeatherState

log = logging.getLogger(__name__)

SCENARIOS_DIR = Path(__file__).parent / "scenarios"


class MoisturePayload(BaseModel):
    value: float

    @field_validator("value")
    @classmethod
    def in_range(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("value must be between 0 and 100")
        return v


class TimeScalePayload(BaseModel):
    scale: int

    @field_validator("scale")
    @classmethod
    def valid_scale(cls, v: int) -> int:
        if v < 1 or v > 3600:
            raise ValueError("scale must be between 1 and 3600")
        return v


class WeatherPayload(BaseModel):
    condition: str = None
    temp_c: float = None
    rain_forecast_mm: float = None
    is_night: bool = None

    @field_validator("condition")
    @classmethod
    def valid_condition(cls, v: str) -> str:
        if v is not None and v not in ("sunny", "cloudy", "rainy"):
            raise ValueError("condition must be sunny, cloudy, or rainy")
        return v


def create_admin_app(state: PhysicsState) -> FastAPI:
    app = FastAPI(title="Sierra mock-hub admin", docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/state")
    async def get_state():
        return {
            "moisture": round(state.moisture, 1),
            "valve_open": state.valve_open,
            "sensor_fail": state.sensor_fail,
            "network_fail": state.network_fail,
            "time_scale": state.time_scale,
            "weather": {
                "condition": state.weather.condition,
                "temp_c": state.weather.temp_c,
                "rain_forecast_mm": state.weather.rain_forecast_mm,
                "is_night": state.weather.is_night,
            },
            "uptime_s": state.uptime_s,
        }

    @app.post("/scenario/{name}")
    async def set_scenario(name: str):
        path = SCENARIOS_DIR / f"{name}.json"
        if not path.exists():
            available = [p.stem for p in SCENARIOS_DIR.glob("*.json")]
            raise HTTPException(status_code=404, detail=f"Unknown scenario '{name}'. Available: {available}")
        scenario = json.loads(path.read_text())
        state.moisture = float(scenario["initial_moisture"])
        state.time_scale = int(scenario.get("time_scale", 1))
        state.sensor_fail = bool(scenario.get("sensor_fail", False))
        state.network_fail = bool(scenario.get("network_fail", False))
        w = scenario.get("weather", {})
        state.weather = WeatherState(
            condition=w.get("condition", "sunny"),
            temp_c=float(w.get("temp_c", 22.0)),
            rain_forecast_mm=float(w.get("rain_forecast_mm", 0.0)),
            is_night=bool(w.get("is_night", False)),
        )
        log.info("Scenario switched to '%s'", name)
        return {"scenario": name, "moisture": state.moisture}

    @app.post("/moisture/set")
    async def set_moisture(body: MoisturePayload):
        state.moisture = body.value
        return {"moisture": state.moisture}

    @app.post("/time/scale")
    async def set_time_scale(body: TimeScalePayload):
        state.time_scale = body.scale
        return {"time_scale": state.time_scale}

    @app.post("/weather/set")
    async def set_weather(body: WeatherPayload):
        if body.condition is not None:
            state.weather.condition = body.condition
        if body.temp_c is not None:
            state.weather.temp_c = body.temp_c
        if body.rain_forecast_mm is not None:
            state.weather.rain_forecast_mm = body.rain_forecast_mm
        if body.is_night is not None:
            state.weather.is_night = body.is_night
        return {"weather": {
            "condition": state.weather.condition,
            "temp_c": state.weather.temp_c,
            "rain_forecast_mm": state.weather.rain_forecast_mm,
            "is_night": state.weather.is_night,
        }}

    @app.post("/fail/sensor")
    async def fail_sensor():
        state.sensor_fail = True
        return {"sensor_fail": True}

    @app.post("/fail/network")
    async def fail_network():
        state.network_fail = True
        return {"network_fail": True}

    @app.post("/reset")
    async def reset():
        path = SCENARIOS_DIR / "default.json"
        scenario = json.loads(path.read_text())
        state.moisture = float(scenario["initial_moisture"])
        state.time_scale = 1
        state.sensor_fail = False
        state.network_fail = False
        state.close_valve()
        w = scenario.get("weather", {})
        state.weather = WeatherState(
            condition=w.get("condition", "sunny"),
            temp_c=float(w.get("temp_c", 22.0)),
            rain_forecast_mm=float(w.get("rain_forecast_mm", 0.0)),
            is_night=bool(w.get("is_night", False)),
        )
        log.info("State reset to default scenario")
        return {"reset": True, "moisture": state.moisture}

    return app
