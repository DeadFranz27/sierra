# Sierra

> **v0.4.0.** Sierra is a smart irrigation hub for your home LAN. It runs on a Raspberry Pi, reads moisture sensors over MQTT, checks the weather, and waters each zone only when it actually needs it. Management happens from a web UI on any phone or laptop on the same Wi-Fi.

---

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
6. Prints the LAN URL

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

Open that on your phone. Your browser warns about the self-signed certificate — accept it once. The UI opens directly on Step 0 of the setup wizard and asks you to pick a username and password. Once you submit, you're logged in automatically and the wizard continues: name your first zone, pick a plant profile (tomato, lawn, herbs, ornamental…), optionally set your location so weather-based skipping works. There are no default credentials — whatever you choose is what you'll use next time.

If `raspberrypi.local` doesn't resolve from your phone (some Android builds skip mDNS), use the LAN IP that the installer prints instead.

Forgot the password? It's stored only as an Argon2 hash in `data/sierra.db`, so there's no recovery flow — you need shell access to the hub to reset it manually (SQL update on the `users` table).

## Connecting your first device

Flash the Sierra firmware onto your ESP32, give it Wi-Fi on the same LAN as the hub, and point it at the hub's MQTT broker using the `SIERRA_HUB_MQTT_USER` / `SIERRA_HUB_MQTT_PASS` credentials from the hub's `.env`.

To pair the device to the hub:

1. Open the hub UI → **Device** page → **Pair**.
2. Enter the device's LAN IP (shown on the device itself or in your router's DHCP list).
3. Enter the 6-digit pairing code the device is currently displaying.
4. The hub does an HTTPS handshake with the device and stores it.

Auto-discovery (devices announcing themselves on boot) is planned for v0.5.0; for now the IP entry is manual.

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
| `mosquitto`  | MQTT broker — ESP devices publish here                    |

All containers are managed by `docker compose` and supervised by the `sierra.service` systemd unit.

## Flags

| Flag              | Meaning                                                 |
|-------------------|---------------------------------------------------------|
| `--no-autostart`  | Skip systemd registration                               |
| `--branch=NAME`   | Install from a non-default branch                       |
| `--dir=PATH`      | Install into a custom directory                         |

## Versioning

Sierra follows [Semantic Versioning](https://semver.org/). The current release is noted in `VERSION`. Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Philosophy

One command to install. One URL to open. One password to remember. Everything else Sierra figures out on its own.

## More docs

- [CHANGELOG.md](CHANGELOG.md) — release history
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, secret handling
