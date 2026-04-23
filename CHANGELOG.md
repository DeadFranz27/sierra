# Changelog

All notable changes to Sierra will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/).

## [0.1.3] — 2026-04-23

### Fixed

- Frontend build no longer fails under React 19 / strict TypeScript: replaced the global `JSX.Element` reference in `PlantCategoryIcon.tsx` with an explicit `ReactElement` import.
- `DeviceCandidate` frontend type now matches what the backend actually returns — added the `port`, `last_seen_at` fields and made `hostname` nullable (was causing `npm run build` to fail inside the Docker build step on the Pi).

## [0.1.2] — 2026-04-23

### Fixed

- Docker Compose plugin install now uses a three-tier fallback — apt, then Docker's official repo, then the GitHub binary release. The last tier works on any Debian release, including ones newer than what `download.docker.com` has indexed (observed on Debian 13 trixie: `get.docker.com` ran to completion but left the system without `docker compose`).

## [0.1.1] — 2026-04-21

### Fixed

- Installer now fails fast and loudly if any prerequisite step breaks, instead of silently continuing to a confusing docker-compose crash.
  - Explicit internet-reachability check before touching apt.
  - Docker installer: download to a temp file + verify `docker` is on PATH before claiming success; fallback hint to `apt install docker.io docker-compose-plugin` if the official script misbehaves.
  - Explicit check that the Docker daemon is actually running (`systemctl is-active`) and accepts commands (`docker info`) before moving on.
  - `docker compose build/up` now run as root to avoid the "just-added-to-docker-group-but-not-active-in-this-session" trap; failures abort the installer with a pointer to the real error.

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
