"""
Shared state for a simulated Sierra ESP32 device (Sense or Valve).
Mirrors the lifecycle from 06-device-provisioning-storyboard.md §1.
"""
from __future__ import annotations

import random
import secrets
import string
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class DeviceLifecycle(str, Enum):
    factory_fresh   = "factory_fresh"
    ap_mode         = "ap_mode"
    wifi_connecting = "wifi_connecting"
    wifi_connected  = "wifi_connected"
    paired          = "paired"
    reconnecting    = "reconnecting"
    error           = "error"


def _gen_mac() -> str:
    """Generate a fake MAC address."""
    parts = [random.randint(0, 255) for _ in range(6)]
    parts[0] &= 0xFE  # unicast
    return ":".join(f"{b:02X}" for b in parts)


def _gen_pairing_code() -> str:
    return "".join(random.choices(string.digits, k=6))


@dataclass
class DeviceState:
    kind: str                            # "sense" | "valve"
    name: str
    mac: str = field(default_factory=_gen_mac)
    firmware_version: str = "0.1.0-mock"
    ip: str = "127.0.0.1"

    lifecycle: DeviceLifecycle = DeviceLifecycle.factory_fresh
    pairing_code: Optional[str] = None
    pairing_code_generated_at: Optional[float] = None
    pairing_attempts: int = 0
    pairing_cooldown_until: Optional[float] = None

    # Credentials issued by Hub on pairing
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None

    # Sense-specific
    moisture_pct: float = field(default_factory=lambda: round(random.uniform(30, 70), 1))
    temp_c: float = field(default_factory=lambda: round(random.uniform(18, 26), 1))

    # Valve-specific
    water_level: bool = True
    valve_open: bool = False
    valve_open_since: Optional[float] = None
    valve_duration_s: int = 0

    start_time: float = field(default_factory=time.monotonic)
    last_heartbeat_at: Optional[float] = None

    def enter_ap_mode(self) -> None:
        self.lifecycle = DeviceLifecycle.ap_mode
        self.pairing_code = _gen_pairing_code()
        self.pairing_code_generated_at = time.monotonic()
        self.pairing_attempts = 0
        self.pairing_cooldown_until = None

    def enter_wifi_connected(self) -> None:
        self.lifecycle = DeviceLifecycle.wifi_connected
        # Generate pairing code when device gets on WiFi (shown on captive portal success screen)
        self.pairing_code = _gen_pairing_code()
        self.pairing_code_generated_at = time.monotonic()
        self.pairing_attempts = 0
        self.pairing_cooldown_until = None

    def enter_paired(self, mqtt_username: str, mqtt_password: str) -> None:
        self.lifecycle = DeviceLifecycle.paired
        self.mqtt_username = mqtt_username
        self.mqtt_password = mqtt_password
        self.pairing_code = None  # invalidate after use

    def is_pairing_code_valid(self) -> bool:
        if self.pairing_code is None or self.pairing_code_generated_at is None:
            return False
        return (time.monotonic() - self.pairing_code_generated_at) < 600  # 10 min

    def check_pairing_code(self, code: str) -> bool:
        """Rate-limited code check. Returns True if correct."""
        now = time.monotonic()
        if self.pairing_cooldown_until and now < self.pairing_cooldown_until:
            return False  # in cooldown
        if not self.is_pairing_code_valid():
            return False
        self.pairing_attempts += 1
        if self.pairing_attempts >= 3:
            self.pairing_cooldown_until = now + 60
            self.pairing_attempts = 0
        return self.pairing_code == code

    def tick_moisture(self, dt_s: float) -> None:
        """Simple evaporation model."""
        if self.lifecycle != DeviceLifecycle.paired:
            return
        self.moisture_pct -= 0.002 * dt_s  # slow drain
        self.moisture_pct += random.gauss(0, 0.05)
        self.moisture_pct = max(0.0, min(100.0, self.moisture_pct))

    def open_valve(self, duration_s: int) -> None:
        self.valve_open = True
        self.valve_open_since = time.monotonic()
        self.valve_duration_s = duration_s

    def tick_valve(self, dt_s: float) -> bool:
        """Tick valve timer. Returns True if valve just closed."""
        if not self.valve_open or self.valve_open_since is None:
            return False
        if time.monotonic() - self.valve_open_since >= self.valve_duration_s:
            self.valve_open = False
            self.valve_open_since = None
            return True
        # Add moisture while pumping
        self.moisture_pct += 0.15 * dt_s
        self.moisture_pct = min(100.0, self.moisture_pct)
        return False

    @property
    def uptime_s(self) -> int:
        return int(time.monotonic() - self.start_time)

    def device_info(self) -> dict:
        """Manifest returned by GET /device/info (FW-S-14)."""
        import hashlib
        code_hash = hashlib.sha256((self.pairing_code or "").encode()).hexdigest() if self.pairing_code else None
        return {
            "kind": self.kind,
            "mac": self.mac,
            "firmware": self.firmware_version,
            "lifecycle": self.lifecycle.value,
            "pairing_code_hash": code_hash,
            "pairing_code_valid": self.is_pairing_code_valid(),
            "ip": self.ip,
            "name": self.name,
        }
