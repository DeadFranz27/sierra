from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import PlantProfile
from app.schemas.profile import PlantProfileCreate, PlantProfileOut, PlantProfileUpdate
from app.security.deps import get_current_user

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[PlantProfileOut])
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(PlantProfile).order_by(PlantProfile.is_preset.desc(), PlantProfile.name))
    return result.scalars().all()


@router.get("/{profile_id}", response_model=PlantProfileOut)
async def get_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await _get_profile_or_404(db, profile_id)


@router.post("", response_model=PlantProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: PlantProfileCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    try:
        body.validate_thresholds()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    profile = PlantProfile(
        id=str(uuid.uuid4()),
        is_preset=False,
        created_at=datetime.now(timezone.utc),
        **body.model_dump(),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=PlantProfileOut)
async def update_profile(
    profile_id: str,
    body: PlantProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    profile = await _get_profile_or_404(db, profile_id)
    if profile.is_preset:
        raise HTTPException(status_code=403, detail="Preset profiles are read-only. Fork it to create a custom profile.")

    try:
        body.validate_thresholds()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    for k, v in body.model_dump().items():
        setattr(profile, k, v)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    profile = await _get_profile_or_404(db, profile_id)
    if profile.is_preset:
        raise HTTPException(status_code=403, detail="Preset profiles cannot be deleted.")
    await db.delete(profile)
    await db.commit()


async def _get_profile_or_404(db: AsyncSession, profile_id: str) -> PlantProfile:
    result = await db.execute(select(PlantProfile).where(PlantProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Plant profile not found")
    return profile
