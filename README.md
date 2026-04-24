# Sierra

> **v0.2.0 — demo release.** Sierra is a proof-of-concept smart irrigation system. By default it runs in **demo mode** with simulated zones and weather, so you can try the whole UX without any hardware. Real-hardware mode is supported via a flag, but the ESPHome firmware is still in progress — see [Real mode](#real-mode) below.

---

Sierra waters your plants only when they actually need it. It runs on a Raspberry Pi on your home network, reads moisture sensors, checks the weather, and decides per-zone whether to water today. You manage everything from a web UI on any phone or laptop on the same Wi-Fi.

## Install in one command

On a fresh Raspberry Pi (64-bit Pi OS, SSH enabled, on your Wi-Fi):

```sh
curl -fsSL https://raw.githubusercontent.com/DeadFranz27/sierra/main/install.sh | sudo bash
```

That's it. The installer:

1. Installs Docker if missing
2. Clones Sierra into `~/sierra`
3. Generates random secrets and a self-signed TLS certificate
4. Builds and starts the stack
5. Registers a `systemd` service so Sierra starts at every boot
6. Prints the LAN URL and where to find the demo password

First run takes 5–10 minutes on a Pi 4. After that, the Pi just works — unplug it, plug it back in, Sierra is up again.

### Already cloned the repo?

```sh
cd sierra
sudo ./install.sh
```

Same result, no re-clone.

## First login

When the installer finishes it prints something like:

```
  Open the UI:  https://raspberrypi.local/
```

Open that on your phone. Your browser warns about the self-signed certificate — accept it once. From there the flow depends on how you installed:

- **Default install** (`sudo ./install.sh`): the UI opens directly on Step 0 of the setup wizard and asks you to pick a username and password for your account. Once you submit, you're logged in automatically and the wizard continues: name your first zone, pick a plant profile (tomato, lawn, herbs, ornamental…), optionally set your location so weather-based skipping works. There are no default credentials — whatever you choose is what you'll use to log in next time.
- **Demo install** (`sudo ./install.sh --demo`): Step 0 also offers a shortcut to log in as `demo` / `sierra2024` without creating an account. Useful for showcases or throwaway trials. You can still create a custom account from the wizard if you want.

If `raspberrypi.local` doesn't resolve from your phone (some Android builds skip mDNS), use the LAN IP that the installer prints instead.

Forgot the password? It's stored only as an Argon2 hash in `data/sierra.db`, so there's no recovery flow — you need shell access to the hub to reset it manually (SQL update on the `users` table).

## Modes

### Demo mode *(default)*

Simulated sensors and zones, fake weather. Perfect for understanding what Sierra does before buying hardware. Everything the UI shows is driven by a small mock service — watering events are virtual.

```sh
sudo ./install.sh            # or the curl one-liner above
```

### Real mode

Talks to real ESPHome-based moisture sensors and valves over MQTT.

```sh
sudo ./install.sh --real-hw
```

**Status:** the backend + MQTT plumbing is ready, but the **ESPHome firmware** (YAML + flashing guide) is not shipped in v0.1.0. You can connect your own ESPHome devices today if they publish to the topic contract documented in `docs/` — we'll ship turnkey firmware in a future release.

Switching modes later preserves your database — your zones, profiles, and history all survive.

## Day-to-day

```sh
# is it running?
sudo systemctl status sierra

# stop / start / restart
sudo systemctl stop sierra
sudo systemctl start sierra
sudo systemctl restart sierra

# tail the logs
docker compose -f ~/sierra/docker-compose.yml logs -f

# update to the latest version
cd ~/sierra && git pull && sudo systemctl restart sierra
```

## What's inside

| Component    | Role                                                      |
|--------------|-----------------------------------------------------------|
| `frontend`   | nginx serving the React UI over HTTPS                     |
| `backend`    | FastAPI — API, scheduler, MQTT bridge, onboarding          |
| `mosquitto`  | MQTT broker — ESPHome devices publish here                |
| `mock-hub`   | Simulated sensors/valves for demo mode                    |

All containers are managed by `docker compose` and supervised by the `sierra.service` systemd unit.

## Flags

| Flag              | Meaning                                                 |
|-------------------|---------------------------------------------------------|
| *(none)*          | Demo mode — simulated zones and sensors                 |
| `--real-hw`       | Real ESPHome hardware; exposes MQTT on the LAN          |
| `--no-autostart`  | Skip systemd registration                               |
| `--branch=NAME`   | Install from a non-default branch                       |
| `--dir=PATH`      | Install into a custom directory                         |

## Versioning

Sierra follows [Semantic Versioning](https://semver.org/). The current release is noted at the top of this file and in `VERSION`. Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Philosophy

One command to install. One URL to open. One password to remember. Everything else Sierra figures out on its own.

## More docs

- [CHANGELOG.md](CHANGELOG.md) — release history
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, secret handling
