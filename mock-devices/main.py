"""
Sierra mock-devices — simulates Sierra Sense + Sierra Valve as local HTTP/MQTT services.

Brings up two virtual ESP32 devices, each with:
  - HTTP server (provisioning API + admin debug API)
  - MQTT client (activated after pairing)
  - mDNS announcer (announces _sierra._tcp when wifi_connected or paired)

Usage:
  python main.py

Environment variables:
  MQTT_HOST            MQTT broker host (default: localhost)
  MQTT_PORT            MQTT broker port (default: 1883)
  SENSE_PORT           HTTP port for Sense device (default: 8781)
  VALVE_PORT           HTTP port for Valve device (default: 8782)
  AUTO_WIFI_CONNECT    If "true", skip ap_mode and go straight to wifi_connected (default: true)
  AUTO_ANNOUNCE        If "true", announce devices to backend on startup (default: true)
  SENSE_NAME           Name for Sense device (default: Sierra Sense)
  VALVE_NAME           Name for Valve device (default: Sierra Valve)
  DEVICE_IP            IP to report as device IP (default: 127.0.0.1)
  BACKEND_URL          Backend API base URL for auto-announce (default: http://localhost:8000)
  BACKEND_USER         Backend username for auto-announce (default: demo)
  BACKEND_PASS         Backend password for auto-announce (default: sierra2024)

After startup, devices are in wifi_connected state (auto-provisioned for local testing).
Use the admin API to change state, moisture, water level, etc.

Admin API examples:
  curl http://localhost:8781/admin/state              # Sense state
  curl http://localhost:8782/admin/state              # Valve state
  curl -X POST http://localhost:8781/admin/moisture -H 'Content-Type: application/json' -d '{"value":25}'
  curl -X POST http://localhost:8782/admin/water_level -H 'Content-Type: application/json' -d '{"has_water":false}'
  curl -X POST http://localhost:8781/admin/reset      # back to ap_mode
  curl -X POST http://localhost:8781/admin/lifecycle -H 'Content-Type: application/json' -d '{"state":"error"}'

Pairing flow (when in wifi_connected):
  1. curl http://localhost:8781/device/info           # get pairing_code_hash + manifest
  2. POST /api/devices/pair on backend with {ip:"127.0.0.1", port:8781, pairing_code:"XXXXXX"}
     (or use the Sierra web UI pairing wizard)

Interactive console commands (type in terminal):
  s         → show both device states
  reset     → reset both to ap_mode
  wifi      → move both to wifi_connected
  pair      → show pairing codes
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

import httpx
import uvicorn

from device_api import create_device_app
from device_mqtt import run_device_mqtt
from device_state import DeviceState, DeviceLifecycle
from mdns_announce import run_mdns

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


def _build_sense() -> DeviceState:
    state = DeviceState(
        kind="sense",
        name=os.environ.get("SENSE_NAME", "Sierra Sense"),
        ip=os.environ.get("DEVICE_IP", "127.0.0.1"),
        moisture_pct=52.0,
        temp_c=22.4,
    )
    return state


def _build_valve() -> DeviceState:
    state = DeviceState(
        kind="valve",
        name=os.environ.get("VALVE_NAME", "Sierra Valve"),
        ip=os.environ.get("DEVICE_IP", "127.0.0.1"),
        water_level=True,
    )
    return state


async def _announce_to_backend(state: DeviceState, device_port: int) -> None:
    """Announce device to backend mock/announce endpoint so it appears as a candidate."""
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    device_ip   = os.environ.get("DEVICE_IP", "127.0.0.1")
    backend_token_url = f"{backend_url}/api/auth/token"

    # Wait a moment for both servers to be ready
    await asyncio.sleep(2)

    # Authenticate against backend
    username = os.environ.get("BACKEND_USER", "demo")
    password = os.environ.get("BACKEND_PASS", "sierra2024")
    try:
        async with httpx.AsyncClient() as client:
            auth_r = await client.post(
                f"{backend_url}/api/auth/login",
                json={"username": username, "password": password},
            )
            auth_r.raise_for_status()
            cookies = dict(auth_r.cookies)

            announce_r = await client.post(
                f"{backend_url}/api/devices/mock/announce",
                json={
                    "kind": state.kind,
                    "mac": state.mac,
                    "ip": device_ip,
                    "port": device_port,
                    "hostname": f"sierra-{state.kind}-{state.mac[-5:].replace(':', '').lower()}.local",
                    "firmware_version": state.firmware_version,
                },
                cookies=cookies,
            )
            announce_r.raise_for_status()
            log.info("[%s] Announced to backend as candidate (port=%d)", state.name, device_port)
    except Exception as exc:
        log.warning("[%s] Could not announce to backend: %s", state.name, exc)


async def _run_server(app, host: str, port: int) -> None:
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


async def _console(sense: DeviceState, valve: DeviceState) -> None:
    """Simple interactive console for quick testing without curl."""
    loop = asyncio.get_event_loop()

    def _print_state(d: DeviceState) -> None:
        code = d.pairing_code if d.lifecycle == DeviceLifecycle.wifi_connected else "—"
        print(f"  [{d.kind.upper()}] {d.name}  mac={d.mac}  lifecycle={d.lifecycle.value}  code={code}")
        if d.kind == "sense":
            print(f"           moisture={d.moisture_pct:.1f}%  temp={d.temp_c}°C  mqtt={d.mqtt_username or '—'}")
        else:
            print(f"           water={'yes' if d.water_level else 'EMPTY'}  valve={'OPEN' if d.valve_open else 'closed'}  mqtt={d.mqtt_username or '—'}")

    while True:
        try:
            line = await loop.run_in_executor(None, input, "mock> ")
        except (EOFError, KeyboardInterrupt):
            break

        cmd = line.strip().lower()
        if cmd == "s" or cmd == "state":
            _print_state(sense)
            _print_state(valve)
        elif cmd == "pair" or cmd == "code":
            for d in (sense, valve):
                if d.lifecycle == DeviceLifecycle.wifi_connected:
                    print(f"  [{d.kind}] pairing code: {d.pairing_code}  (valid={d.is_pairing_code_valid()})")
                else:
                    print(f"  [{d.kind}] not in wifi_connected — lifecycle={d.lifecycle.value}")
        elif cmd == "wifi":
            for d in (sense, valve):
                d.enter_wifi_connected()
                print(f"  [{d.kind}] → wifi_connected  code={d.pairing_code}")
        elif cmd == "reset":
            for d in (sense, valve):
                d.enter_ap_mode()
                d.mqtt_username = None
                d.mqtt_password = None
                print(f"  [{d.kind}] → ap_mode  code={d.pairing_code}")
        elif cmd == "announce":
            asyncio.create_task(_announce_to_backend(sense, sense_port))
            asyncio.create_task(_announce_to_backend(valve, valve_port))
            print("  Re-announcing both devices to backend...")
        elif cmd in ("help", "h", "?"):
            print("  s / state   — show device states")
            print("  pair / code — show pairing codes")
            print("  wifi        — force wifi_connected on both")
            print("  reset       — back to ap_mode on both")
            print("  announce    — re-announce both to backend")
        elif cmd:
            print(f"  Unknown: {cmd!r}. Type 'help'.")


async def main() -> None:
    sense_port = int(os.environ.get("SENSE_PORT", "8781"))
    valve_port = int(os.environ.get("VALVE_PORT", "8782"))
    auto_wifi  = os.environ.get("AUTO_WIFI_CONNECT", "true").lower() == "true"

    sense = _build_sense()
    valve = _build_valve()

    # Auto-advance to wifi_connected for local testing convenience
    if auto_wifi:
        sense.enter_wifi_connected()
        valve.enter_wifi_connected()
        log.info("Auto-connected both devices to wifi (wifi_connected state)")

    sense_app = create_device_app(sense)
    valve_app = create_device_app(valve)

    log.info("Sierra Sense   → http://127.0.0.1:%d  mac=%s  code=%s", sense_port, sense.mac, sense.pairing_code)
    log.info("Sierra Valve   → http://127.0.0.1:%d  mac=%s  code=%s", valve_port, valve.mac, valve.pairing_code)
    log.info("Admin API:  GET /admin/state  POST /admin/moisture  POST /admin/water_level  POST /admin/reset")
    log.info("Pairing:    GET /device/info  POST /device/credentials")

    auto_announce = os.environ.get("AUTO_ANNOUNCE", "true").lower() == "true"

    async with asyncio.TaskGroup() as tg:
        # HTTP servers
        tg.create_task(_run_server(sense_app, "127.0.0.1", sense_port))
        tg.create_task(_run_server(valve_app, "127.0.0.1", valve_port))

        # MQTT loops (activate once paired)
        tg.create_task(run_device_mqtt(sense))
        tg.create_task(run_device_mqtt(valve))

        # mDNS announcers
        tg.create_task(run_mdns(sense, sense_port))
        tg.create_task(run_mdns(valve, valve_port))

        # Auto-announce to backend so devices appear as candidates
        if auto_announce:
            tg.create_task(_announce_to_backend(sense, sense_port))
            tg.create_task(_announce_to_backend(valve, valve_port))

        # Interactive console
        tg.create_task(_console(sense, valve))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Shutting down mock-devices")
