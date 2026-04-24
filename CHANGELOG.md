# Changelog

All notable changes to Sierra will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-04-23

### Added

- **Step 0 of the onboarding wizard — account creation.** Fresh installs no longer ship with a hardcoded password that users had to fish out of Docker logs. The first time someone opens the UI on a clean hub, the wizard now starts at Step 0 ("Crea il tuo accesso") with username, password, and confirm-password fields; submitting creates the real user and auto-signs them in, then continues with Welcome → Zone → Posizione → Done.
- Real `users` table in the database (`id`, `username`, `password_hash`, `is_demo`, `created_at`) — multi-user capable even though the wizard currently creates a single account.
- `GET /api/auth/status` → `{ has_users, demo_mode }` — public endpoint the frontend uses to decide whether to show login or jump straight into Step 0.
- `POST /api/auth/setup` — public, rate-limited (5/min), available only until the first non-demo user exists; creates the first real account and sets the session cookie.
- `--demo` installer flag → sets `SIERRA_DEMO_MODE=1` in `.env`. When enabled, the backend bootstraps a `demo` / `sierra2024` user at first boot and Step 0 shows a "Usa demo" shortcut. Without the flag, no default credentials exist.
- `GET /api/settings/geocode?q=…` — server-side proxy to Nominatim. The wizard's Location step now goes through the backend instead of fetching `nominatim.openstreetmap.org` from the browser, so the strict CSP (`connect-src 'self'`) keeps holding and we can send a proper User-Agent as the Nominatim usage policy requires. Rate-limited (20/min) per client.

### Changed

- Login now verifies credentials against the `users` table instead of a single env-hashed hardcoded account. `demo_password_hash` env var is gone.
- App gating: `App.tsx` now loads `auth.status` alongside the zones probe. If no users exist, the wizard mounts directly at Step 0 without going through `LoginScreen`.
- `WizardShell` accepts a dynamic `steps` prop so the step-indicator dots show 5 when starting from Step 0 and 4 when re-entering post-login.
- `WelcomeStep` copy updated to acknowledge the account is already set up.
- README "First login" section rewritten: fresh installs describe the Step 0 flow; the old `docker compose logs … grep "demo credentials"` recipe is gone from the default path and kept only for `--demo` mode.

### Removed

- Hardcoded demo password printed in the backend logs on every fresh install (now only printed when `SIERRA_DEMO_MODE=1`, i.e. when the user opted in with `--demo`).

## [0.2.0] — 2026-04-23

### Added

- First-login onboarding wizard. After signing in for the first time, users are guided through a 4-step flow instead of landing on an empty dashboard:
  1. **Welcome** — serif headline, animated entry, primary CTA "Inizia" and a "Salta per ora" link.
  2. **Prima zona** — name the zone and pick a plant preset from a visual grid (uses `PlantCategoryIcon`); creates the zone via `POST /api/zones` and assigns the profile.
  3. **Posizione** — city/address search via OpenStreetMap Nominatim (no API key, no backend change), with "Salta per ora" for users who want to configure weather later.
  4. **Riepilogo** — animated success seal + summary cards of the configured zone and location; CTA finalises via `POST /api/onboarding/complete`.
- Progress persistence: every step transition saves `current_step` and a snapshot via `POST /api/onboarding/progress`, so a reload resumes where the user left off.
- Step indicator dots with moss-palette active/done states, respecting the design tokens (`--dur-emphasis`, `--ease-standard`).
- New frontend hook `useOnboarding` and typed API surface (`api.onboarding`) for progress/complete endpoints that already existed backend-side but were never wired.
- New components: `OnboardingScreen` (controller) + `WizardShell`, `WelcomeStep`, `ZoneStep`, `LocationStep`, `DoneStep`.

### Changed

- `App.tsx` now gates the main app on `is_complete`; if the onboarding row is incomplete, the wizard mounts in place of the dashboard layout.

## [0.1.5] — 2026-04-23

### Fixed

- Frontend container was stuck in a restart loop with `open() "/var/run/nginx.pid" failed (13: Permission denied)`. The previous Dockerfile forced nginx to run as an unprivileged user, but that user couldn't bind to ports 80/443 (privileged on Linux) or write the pid file to the tmpfs-backed `/var/run`. Fix: removed the explicit `USER sierra` line — nginx now runs as its image default (root inside the container, which is isolated from the host). Resolves the restart loop and makes the UI actually reachable.

## [0.1.4] — 2026-04-23

### Fixed

- Backend container was stuck in a restart loop on first boot with `sqlite3.OperationalError: unable to open database file`. Root cause: the Dockerfile switched to the unprivileged `sierra` user before `/app/data` existed, so when Docker's named `sierra_db` volume mounted on top it inherited root ownership and the process couldn't write the SQLite file. Fix: create `/app/data` with `sierra:sierra` ownership **before** `USER sierra` so the named volume inherits the right permissions on first mount.

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
