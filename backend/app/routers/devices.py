"""
Device lifecycle API — PRD §7.3 BE-19 to BE-27.
Covers: list, detail, candidates, pair, unpair, factory-reset,
        reprovision-wifi, restart, clear-error, QR.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.tables import Device, DeviceCandidate, AuditLog
from app.schemas.device import (
    DeviceOut, DeviceAnnounceIn, DeviceCandidateOut, PairRequest, PairResponse
)
from app.security.rate_limit import limiter

CANDIDATE_TTL_SECONDS = 300
from app.security.auth import hash_password
from app.security.deps import get_current_user
from app.services import mosquitto_admin
from app.services.mqtt_bridge import get_valve_state, publish_command

log = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


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
# POST /api/devices/announce — device self-announces while in PAIRING (BE-19)
# ---------------------------------------------------------------------------
#
# Unauthenticated by design: the device has no credentials yet. The endpoint
# is reachable only from the LAN (nginx already restricts the API surface)
# and is rate-limited per source IP. We trust the *source IP* over anything
# in the body so a misconfigured or malicious device can't claim a peer's
# address. Each announce extends a short TTL; stale candidates are filtered
# out by GET /candidates.

@router.post("/announce", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def announce_device(
    request: Request,
    # Explicit Annotated[..., Body()] is required because:
    #   1. `from __future__ import annotations` turns every annotation
    #      into a string forward reference;
    #   2. slowapi's @limiter decorator wraps the handler in a way that
    #      breaks FastAPI's automatic body inference for Pydantic models.
    # Without this combo, requests 422 with {"loc":["query","body"]}
    # because the model is treated as a query param.
    body: Annotated[DeviceAnnounceIn, Body()],
    db: AsyncSession = Depends(get_db),
):
    if body.kind not in ("sense", "valve"):
        raise HTTPException(status_code=422, detail="kind must be sense or valve")

    source_ip = request.client.host if request.client else None
    if not source_ip:
        raise HTTPException(status_code=400, detail="cannot determine source ip")

    now = _now()
    expires = now + timedelta(seconds=CANDIDATE_TTL_SECONDS)

    # If this MAC is already paired, ignore the announce silently — the
    # device just hasn't realised yet (creds not flushed to NVS, etc).
    paired = await db.execute(select(Device).where(Device.mac == body.mac))
    if paired.scalar_one_or_none():
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    existing = await db.execute(
        select(DeviceCandidate).where(DeviceCandidate.mac == body.mac)
    )
    candidate = existing.scalar_one_or_none()
    if candidate:
        candidate.kind = body.kind
        candidate.ip = source_ip
        candidate.port = body.port
        candidate.hostname = body.hostname
        candidate.firmware_version = body.firmware_version
        candidate.last_seen_at = now
        candidate.expires_at = expires
        # If a previous pair attempt was claimed but the device is still
        # announcing, the pair never completed (backend crashed, network
        # blip mid-credential-push). Un-claim so it can be re-paired.
        if candidate.claimed_at:
            candidate.claimed_at = None
    else:
        db.add(DeviceCandidate(
            kind=body.kind,
            mac=body.mac,
            ip=source_ip,
            port=body.port,
            hostname=body.hostname,
            firmware_version=body.firmware_version,
            announced_at=now,
            last_seen_at=now,
            expires_at=expires,
        ))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# GET /api/devices/candidates — devices awaiting pairing (announced, unclaimed)
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
        if candidate.expires_at < _now():
            raise HTTPException(status_code=410, detail="Candidate expired — wait for next announce")
        ip = candidate.ip
        device_port = candidate.port
    elif body.ip:
        ip = body.ip
    else:
        raise HTTPException(status_code=422, detail="Provide device_id or ip")

    # Base URL for reaching the device HTTP API
    _base_url = f"http://{ip}:{device_port}" if device_port else f"http://{ip}"

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

    # If the user supplied a code (manual-IP fallback path, or older firmware
    # that exposes pairing_code_hash), verify it. With zero-touch pairing the
    # candidate's freshness + reachability act as the trust signal (TOFU).
    if body.pairing_code:
        code_hash = hashlib.sha256(body.pairing_code.encode()).hexdigest()
        if info.get("pairing_code_hash") and info["pairing_code_hash"] != code_hash:
            await _write_audit(db, "device_pair", current_user, outcome="failure",
                                details={"ip": ip, "reason": "wrong_code"})
            raise HTTPException(status_code=403, detail="Pairing code mismatch")
    elif not candidate:
        # Zero-touch only makes sense when the device has announced itself.
        # A bare IP with no code could be anything on the LAN.
        raise HTTPException(
            status_code=422,
            detail="Manual-IP pairing requires a pairing code",
        )

    kind = info.get("kind", "sense")
    mac = info.get("mac")
    firmware = info.get("firmware", "unknown")

    # Check not already paired by MAC
    if mac:
        existing = await db.execute(select(Device).where(Device.mac == mac))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Device with this MAC already paired")

    # Generate per-device MQTT credentials (BE-21, BE-27)
    mqtt_username = f"sierra-{kind}-{secrets.token_hex(4)}"
    mqtt_password = secrets.token_urlsafe(24)
    api_key = secrets.token_urlsafe(32)

    # Register the user with mosquitto BEFORE handing creds to the device, so
    # the broker accepts the very first connect attempt.
    try:
        mosquitto_admin.add_user(mqtt_username, mqtt_password)
    except Exception as exc:
        await _write_audit(db, "device_pair", current_user, outcome="failure",
                            details={"ip": ip, "error": f"mosquitto: {exc}"})
        raise HTTPException(status_code=500, detail=f"Could not register MQTT user: {exc}")

    # Push credentials to device over HTTP. The X-Pairing-Code header is
    # only sent when the user provided a code (manual-IP fallback). Firmware
    # accepts unauthenticated credential pushes too — it can only be reached
    # by whoever the device announced to, so the source IP is the trust root.
    try:
        push_headers: dict[str, str] = {}
        if body.pairing_code:
            push_headers["X-Pairing-Code"] = body.pairing_code
        async with httpx.AsyncClient(timeout=5.0) as client:
            creds_r = await client.post(
                f"{_base_url}/device/credentials",
                json={
                    "mqtt_username": mqtt_username,
                    "mqtt_password": mqtt_password,
                },
                headers=push_headers,
            )
            creds_r.raise_for_status()
            log.info("Credentials pushed to device at %s", _base_url)
    except Exception as exc:
        # Device never got the creds — roll back the broker registration.
        try:
            mosquitto_admin.remove_user(mqtt_username)
        except Exception as cleanup_exc:
            log.warning("mosquitto rollback failed for %s: %s", mqtt_username, cleanup_exc)
        await _write_audit(db, "device_pair", current_user, outcome="failure",
                            details={"ip": ip, "error": str(exc)})
        raise HTTPException(status_code=502, detail=f"Failed to deliver credentials: {exc}")

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

    if _is_online(device):
        try:
            await publish_command(device.mqtt_username or device_id, {"action": "unpair"})
        except Exception as exc:
            log.warning("Could not send unpair command to device %s: %s", device_id, exc)

    if device.mqtt_username:
        try:
            mosquitto_admin.remove_user(device.mqtt_username)
        except Exception as exc:
            log.warning("mosquitto: remove_user(%s) failed: %s", device.mqtt_username, exc)

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

    if not _is_online(device):
        raise HTTPException(status_code=409, detail="Device is offline — factory reset requires online device")

    try:
        reset_token = secrets.token_urlsafe(16)
        await publish_command(
            device.mqtt_username or device_id,
            {"action": "factory_reset", "auth_token": reset_token},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send reset command: {exc}")

    if device.mqtt_username:
        try:
            mosquitto_admin.remove_user(device.mqtt_username)
        except Exception as exc:
            log.warning("mosquitto: remove_user(%s) failed: %s", device.mqtt_username, exc)

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
# Legacy alias kept for backward compatibility
# ---------------------------------------------------------------------------

@router.get("/status", response_model=list[DeviceOut], include_in_schema=False)
async def device_status_legacy(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await list_devices(db, _)
