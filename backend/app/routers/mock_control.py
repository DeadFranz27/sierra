"""
Mock control endpoints — auth-gated, only active when MOCK_MODE=true.
Proxies admin commands to mock-hub at http://mock-hub:8765.
Returns 404 in production mode.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.security.deps import get_current_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/mock", tags=["mock"])

MOCK_HUB = "http://mock-hub:8765"


def _require_mock():
    if not settings.mock_mode:
        raise HTTPException(status_code=404, detail="Not found")


class ScenarioRequest(BaseModel):
    name: str


class MoistureSetRequest(BaseModel):
    value: float


class TimeScaleRequest(BaseModel):
    scale: int


class WeatherSetRequest(BaseModel):
    condition: str
    rain_forecast_mm: Optional[float] = None
    temp_c: Optional[float] = None


@router.get("/state")
async def mock_state(_: str = Depends(get_current_user)):
    _require_mock()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.get(f"{MOCK_HUB}/state")
        r.raise_for_status()
        return r.json()


@router.post("/scenario")
async def set_scenario(body: ScenarioRequest, _: str = Depends(get_current_user)):
    _require_mock()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{MOCK_HUB}/scenario/{body.name}")
        r.raise_for_status()
        return r.json()


@router.post("/moisture/set")
async def set_moisture(body: MoistureSetRequest, _: str = Depends(get_current_user)):
    _require_mock()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{MOCK_HUB}/moisture/set", json={"value": body.value})
        r.raise_for_status()
        return r.json()


@router.post("/time/scale")
async def set_time_scale(body: TimeScaleRequest, _: str = Depends(get_current_user)):
    _require_mock()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{MOCK_HUB}/time/scale", json={"scale": body.scale})
        r.raise_for_status()
        return r.json()


@router.post("/weather/set")
async def set_weather(body: WeatherSetRequest, _: str = Depends(get_current_user)):
    _require_mock()
    payload = body.model_dump(exclude_none=True)
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{MOCK_HUB}/weather/set", json=payload)
        r.raise_for_status()
        return r.json()


@router.post("/reset")
async def reset_mock(_: str = Depends(get_current_user)):
    _require_mock()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{MOCK_HUB}/reset")
        r.raise_for_status()
        return r.json()
