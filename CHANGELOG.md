# Changelog

All notable changes to Sierra will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-04-21

First tagged release. Sierra is currently a **demo-quality PoC** — simulated zones and sensors by default, real hardware supported but unfinished on the firmware side.

### Added

- End-to-end stack: FastAPI backend, React+Vite frontend, Mosquitto broker, mock hub, docker-compose orchestration.
- APScheduler-driven watering with profile-aware skip logic (moisture, rain, min interval).
- Onboarding wizard on first login.
- Raspberry Pi one-command installer — no PAT, no prerequisites beyond a fresh Pi OS.
- Self-signed TLS, systemd autostart, LAN-reachable UI via `<hostname>.local`.
- Mock mode (default) and real-hardware mode (`--real-hw`).

### Known limitations

- ESPHome firmware for real sensors/valves is not yet shipped.
- Weather integration runs against a stub provider — needs a real API key wired through `.env` for production use.
- No multi-user support yet; single demo account.
