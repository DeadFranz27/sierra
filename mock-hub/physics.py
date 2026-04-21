"""
Soil moisture physics model.

moisture(t+dt) = moisture(t) + Δwater − Δet − Δdrainage + noise

All rates are per real second, scaled by time_scale for demo mode.
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Optional


# Evapotranspiration rates in %/hour
_ET_RATES = {
    "sunny":  0.5,
    "cloudy": 0.2,
    "rainy":  -0.1,  # rain adds moisture
}
_ET_NIGHT_FACTOR = 0.5
_DRAINAGE_THRESHOLD = 80.0   # % above which excess drains
_DRAINAGE_RATE = 1.0          # %/hour when oversaturated
_WATER_RATE = 0.15            # %/second while valve is open
_NOISE_SIGMA = 0.3            # gaussian noise std dev


@dataclass
class WeatherState:
    condition: str = "sunny"   # sunny | cloudy | rainy
    temp_c: float = 22.0
    rain_forecast_mm: float = 0.0
    is_night: bool = False


@dataclass
class PhysicsState:
    moisture: float = 45.0
    valve_open: bool = False
    valve_open_since: Optional[float] = None   # monotonic time
    valve_duration_s: int = 0
    weather: WeatherState = field(default_factory=WeatherState)
    time_scale: int = 1
    sensor_fail: bool = False
    network_fail: bool = False
    start_time: float = field(default_factory=time.monotonic)
    last_tick: float = field(default_factory=time.monotonic)

    def tick(self) -> float:
        """Advance physics by elapsed wall-clock time, return new moisture reading."""
        now = time.monotonic()
        dt_real = now - self.last_tick
        self.last_tick = now

        dt_sim = dt_real * self.time_scale  # simulated seconds

        if self.valve_open:
            # Check if duration has expired (in real seconds — valve timing is wall-clock)
            if self.valve_open_since is not None:
                elapsed_real = now - self.valve_open_since
                if elapsed_real >= self.valve_duration_s:
                    self.valve_open = False
                    self.valve_open_since = None
                else:
                    self.moisture += _WATER_RATE * dt_real  # water rate in real time

        # ET in %/hour → convert to per sim-second
        et_rate_h = _ET_RATES.get(self.weather.condition, 0.2)
        if self.weather.is_night:
            et_rate_h *= _ET_NIGHT_FACTOR
        et_delta = (et_rate_h / 3600.0) * dt_sim

        # Drainage when oversaturated
        drainage_delta = 0.0
        if self.moisture > _DRAINAGE_THRESHOLD:
            drainage_delta = (_DRAINAGE_RATE / 3600.0) * dt_sim

        noise = random.gauss(0, _NOISE_SIGMA) * (dt_sim / 60.0)  # scale noise with dt

        self.moisture = self.moisture - et_delta - drainage_delta + noise
        self.moisture = max(0.0, min(100.0, self.moisture))
        return round(self.moisture, 1)

    def open_valve(self, duration_s: int) -> None:
        self.valve_open = True
        self.valve_open_since = time.monotonic()
        self.valve_duration_s = duration_s

    def close_valve(self) -> None:
        self.valve_open = False
        self.valve_open_since = None
        self.valve_duration_s = 0

    @property
    def uptime_s(self) -> int:
        return int(time.monotonic() - self.start_time)
