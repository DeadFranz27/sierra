"""
Sierra mock-hub entry point.
Runs two concurrent services:
  1. MQTT publisher/subscriber (simulates real ESPHome firmware)
  2. Admin HTTP API on 127.0.0.1:8765 (loopback only, for demo control)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

import uvicorn

from admin_api import create_admin_app
from mqtt_client import run_mqtt
from physics import PhysicsState, WeatherState

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

SCENARIOS_DIR = Path(__file__).parent / "scenarios"


def _load_scenario(name: str) -> PhysicsState:
    path = SCENARIOS_DIR / f"{name}.json"
    if not path.exists():
        log.warning("Scenario '%s' not found — falling back to default", name)
        path = SCENARIOS_DIR / "default.json"
    scenario = json.loads(path.read_text())
    w = scenario.get("weather", {})
    time_scale = int(os.environ.get("MOCK_TIME_SCALE", scenario.get("time_scale", 1)))
    return PhysicsState(
        moisture=float(scenario["initial_moisture"]),
        time_scale=time_scale,
        sensor_fail=bool(scenario.get("sensor_fail", False)),
        network_fail=bool(scenario.get("network_fail", False)),
        weather=WeatherState(
            condition=w.get("condition", "sunny"),
            temp_c=float(w.get("temp_c", 22.0)),
            rain_forecast_mm=float(w.get("rain_forecast_mm", 0.0)),
            is_night=bool(w.get("is_night", False)),
        ),
    )


async def main() -> None:
    scenario_name = os.environ.get("MOCK_SCENARIO", "default")
    state = _load_scenario(scenario_name)
    log.info("Mock hub starting — scenario=%s moisture=%.1f%% time_scale=%dx",
             scenario_name, state.moisture, state.time_scale)

    admin_app = create_admin_app(state)
    admin_config = uvicorn.Config(
        admin_app,
        host="127.0.0.1",   # loopback only — no LAN exposure
        port=8765,
        log_level="warning",
    )
    admin_server = uvicorn.Server(admin_config)

    await asyncio.gather(
        run_mqtt(state),
        admin_server.serve(),
    )


if __name__ == "__main__":
    asyncio.run(main())
