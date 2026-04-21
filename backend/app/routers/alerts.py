"""
Alert API — PRD §7.3.
GET  /api/alerts               list (filter by status)
POST /api/alerts/:id/acknowledge
POST /api/alerts               (internal / mock: create alert manually)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import get_db
from app.models.tables import Alert
from app.schemas.alert import AlertOut, AlertCreate
from app.security.deps import get_current_user
from app.services import alert_engine

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# GET /api/alerts
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AlertOut])
async def list_alerts(
    status: Optional[str] = Query(None, description="active | acknowledged | resolved"),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    stmt = select(Alert).order_by(Alert.triggered_at.desc())

    if status == "active":
        stmt = stmt.where(
            and_(Alert.resolved_at.is_(None), Alert.acknowledged_at.is_(None))
        )
    elif status == "acknowledged":
        stmt = stmt.where(
            and_(Alert.resolved_at.is_(None), Alert.acknowledged_at.isnot(None))
        )
    elif status == "resolved":
        stmt = stmt.where(Alert.resolved_at.isnot(None))

    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# POST /api/alerts/:id/acknowledge
# ---------------------------------------------------------------------------

@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    alert = await alert_engine.acknowledge(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


# ---------------------------------------------------------------------------
# POST /api/alerts — create alert (mock mode or internal use)
# ---------------------------------------------------------------------------

@router.post("", response_model=AlertOut, status_code=201)
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not settings.mock_mode:
        raise HTTPException(status_code=403, detail="Manual alert creation only allowed in mock mode")

    alert = await alert_engine.emit(
        db,
        kind=body.kind,
        message=body.message,
        zone_id=body.zone_id,
        device_id=body.device_id,
    )
    return alert
