"""
Device lifecycle API — PRD §7.3 BE-19 to BE-27.
Covers: list, detail, candidates, pair, unpair, factory-reset,
        reprovision-wifi, restart, clear-error, QR, mock announce.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import get_db
from app.models.tables import Device, DeviceCandidate, AuditLog
from app.schemas.device import (
    DeviceOut, DeviceCandidateOut, PairRequest, PairResponse, AnnounceRequest
)
from app.security.auth import hash_password
from app.security.deps import get_current_user
from app.services.mqtt_bridge import get_valve_state, publish_command

log = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_mock():
    if not settings.mock_mode:
        raise HTTPException(status_code=404, detail="Not found")


async def _get_device_or_404(db: AsyncSession, device_id: str) -> Device:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


async def _get_candidate_or_404(db: AsyncSession, candidate_id: str) -> DeviceCandidate:
    result = await db.execute(
        select(DeviceCandidate).where(DeviceCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Device candidate not found")
    return candidate


async def _write_audit(
    db: AsyncSession,
    action: str,
    username: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    device_id: Optional[str] = None,
    outcome: str = "success",
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    entry = AuditLog(
        action=action,
        username=username,
        target_type=target_type,
        target_id=target_id,
        device_id=device_id,
        outcome=outcome,
        details=details or {},
        ip_address=ip_address,
    )
    db.add(entry)
    await db.commit()


def _is_online(device: Device) -> bool:
    if not device.last_seen:
        return False
    return (_now() - device.last_seen).total_seconds() < 90


# ---------------------------------------------------------------------------
# GET /api/devices — list all paired devices
# ---------------------------------------------------------------------------

@router.get("", response_model=list[DeviceOut])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    out = []
    for d in devices:
        item = DeviceOut.model_validate(d)
        if d.kind in ("hub", "valve"):
            item.valve_state = get_valve_state()
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# GET /api/devices/candidates — mDNS-discovered devices awaiting pairing
# ---------------------------------------------------------------------------

@router.get("/candidates", response_model=list[DeviceCandidateOut])
async def list_candidates(
    kind: Optional[str] = Query(None, description="sense | valve"),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    stmt = select(DeviceCandidate).where(
        DeviceCandidate.claimed_at.is_(None),
        DeviceCandidate.expires_at > _now(),
    )
    if kind:
        stmt = stmt.where(DeviceCandidate.kind == kind)
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /api/devices/{id} — device detail
# ---------------------------------------------------------------------------

@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)
    item = DeviceOut.model_validate(device)
    if device.kind in ("hub", "valve"):
        item.valve_state = get_valve_state()
    return item


# ---------------------------------------------------------------------------
# POST /api/devices/pair — complete pairing (BE-21)
# ---------------------------------------------------------------------------

@router.post("/pair", response_model=PairResponse)
async def pair_device(
    body: PairRequest,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # Resolve candidate or fall back to manual IP
    candidate: Optional[DeviceCandidate] = None
    ip: Optional[str] = None
    device_port: Optional[int] = None

    if body.device_id:
        candidate = await _get_candidate_or_404(db, body.device_id)
        if candidate.claimed_at:
            raise HTTPException(status_code=409, detail="Device already paired")
        ip = candidate.ip
        device_port = candidate.port
    elif body.ip:
        ip = body.ip
    else:
        raise HTTPException(status_code=422, detail="Provide device_id or ip")

    # Base URL for reaching the device HTTP API
    _base_url = f"http://{ip}:{device_port}" if device_port else f"http://{ip}"

    # In mock mode: skip real HTTP to device, simulate successful pairing
    if settings.mock_mode:
        kind = candidate.kind if candidate else "sense"
        mac = candidate.mac if candidate else f"AA:BB:CC:DD:{secrets.token_hex(1).upper()}:{secrets.token_hex(1).upper()}"
        firmware = candidate.firmware_version if candidate else "1.0.0"
        hostname = candidate.hostname if candidate else f"sierra-{kind}-mock"
    else:
        # Reach device at /device/info
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                info_r = await client.get(f"{_base_url}/device/info")
                info_r.raise_for_status()
                info = info_r.json()
        except Exception as exc:
            await _write_audit(db, "device_pair", current_user, outcome="failure",
                                details={"ip": ip, "error": str(exc)})
            raise HTTPException(status_code=502, detail=f"Cannot reach device: {exc}")

        # Verify pairing code hash
        code_hash = hashlib.sha256(body.pairing_code.encode()).hexdigest()
        if info.get("pairing_code_hash") != code_hash:
            await _write_audit(db, "device_pair", current_user, outcome="failure",
                                details={"ip": ip, "reason": "wrong_code"})
            raise HTTPException(status_code=403, detail="Pairing code mismatch")

        kind = info.get("kind", "sense")
        mac = info.get("mac")
        firmware = info.get("firmware", "unknown")
        hostname = info.get("hostname")

    # Check not already paired by MAC
    if mac:
        existing = await db.execute(select(Device).where(Device.mac == mac))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Device with this MAC already paired")

    # Generate per-device MQTT credentials (BE-21, BE-27)
    mqtt_username = f"sierra-{kind}-{secrets.token_hex(4)}"
    mqtt_password = secrets.token_urlsafe(24)
    api_key = secrets.token_urlsafe(32)

    # Push credentials to device.
    # Always attempted when ip is provided (works with both real devices and local mock-devices).
    # In mock_mode without ip, skip silently.
    if ip:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                creds_r = await client.post(
                    f"{_base_url}/device/credentials",
                    json={
                        "mqtt_username": mqtt_username,
                        "mqtt_password": mqtt_password,
                    },
                    headers={"X-Pairing-Code": body.pairing_code},
                )
                creds_r.raise_for_status()
                log.info("Credentials pushed to device at %s", _base_url)
        except Exception as exc:
            if not settings.mock_mode:
                await _write_audit(db, "device_pair", current_user, outcome="failure",
                                    details={"ip": ip, "error": str(exc)})
                raise HTTPException(status_code=502, detail=f"Failed to deliver credentials: {exc}")
            log.warning("Could not push credentials to mock device at %s: %s (continuing in mock mode)", _base_url, exc)

    # Persist device
    device = Device(
        kind=kind,
        name=f"Sierra {kind.capitalize()} {mac[-5:] if mac else 'new'}",
        firmware_version=firmware,
        mac=mac,
        ip_address=ip,
        paired_at=_now(),
        pairing_method="mdns_code" if candidate else "manual_ip",
        mqtt_username=mqtt_username,
        mqtt_password_hash=hash_password(mqtt_password),
        api_key_hash=hash_password(api_key),
    )
    db.add(device)

    # Mark candidate claimed
    if candidate:
        candidate.claimed_at = _now()

    await db.commit()
    await db.refresh(device)

    await _write_audit(db, "device_pair", current_user,
                       target_type="device", target_id=device.id,
                       device_id=device.id,
                       details={"mac": mac, "kind": kind, "method": device.pairing_method})

    log.info("Device paired: %s %s (%s)", kind, mac, device.id)
    return PairResponse(device=DeviceOut.model_validate(device), message="Device paired successfully")


# ---------------------------------------------------------------------------
# POST /api/devices/{id}/unpair — revoke credentials, remove (BE-23)
# ---------------------------------------------------------------------------

@router.post("/{device_id}/unpair")
async def unpair_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)

    if _is_online(device) and not settings.mock_mode:
        try:
            await publish_command(device.mqtt_username or device_id, {"action": "unpair"})
        except Exception as exc:
            log.warning("Could not send unpair command to device %s: %s", device_id, exc)

    await _write_audit(db, "device_unpair", current_user,
                       target_type="device", target_id=device.id,
                       device_id=device.id,
                       details={"mac": device.mac, "kind": device.kind})

    await db.delete(device)
    await db.commit()
    return {"message": "Device unpaired"}


# ---------------------------------------------------------------------------
# POST /api/devices/{id}/factory-reset (BE-24)
# ---------------------------------------------------------------------------

@router.post("/{device_id}/factory-reset")
async def factory_reset_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)

    if not _is_online(device) and not settings.mock_mode:
        raise HTTPException(status_code=409, detail="Device is offline — factory reset requires online device")

    if not settings.mock_mode:
        try:
            reset_token = secrets.token_urlsafe(16)
            await publish_command(
                device.mqtt_username or device_id,
                {"action": "factory_reset", "auth_token": reset_token},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to send reset command: {exc}")

    await _write_audit(db, "device_factory_reset", current_user,
                       target_type="device", target_id=device.id,
                       device_id=device.id,
                       details={"mac": device.mac, "kind": device.kind})

    await db.delete(device)
    await db.commit()
    return {"message": "Factory reset command sent — device will be removed"}


# ---------------------------------------------------------------------------
# POST /api/devices/{id}/reprovision-wifi (BE-25)
# ---------------------------------------------------------------------------

@router.post("/{device_id}/reprovision-wifi")
async def reprovision_wifi(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)

    if not settings.mock_mode:
        if not _is_online(device):
            raise HTTPException(status_code=409, detail="Device is offline — cannot send reprovision command")
        try:
            await publish_command(
                device.mqtt_username or device_id,
                {"action": "reprovision_wifi"},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to send command: {exc}")

    await _write_audit(db, "device_reprovision_wifi", current_user,
                       target_type="device", target_id=device.id,
                       device_id=device.id)

    return {"message": "Reprovision WiFi command sent — device will enter AP mode"}


# ---------------------------------------------------------------------------
# POST /api/devices/{id}/restart
# ---------------------------------------------------------------------------

@router.post("/{device_id}/restart")
async def restart_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)

    if not settings.mock_mode:
        if not _is_online(device):
            raise HTTPException(status_code=409, detail="Device is offline")
        try:
            await publish_command(device.mqtt_username or device_id, {"action": "restart"})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to send command: {exc}")

    return {"message": "Restart command sent"}


# ---------------------------------------------------------------------------
# POST /api/devices/{id}/clear-error
# ---------------------------------------------------------------------------

@router.post("/{device_id}/clear-error")
async def clear_error(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)
    device.error_flag = False
    device.error_message = None
    await db.commit()
    return {"message": "Error cleared"}


# ---------------------------------------------------------------------------
# GET /api/devices/{id}/qr — QR payload for re-pairing transfer (BE-21)
# ---------------------------------------------------------------------------

@router.get("/{device_id}/qr")
async def device_qr(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    device = await _get_device_or_404(db, device_id)
    # Returns the URL encoded in QR — frontend renders it as QR image
    qr_payload = (
        f"sierra://pair"
        f"?mac={device.mac or ''}"
        f"&ip={device.ip_address or ''}"
        f"&kind={device.kind}"
        f"&fw={device.firmware_version}"
    )
    return {"qr_payload": qr_payload, "device_id": device.id}


# ---------------------------------------------------------------------------
# POST /api/devices/mock/announce — simulate mDNS announcement (MOCK_MODE)
# ---------------------------------------------------------------------------

@router.post("/mock/announce", response_model=DeviceCandidateOut)
async def mock_announce(
    body: AnnounceRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    _require_mock()

    mac = body.mac or (
        ":".join(f"{b:02X}" for b in secrets.token_bytes(6))
    )
    hostname = body.hostname or f"sierra-{body.kind}-{mac[-5:].replace(':', '').lower()}.local"

    # Upsert by MAC
    result = await db.execute(
        select(DeviceCandidate).where(DeviceCandidate.mac == mac)
    )
    candidate = result.scalar_one_or_none()

    if candidate:
        candidate.ip = body.ip
        candidate.port = body.port
        candidate.last_seen_at = _now()
        candidate.expires_at = _now() + timedelta(hours=24)
    else:
        candidate = DeviceCandidate(
            kind=body.kind,
            mac=mac,
            ip=body.ip,
            port=body.port,
            hostname=hostname,
            firmware_version=body.firmware_version,
            expires_at=_now() + timedelta(hours=24),
        )
        db.add(candidate)

    await db.commit()
    await db.refresh(candidate)
    log.info("Mock mDNS announce: %s %s @ %s", body.kind, mac, body.ip)
    return candidate


# ---------------------------------------------------------------------------
# Legacy alias kept for backward compatibility
# ---------------------------------------------------------------------------

@router.get("/status", response_model=list[DeviceOut], include_in_schema=False)
async def device_status_legacy(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await list_devices(db, _)
