"""
Onboarding progress API — PRD §7.3 BE-18.

GET  /api/onboarding/progress        — current step + snapshot (creates row if absent)
POST /api/onboarding/progress        — save step + snapshot
POST /api/onboarding/complete        — mark wizard complete
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import OnboardingProgress
from app.schemas.onboarding import OnboardingProgressOut, OnboardingProgressUpdate
from app.security.deps import get_current_user

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


async def _get_or_create(db: AsyncSession) -> OnboardingProgress:
    result = await db.execute(select(OnboardingProgress).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        row = OnboardingProgress()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/progress", response_model=OnboardingProgressOut)
async def get_progress(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    row = await _get_or_create(db)
    return OnboardingProgressOut.from_orm_with_flag(row)


@router.post("/progress", response_model=OnboardingProgressOut)
async def save_progress(
    body: OnboardingProgressUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    row = await _get_or_create(db)
    row.current_step = body.current_step
    if body.state_snapshot is not None:
        row.state_snapshot = body.state_snapshot
    await db.commit()
    await db.refresh(row)
    return OnboardingProgressOut.from_orm_with_flag(row)


@router.post("/complete", response_model=OnboardingProgressOut)
async def complete_onboarding(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    row = await _get_or_create(db)
    if row.completed_at is None:
        row.current_step = 9
        row.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(row)
    return OnboardingProgressOut.from_orm_with_flag(row)
