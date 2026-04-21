"""
mDNS advertiser for mock Sierra devices.

Advertises _sierra._tcp service per FW-S-16:
  - In wifi_connected: needs_pairing=true
  - In paired: needs_pairing=false
  - In other states: not advertised

Uses zeroconf library to simulate what the ESP32 mDNS stack does.
Falls back to HTTP polling stub if zeroconf unavailable.
"""
from __future__ import annotations

import asyncio
import logging
import socket
from typing import Optional

from device_state import DeviceState, DeviceLifecycle

log = logging.getLogger(__name__)


async def run_mdns(state: DeviceState, port: int) -> None:
    """Announce mDNS service when device is in wifi_connected or paired state."""
    try:
        from zeroconf.asyncio import AsyncZeroconf
        from zeroconf import ServiceInfo
    except ImportError:
        log.warning("[%s] zeroconf not available — mDNS simulation disabled", state.name)
        await _mdns_stub(state)
        return

    mac_short = state.mac.replace(":", "")[-4:].lower()
    service_name = f"sierra-{state.kind}-{mac_short}"
    fqdn = f"{service_name}._sierra._tcp.local."

    zc: Optional[AsyncZeroconf] = None
    registered = False
    last_lifecycle = None

    while True:
        current = state.lifecycle
        should_advertise = current in (DeviceLifecycle.wifi_connected, DeviceLifecycle.paired)

        if current != last_lifecycle:
            last_lifecycle = current

            # Teardown old registration if lifecycle changed
            if registered and zc:
                try:
                    await zc.async_unregister_all_services()
                    await zc.async_close()
                except Exception:
                    pass
                zc = None
                registered = False
                log.info("[%s] mDNS service unregistered", state.name)

            if should_advertise:
                try:
                    zc = AsyncZeroconf()
                    info = ServiceInfo(
                        type_="_sierra._tcp.local.",
                        name=fqdn,
                        addresses=[socket.inet_aton(state.ip)],
                        port=port,
                        properties={
                            b"kind": state.kind.encode(),
                            b"fw": state.firmware_version.encode(),
                            b"mac": state.mac.replace(":", "").encode(),
                            b"needs_pairing": (b"true" if current == DeviceLifecycle.wifi_connected else b"false"),
                            b"pairing_url": f"http://{state.ip}:{port}/device/info".encode(),
                        },
                        server=f"{service_name}.local.",
                    )
                    await zc.async_register_service(info)
                    registered = True
                    log.info(
                        "[%s] mDNS advertised: %s needs_pairing=%s",
                        state.name, fqdn,
                        current == DeviceLifecycle.wifi_connected,
                    )
                except Exception as exc:
                    log.warning("[%s] mDNS registration failed: %s", state.name, exc)
                    if zc:
                        await zc.async_close()
                    zc = None

        await asyncio.sleep(2)


async def _mdns_stub(state: DeviceState) -> None:
    """Simple log-only stub when zeroconf is unavailable."""
    last = None
    while True:
        cur = state.lifecycle
        if cur != last:
            if cur in (DeviceLifecycle.wifi_connected, DeviceLifecycle.paired):
                log.info(
                    "[%s] [mDNS stub] Would advertise _sierra._tcp needs_pairing=%s",
                    state.name,
                    cur == DeviceLifecycle.wifi_connected,
                )
            last = cur
        await asyncio.sleep(2)
