from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import get_db
from app.models.tables import Schedule, Zone
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate
from app.security.deps import get_current_user
from app.services import scheduler as sched_svc

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    zone_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    q = select(Schedule)
    if zone_id:
        q = q.where(Schedule.zone_id == zone_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Zone).where(Zone.id == body.zone_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    sched = Schedule(**body.model_dump())
    db.add(sched)
    await db.commit()
    await db.refresh(sched)
    await sched_svc.reload_schedules(settings.timezone)
    return sched


@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    sched = await _get_schedule_or_404(db, schedule_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sched, k, v)
    await db.commit()
    await db.refresh(sched)
    await sched_svc.reload_schedules(settings.timezone)
    return sched


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    sched = await _get_schedule_or_404(db, schedule_id)
    await db.delete(sched)
    await db.commit()
    await sched_svc.reload_schedules(settings.timezone)


async def _get_schedule_or_404(db: AsyncSession, schedule_id: str) -> Schedule:
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if sched is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return sched
