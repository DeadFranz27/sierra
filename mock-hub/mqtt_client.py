"""
MQTT publisher/subscriber for the mock hub.

Topic contract (must match real firmware exactly):
  sierra/hub/001/moisture          pub  {"value": 42.1, "ts": "..."}
  sierra/hub/001/valve/state       pub  "OPEN" | "CLOSED"
  sierra/hub/001/valve/set         sub  {"state":"OPEN","duration_s":360}
  sierra/hub/001/status            pub  {"online":true,"rssi":-54,"fw":"0.1.0-mock","uptime":12345}
  sierra/hub/001/last_run          pub  {"duration_s":360,"ended_at":"..."}
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone

import aiomqtt

from physics import PhysicsState

log = logging.getLogger(__name__)

HUB_ID = "001"
TOPIC_MOISTURE = f"sierra/hub/{HUB_ID}/moisture"
TOPIC_VALVE_STATE = f"sierra/hub/{HUB_ID}/valve/state"
TOPIC_VALVE_SET = f"sierra/hub/{HUB_ID}/valve/set"
TOPIC_STATUS = f"sierra/hub/{HUB_ID}/status"
TOPIC_LAST_RUN = f"sierra/hub/{HUB_ID}/last_run"

PUBLISH_MOISTURE_INTERVAL = 60   # seconds (real time)
PUBLISH_STATUS_INTERVAL = 30     # seconds (real time)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def run_mqtt(state: PhysicsState) -> None:
    mqtt_host = os.environ["MQTT_HOST"]
    mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
    mqtt_user = os.environ["SIERRA_HUB_MQTT_USER"]
    mqtt_pass = os.environ["SIERRA_HUB_MQTT_PASS"]

    while True:
        try:
            async with aiomqtt.Client(
                hostname=mqtt_host,
                port=mqtt_port,
                username=mqtt_user,
                password=mqtt_pass,
            ) as client:
                log.info("Connected to MQTT broker at %s:%d", mqtt_host, mqtt_port)

                await client.subscribe(TOPIC_VALVE_SET)

                async with asyncio.TaskGroup() as tg:
                    tg.create_task(_publish_loop(client, state))
                    tg.create_task(_subscribe_loop(client, state))

        except* (aiomqtt.MqttError, OSError) as eg:
            log.warning("MQTT connection lost: %s — retrying in 5 s", eg.exceptions)
            await asyncio.sleep(5)


async def _publish_loop(client: aiomqtt.Client, state: PhysicsState) -> None:
    last_moisture = 0.0
    last_status = 0.0

    while True:
        now = time.monotonic()

        if state.network_fail:
            await asyncio.sleep(1)
            continue

        # Moisture every 60 s real time
        if now - last_moisture >= PUBLISH_MOISTURE_INTERVAL:
            moisture = state.tick()
            if not state.sensor_fail:
                payload = json.dumps({"value": moisture, "ts": _now_iso()})
                await client.publish(TOPIC_MOISTURE, payload, qos=1)
                log.debug("Published moisture=%.1f%%", moisture)
            last_moisture = now

        # Status every 30 s real time
        if now - last_status >= PUBLISH_STATUS_INTERVAL:
            status = json.dumps({
                "online": True,
                "rssi": -54,
                "fw": "0.1.0-mock",
                "uptime": state.uptime_s,
            })
            await client.publish(TOPIC_STATUS, status, qos=0)
            last_status = now

        await asyncio.sleep(1)


async def _subscribe_loop(client: aiomqtt.Client, state: PhysicsState) -> None:
    async for message in client.messages:
        if state.network_fail:
            continue
        topic = str(message.topic)
        if topic == TOPIC_VALVE_SET:
            await _handle_valve_command(client, state, message.payload)


async def _handle_valve_command(
    client: aiomqtt.Client,
    state: PhysicsState,
    raw: bytes,
) -> None:
    try:
        cmd = json.loads(raw)
        action = cmd.get("state", "").upper()
        duration_s = int(cmd.get("duration_s", 300))
    except (json.JSONDecodeError, ValueError):
        log.warning("Malformed valve command: %r", raw)
        return

    if action == "OPEN":
        state.open_valve(duration_s)
        await client.publish(TOPIC_VALVE_STATE, "OPEN", qos=1, retain=True)
        log.info("Valve OPEN for %d s", duration_s)

        # Wait for duration, then close and publish last_run
        await asyncio.sleep(duration_s)
        if state.valve_open:   # may have been closed by physics timeout
            state.close_valve()
        await client.publish(TOPIC_VALVE_STATE, "CLOSED", qos=1, retain=True)
        last_run = json.dumps({"duration_s": duration_s, "ended_at": _now_iso()})
        await client.publish(TOPIC_LAST_RUN, last_run, qos=1)
        log.info("Valve closed after %d s — last_run published", duration_s)

    elif action == "CLOSED":
        state.close_valve()
        await client.publish(TOPIC_VALVE_STATE, "CLOSED", qos=1, retain=True)
        log.info("Valve CLOSED by command")
    else:
        log.warning("Unknown valve action: %s", action)
