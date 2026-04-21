"""
HTTP endpoints that a real Sierra ESP32 exposes during provisioning.

Active only in wifi_connected state (FW-S-14):
  GET  /device/info         → manifest {mac, kind, firmware, pairing_code_hash}
  POST /device/credentials  → Hub sends MQTT creds, device stores them → paired

Admin/debug endpoints (always active, loopback):
  GET  /admin/state
  POST /admin/lifecycle     → force lifecycle state for testing
  POST /admin/moisture      → override moisture (sense only)
  POST /admin/water_level   → toggle reservoir (valve only)
  POST /admin/reset         → back to ap_mode
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

from device_state import DeviceState, DeviceLifecycle

log = logging.getLogger(__name__)


class CredentialsPayload(BaseModel):
    mqtt_username: str
    mqtt_password: str


class AdminLifecyclePayload(BaseModel):
    state: str


class AdminMoisturePayload(BaseModel):
    value: float


class AdminWaterLevelPayload(BaseModel):
    has_water: bool


def create_device_app(state: DeviceState) -> FastAPI:
    app = FastAPI(
        title=f"Sierra {state.kind.capitalize()} Mock",
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    # ── Provisioning endpoints (FW-S-14) ─────────────────────────────────────

    @app.get("/device/info")
    async def device_info():
        """Hub calls this to verify device identity before pairing."""
        if state.lifecycle not in (DeviceLifecycle.wifi_connected, DeviceLifecycle.paired):
            raise HTTPException(status_code=503, detail="Device not ready for pairing")
        return state.device_info()

    @app.post("/device/credentials")
    async def accept_credentials(
        body: CredentialsPayload,
        x_pairing_code: Optional[str] = Header(None),
    ):
        """
        Hub sends MQTT credentials with the pairing code as authorization.
        Device validates code, stores creds, transitions to paired.
        """
        if state.lifecycle == DeviceLifecycle.paired:
            raise HTTPException(status_code=409, detail="Already paired")
        if state.lifecycle != DeviceLifecycle.wifi_connected:
            raise HTTPException(status_code=503, detail="Device not in wifi_connected state")

        code = x_pairing_code or ""
        if not state.check_pairing_code(code):
            raise HTTPException(status_code=403, detail="Invalid or expired pairing code")

        state.enter_paired(body.mqtt_username, body.mqtt_password)
        log.info("[%s] Paired via Hub. MQTT user: %s", state.name, body.mqtt_username)
        return {"status": "paired", "kind": state.kind, "mac": state.mac}

    # ── Admin/debug endpoints ─────────────────────────────────────────────────

    @app.get("/admin/state")
    async def admin_state():
        s = {
            "kind": state.kind,
            "name": state.name,
            "mac": state.mac,
            "lifecycle": state.lifecycle.value,
            "firmware": state.firmware_version,
            "ip": state.ip,
            "uptime_s": state.uptime_s,
            "pairing_code": state.pairing_code if state.lifecycle != DeviceLifecycle.paired else None,
            "pairing_code_valid": state.is_pairing_code_valid(),
            "mqtt_username": state.mqtt_username,
        }
        if state.kind == "sense":
            s["moisture_pct"] = round(state.moisture_pct, 1)
            s["temp_c"] = state.temp_c
        elif state.kind == "valve":
            s["water_level"] = state.water_level
            s["valve_open"] = state.valve_open
        return s

    @app.post("/admin/lifecycle")
    async def admin_set_lifecycle(body: AdminLifecyclePayload):
        try:
            new = DeviceLifecycle(body.state)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Unknown lifecycle: {body.state}")
        if new == DeviceLifecycle.ap_mode:
            state.enter_ap_mode()
        elif new == DeviceLifecycle.wifi_connected:
            state.enter_wifi_connected()
        else:
            state.lifecycle = new
        log.info("[%s] Lifecycle forced → %s", state.name, new.value)
        return {"lifecycle": state.lifecycle.value, "pairing_code": state.pairing_code}

    @app.post("/admin/reset")
    async def admin_reset():
        state.enter_ap_mode()
        state.mqtt_username = None
        state.mqtt_password = None
        log.info("[%s] Reset to ap_mode", state.name)
        return {"lifecycle": state.lifecycle.value, "pairing_code": state.pairing_code}

    if state.kind == "sense":
        @app.post("/admin/moisture")
        async def admin_set_moisture(body: AdminMoisturePayload):
            if not (0 <= body.value <= 100):
                raise HTTPException(status_code=422, detail="value must be 0-100")
            state.moisture_pct = body.value
            return {"moisture_pct": state.moisture_pct}

    if state.kind == "valve":
        @app.post("/admin/water_level")
        async def admin_set_water_level(body: AdminWaterLevelPayload):
            state.water_level = body.has_water
            return {"water_level": state.water_level}

    return app
