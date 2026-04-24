from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import SiteSetting
from app.security.deps import get_current_user
from app.security.rate_limit import limiter

router = APIRouter(prefix="/settings", tags=["settings"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_UA = "Sierra-Hub/0.3 (https://github.com/DeadFranz27/sierra)"


class LocationOut(BaseModel):
    label: str
    latitude: float
    longitude: float


class LocationIn(BaseModel):
    label: str
    latitude: float
    longitude: float


class GeocodeHit(BaseModel):
    label: str
    latitude: float
    longitude: float


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
    return LocationOut(label=label or "", latitude=float(lat), longitude=float(lon))


@router.put("/location", response_model=LocationOut)
async def set_location(
    body: LocationIn,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    await _set_setting(db, "location_label", body.label)
    await _set_setting(db, "location_lat", str(body.latitude))
    await _set_setting(db, "location_lon", str(body.longitude))
    return LocationOut(label=body.label, latitude=body.latitude, longitude=body.longitude)


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
