from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from timezonefinder import TimezoneFinder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import SiteSetting
from app.security.deps import get_current_user
from app.security.rate_limit import limiter

router = APIRouter(prefix="/settings", tags=["settings"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_UA = "Sierra-Hub/0.3 (https://github.com/DeadFranz27/sierra)"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Singleton — first call loads ~50MB of polygon data into RSS, then is fast.
_tzfinder = TimezoneFinder()


def _tz_for(lat: float, lon: float) -> str:
    return _tzfinder.timezone_at(lat=lat, lng=lon) or "UTC"


class LocationOut(BaseModel):
    label: str
    latitude: float
    longitude: float
    timezone: str  # IANA tz id, e.g. "Europe/Rome" — derived from lat/lon


class LocationIn(BaseModel):
    label: str
    latitude: float
    longitude: float


class GeocodeHit(BaseModel):
    label: str
    latitude: float
    longitude: float


class WeatherHistoryPoint(BaseModel):
    time: str
    precipitation_mm: float
    wind_kmh: float


class WeatherHistoryOut(BaseModel):
    points: list[WeatherHistoryPoint]


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(SiteSetting(key=key, value=value))
    await db.commit()


@router.get("/location", response_model=LocationOut | None)
async def get_location(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    label = await _get_setting(db, "location_label")
    lat = await _get_setting(db, "location_lat")
    lon = await _get_setting(db, "location_lon")
    if lat is None or lon is None:
        return None
    tz = await _get_setting(db, "location_tz")
    if not tz:
        # Backfill for locations stored before tz tracking landed.
        tz = _tz_for(float(lat), float(lon))
        await _set_setting(db, "location_tz", tz)
    return LocationOut(label=label or "", latitude=float(lat), longitude=float(lon), timezone=tz)


@router.put("/location", response_model=LocationOut)
async def set_location(
    body: LocationIn,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    tz = _tz_for(body.latitude, body.longitude)
    await _set_setting(db, "location_label", body.label)
    await _set_setting(db, "location_lat", str(body.latitude))
    await _set_setting(db, "location_lon", str(body.longitude))
    await _set_setting(db, "location_tz", tz)
    return LocationOut(label=body.label, latitude=body.latitude, longitude=body.longitude, timezone=tz)


@router.get("/geocode", response_model=GeocodeHit | None)
@limiter.limit("20/minute")
async def geocode(
    request: Request,
    q: str = Query(min_length=1, max_length=200),
    _: str = Depends(get_current_user),
):
    """Server-side proxy to Nominatim.

    The browser cannot reach nominatim.openstreetmap.org directly because
    the CSP pins connect-src to 'self'. Proxying also lets us set a proper
    User-Agent (required by the Nominatim usage policy) and rate-limit
    per-client.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"format": "json", "limit": "1", "q": q.strip()},
                headers={"User-Agent": NOMINATIM_UA, "Accept": "application/json"},
            )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Geocoding upstream error: {e}",
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Geocoding upstream returned {resp.status_code}",
        )
    data = resp.json()
    if not isinstance(data, list) or not data:
        return None
    first = data[0]
    try:
        return GeocodeHit(
            label=str(first["display_name"]),
            latitude=float(first["lat"]),
            longitude=float(first["lon"]),
        )
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Geocoding upstream returned unexpected shape",
        )


@router.get("/weather-history", response_model=WeatherHistoryOut)
@limiter.limit("60/minute")
async def weather_history(
    request: Request,
    window_hours: int = Query(24, ge=1, le=336, alias="window"),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Server-side proxy to Open-Meteo for dashboard weather charts.

    Uses the hub's saved location (PUT /api/settings/location). Returns
    hourly precipitation + wind for the requested window, centred on now
    (half in the past, half in the forecast). Proxied because the browser
    cannot reach api.open-meteo.com under the strict CSP.
    """
    lat = await _get_setting(db, "location_lat")
    lon = await _get_setting(db, "location_lon")
    if lat is None or lon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hub location is not set",
        )
    days = 1 if window_hours <= 24 else max(1, (window_hours + 23) // 24)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": "precipitation,wind_speed_10m",
                    "forecast_days": days,
                    "past_days": days,
                    "timezone": "auto",
                },
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Weather upstream error: {e}",
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Weather upstream returned {resp.status_code}",
        )
    data = resp.json()
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    precip = hourly.get("precipitation") or []
    wind = hourly.get("wind_speed_10m") or []
    points = [
        WeatherHistoryPoint(
            time=str(times[i]),
            precipitation_mm=float(precip[i]) if i < len(precip) and precip[i] is not None else 0.0,
            wind_kmh=float(wind[i]) if i < len(wind) and wind[i] is not None else 0.0,
        )
        for i in range(min(len(times), len(precip), len(wind)))
    ]
    return WeatherHistoryOut(points=points)
