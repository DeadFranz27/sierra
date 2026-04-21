"""
MQTT loop for a paired Sierra mock device.

Topic contract matches real firmware exactly:
  Sense:
    sierra/sense/<mqtt_user>/moisture   pub  {"value":42.1,"raw":1850,"ts":"...","temp_c":22.4}
    sierra/sense/<mqtt_user>/status     pub  {"online":true,"rssi":-54,"fw":"0.1.0","uptime":1234}
    sierra/sense/<mqtt_user>/raw_adc    pub  <float>   (raw ADC for calibration capture)

  Valve:
    sierra/valve/<mqtt_user>/state      pub  "OPEN" | "CLOSED"
    sierra/valve/<mqtt_user>/status     pub  {"online":true,"rssi":-48,"fw":"0.1.0","uptime":1234,"water_level":true}
    sierra/valve/<mqtt_user>/control    sub  {"action":"open","duration_s":300}
                                         sub  {"action":"close"}
                                         sub  {"action":"restart"}
                                         sub  {"action":"factory_reset"}
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime, timezone

import aiomqtt

from device_state import DeviceState, DeviceLifecycle

log = logging.getLogger(__name__)

MOISTURE_INTERVAL = 30    # seconds between moisture publishes
STATUS_INTERVAL   = 15    # seconds between status heartbeats
RAW_ADC_INTERVAL  = 0.5   # seconds between raw ADC publishes (2 Hz for calibration)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _raw_from_moisture(pct: float, dry_raw: float = 2800, wet_raw: float = 1200) -> float:
    """Invert the calibration formula: raw = dry - pct*(dry-wet)/100."""
    raw = dry_raw - (pct * (dry_raw - wet_raw) / 100.0)
    return round(raw, 1)


async def run_device_mqtt(state: DeviceState) -> None:
    """Wait for paired state, then connect to MQTT and run publish/subscribe loops."""
    mqtt_host = os.environ.get("MQTT_HOST", "localhost")
    mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))

    while True:
        # Wait until device is paired and has MQTT credentials
        if state.lifecycle != DeviceLifecycle.paired or not state.mqtt_username:
            await asyncio.sleep(1)
            continue

        username = state.mqtt_username
        password = state.mqtt_password
        kind = state.kind

        log.info("[%s] Connecting to MQTT as %s", state.name, username)
        try:
            async with aiomqtt.Client(
                hostname=mqtt_host,
                port=mqtt_port,
                username=username,
                password=password,
            ) as client:
                log.info("[%s] MQTT connected", state.name)

                if kind == "valve":
                    ctrl_topic = f"sierra/valve/{username}/control"
                    await client.subscribe(ctrl_topic, qos=1)

                async with asyncio.TaskGroup() as tg:
                    tg.create_task(_publish_loop(client, state))
                    if kind == "valve":
                        tg.create_task(_subscribe_loop(client, state))

        except (aiomqtt.MqttError, OSError) as exc:
            # If lifecycle changed (e.g. unpaired), stop trying
            if state.lifecycle != DeviceLifecycle.paired:
                log.info("[%s] No longer paired — stopping MQTT", state.name)
                return
            log.warning("[%s] MQTT lost: %s — retrying in 5s", state.name, exc)
            await asyncio.sleep(5)


async def _publish_loop(client: aiomqtt.Client, state: DeviceState) -> None:
    last_moisture = 0.0
    last_status   = 0.0
    last_raw      = 0.0
    last_tick     = time.monotonic()

    while state.lifecycle == DeviceLifecycle.paired:
        now = time.monotonic()
        dt = now - last_tick
        last_tick = now

        # Physics tick
        if state.kind == "sense":
            state.tick_moisture(dt)
        elif state.kind == "valve":
            just_closed = state.tick_valve(dt)
            if just_closed:
                topic = f"sierra/valve/{state.mqtt_username}/state"
                await client.publish(topic, json.dumps("CLOSED"), qos=1, retain=True)
                log.info("[%s] Valve auto-closed after timer", state.name)

        # Moisture / raw ADC (Sense only)
        if state.kind == "sense":
            raw = _raw_from_moisture(state.moisture_pct)

            if now - last_raw >= RAW_ADC_INTERVAL:
                raw_topic = f"sierra/sense/{state.mqtt_username}/raw_adc"
                await client.publish(raw_topic, str(raw), qos=0)
                last_raw = now

            if now - last_moisture >= MOISTURE_INTERVAL:
                payload = json.dumps({
                    "value": round(state.moisture_pct, 1),
                    "raw": raw,
                    "ts": _now_iso(),
                    "temp_c": state.temp_c,
                })
                topic = f"sierra/sense/{state.mqtt_username}/moisture"
                await client.publish(topic, payload, qos=1)
                log.debug("[%s] moisture=%.1f%% raw=%.0f", state.name, state.moisture_pct, raw)
                last_moisture = now

        # Status heartbeat (both kinds)
        if now - last_status >= STATUS_INTERVAL:
            base = {
                "online": True,
                "rssi": -54 + round(random.uniform(-5, 5)),
                "fw": state.firmware_version,
                "uptime": state.uptime_s,
            }
            if state.kind == "valve":
                base["water_level"] = state.water_level
                base["valve_open"]  = state.valve_open

            kind_str = state.kind
            topic = f"sierra/{kind_str}/{state.mqtt_username}/status"
            await client.publish(topic, json.dumps(base), qos=0)
            state.last_heartbeat_at = now
            log.debug("[%s] heartbeat published (uptime %ds)", state.name, state.uptime_s)
            last_status = now

        await asyncio.sleep(0.1)


async def _subscribe_loop(client: aiomqtt.Client, state: DeviceState) -> None:
    """Handle control commands for Valve device."""
    ctrl_topic = f"sierra/valve/{state.mqtt_username}/control"
    async for message in client.messages:
        if state.lifecycle != DeviceLifecycle.paired:
            break
        if str(message.topic) != ctrl_topic:
            continue
        try:
            cmd = json.loads(message.payload)
        except (json.JSONDecodeError, TypeError):
            log.warning("[%s] Malformed control payload: %r", state.name, message.payload)
            continue

        action = cmd.get("action", "").lower()
        state_topic = f"sierra/valve/{state.mqtt_username}/state"

        if action == "open":
            if not state.water_level:
                log.warning("[%s] Pump refused — reservoir empty (FW-V-5)", state.name)
                continue
            duration_s = int(cmd.get("duration_s", 300))
            state.open_valve(duration_s)
            await client.publish(state_topic, json.dumps("OPEN"), qos=1, retain=True)
            log.info("[%s] Valve OPEN for %ds", state.name, duration_s)

        elif action == "close":
            state.valve_open = False
            state.valve_open_since = None
            await client.publish(state_topic, json.dumps("CLOSED"), qos=1, retain=True)
            log.info("[%s] Valve CLOSED by command", state.name)

        elif action == "restart":
            log.info("[%s] Restart command received — simulating reboot (3s offline)", state.name)
            state.lifecycle = DeviceLifecycle.reconnecting
            await asyncio.sleep(3)
            state.lifecycle = DeviceLifecycle.paired
            # Will reconnect in next iteration of run_device_mqtt

        elif action == "factory_reset":
            log.info("[%s] Factory reset command received", state.name)
            state.enter_ap_mode()
            state.mqtt_username = None
            state.mqtt_password = None
            break  # exit subscribe loop, run_device_mqtt will detect not-paired

        else:
            log.warning("[%s] Unknown control action: %s", state.name, action)
