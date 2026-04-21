from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import SiteSetting
from app.security.deps import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


class LocationOut(BaseModel):
    label: str
    latitude: float
    longitude: float


class LocationIn(BaseModel):
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
