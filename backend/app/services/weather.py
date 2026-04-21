"""
Weather service.
- MOCK_MODE=true  → returns weather from mock-hub admin API
- MOCK_MODE=false → fetches from Open-Meteo (anonymous, no key required)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import settings

log = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_LAT = 45.65
DEFAULT_LON = 13.77


async def _get_coords() -> tuple[float, float]:
    try:
        from app.models.base import SessionLocal
        from app.models.tables import SiteSetting
        from sqlalchemy import select
        async with SessionLocal() as db:
            res_lat = await db.execute(select(SiteSetting).where(SiteSetting.key == "location_lat"))
            res_lon = await db.execute(select(SiteSetting).where(SiteSetting.key == "location_lon"))
            lat_row = res_lat.scalar_one_or_none()
            lon_row = res_lon.scalar_one_or_none()
            if lat_row and lon_row:
                return float(lat_row.value), float(lon_row.value)
    except Exception as exc:
        log.warning("Could not read location from DB: %s", exc)
    return DEFAULT_LAT, DEFAULT_LON


@dataclass
class WeatherForecast:
    rain_next_12h_mm: float
    condition: str      # sunny | cloudy | rainy
    temp_c: float


async def get_forecast() -> WeatherForecast:
    if settings.mock_mode:
        return await _mock_forecast()
    return await _open_meteo_forecast()


async def _mock_forecast() -> WeatherForecast:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get("http://mock-hub:8765/state")
            r.raise_for_status()
            data = r.json()
            w = data.get("weather", {})
            return WeatherForecast(
                rain_next_12h_mm=float(w.get("rain_forecast_mm", 0.0)),
                condition=w.get("condition", "sunny"),
                temp_c=float(w.get("temp_c", 20.0)),
            )
    except Exception as exc:
        log.warning("Could not reach mock-hub for weather: %s — using clear skies", exc)
        return WeatherForecast(rain_next_12h_mm=0.0, condition="sunny", temp_c=20.0)


async def _open_meteo_forecast() -> WeatherForecast:
    try:
        lat, lon = await _get_coords()
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "precipitation,temperature_2m",
            "forecast_days": 1,
            "timezone": settings.timezone,
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(OPEN_METEO_URL, params=params)
            r.raise_for_status()
            data = r.json()

        hourly = data.get("hourly", {})
        precip = hourly.get("precipitation", [])
        temps = hourly.get("temperature_2m", [])

        from datetime import datetime, timezone
        now_hour = datetime.now(timezone.utc).hour
        # Sum precipitation over next 12 hours
        rain_12h = sum(precip[now_hour:now_hour + 12]) if precip else 0.0
        temp_c = temps[now_hour] if temps else 20.0

        if rain_12h >= 2.0:
            condition = "rainy"
        elif rain_12h >= 0.5:
            condition = "cloudy"
        else:
            condition = "sunny"

        return WeatherForecast(
            rain_next_12h_mm=round(rain_12h, 1),
            condition=condition,
            temp_c=round(temp_c, 1),
        )
    except Exception as exc:
        log.error("Open-Meteo fetch failed: %s — assuming no rain", exc)
        return WeatherForecast(rain_next_12h_mm=0.0, condition="sunny", temp_c=20.0)
