"""
MQTT bridge — subscribes to sierra/hub/+/# and writes readings to DB.
Also publishes valve commands on behalf of the backend.
Same topic contract as the device firmware.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import statistics
from datetime import datetime, timezone
from typing import Optional

import aiomqtt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import SessionLocal
from app.models.tables import Device, MoistureReading, Zone

log = logging.getLogger(__name__)

HUB_ID = "001"
TOPIC_MOISTURE = f"sierra/hub/{HUB_ID}/moisture"
TOPIC_VALVE_STATE = f"sierra/hub/{HUB_ID}/valve/state"
TOPIC_STATUS = f"sierra/hub/{HUB_ID}/status"
TOPIC_VALVE_SET = f"sierra/hub/{HUB_ID}/valve/set"

_valve_state: str = "CLOSED"   # in-memory cache for fast reads


def get_valve_state() -> str:
    return _valve_state


async def publish_valve_command(duration_s: int) -> None:
    """Open the valve for duration_s seconds. Called by the water endpoint."""
    payload = json.dumps({"state": "OPEN", "duration_s": duration_s})
    await _mqtt_publish(TOPIC_VALVE_SET, payload)


async def publish_valve_close() -> None:
    payload = json.dumps({"state": "CLOSED", "duration_s": 0})
    await _mqtt_publish(TOPIC_VALVE_SET, payload)


async def publish_command(device_mqtt_username: str, command: dict) -> None:
    """Send a control command to a specific device by its MQTT username."""
    topic = f"sierra/{device_mqtt_username}/control"
    await _mqtt_publish(topic, json.dumps(command))


async def capture_raw_adc(zone_id: str, duration_s: int = 20) -> Optional[float]:
    """
    Collect raw ADC samples from MQTT for duration_s seconds, return median.
    Returns None if no samples received.
    Real implementation subscribes to sierra/sense/<zone_id>/raw_adc and
    accumulates samples at ~2 Hz; this stub is wired up for firmware integration.
    """
    if _client_ref is None:
        return None

    topic = f"sierra/sense/{zone_id}/raw_adc"
    samples: list[float] = []
    deadline = asyncio.get_event_loop().time() + duration_s

    try:
        await _client_ref.subscribe(topic, qos=0)
        async for message in _client_ref.messages:
            if asyncio.get_event_loop().time() >= deadline:
                break
            try:
                samples.append(float(message.payload))
            except (ValueError, TypeError):
                pass
        await _client_ref.unsubscribe(topic)
    except Exception as exc:
        log.error("capture_raw_adc error on zone %s: %s", zone_id, exc)

    if not samples:
        return None
    return round(statistics.median(samples), 1)


# Shared client reference for publish-only calls
_client_ref: Optional[aiomqtt.Client] = None


async def _mqtt_publish(topic: str, payload: str) -> None:
    if _client_ref is not None:
        try:
            await _client_ref.publish(topic, payload, qos=1)
        except Exception as exc:
            log.error("Failed to publish to %s: %s", topic, exc)
    else:
        log.warning("MQTT client not ready — cannot publish to %s", topic)


async def run_bridge() -> None:
    """Long-running MQTT subscriber loop with auto-reconnect."""
    global _client_ref
    while True:
        try:
            async with aiomqtt.Client(
                hostname=settings.mqtt_host,
                port=settings.mqtt_port,
                username=settings.mqtt_user,
                password=settings.mqtt_pass,
            ) as client:
                _client_ref = client
                log.info("MQTT bridge connected to %s:%d", settings.mqtt_host, settings.mqtt_port)
                await client.subscribe(f"sierra/hub/{HUB_ID}/#")
                async for message in client.messages:
                    await _dispatch(str(message.topic), message.payload)
        except (aiomqtt.MqttError, OSError) as exc:
            _client_ref = None
            log.warning("MQTT bridge disconnected: %s — retrying in 5 s", exc)
            await asyncio.sleep(5)


async def _dispatch(topic: str, payload: bytes) -> None:
    global _valve_state
    try:
        if topic == TOPIC_MOISTURE:
            data = json.loads(payload)
            await _store_moisture(float(data["value"]), data.get("ts"))
        elif topic == TOPIC_VALVE_STATE:
            _valve_state = payload.decode().strip().strip('"')
            log.debug("Valve state → %s", _valve_state)
        elif topic == TOPIC_STATUS:
            data = json.loads(payload)
            await _update_device_status(data)
    except Exception as exc:
        log.error("Error dispatching topic %s: %s", topic, exc)


async def _store_moisture(value: float, ts_str: Optional[str]) -> None:
    if not (0.0 <= value <= 100.0):
        log.warning("Moisture value out of range: %.1f — discarding", value)
        return

    ts = datetime.now(timezone.utc)
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str)
        except ValueError:
            pass

    async with SessionLocal() as db:
        # Find the zone linked to this hub
        result = await db.execute(select(Zone).limit(1))
        zone = result.scalar_one_or_none()
        if zone is None:
            return
        reading = MoistureReading(
            zone_id=zone.id,
            timestamp=ts,
            value_percent=round(value, 1),
        )
        db.add(reading)
        await db.commit()
    log.debug("Stored moisture reading: %.1f%%", value)


async def _update_device_status(data: dict) -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Device).where(Device.kind == "hub").limit(1)
        )
        device = result.scalar_one_or_none()
        if device is None:
            return
        device.last_seen = datetime.now(timezone.utc)
        if "rssi" in data:
            device.wifi_rssi = float(data["rssi"])
        if "fw" in data:
            device.firmware_version = str(data["fw"])
        await db.commit()
