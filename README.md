# Sierra

**Smart irrigation that waters when plants need it — not when a timer says so.**

Sierra runs on a Raspberry Pi on your home network. It talks to ESPHome-based moisture sensors and valves over MQTT, checks the weather, and decides per-zone whether to water today. You manage everything from a web UI on any phone or laptop on the same Wi-Fi.

---

## Install it in one command

You need:

- A Raspberry Pi 4 or 5 with **Raspberry Pi OS (64-bit)** flashed and booted
- SSH enabled, connected to your Wi-Fi
- A GitHub **fine-grained Personal Access Token** with `Contents: Read` on this repo
  *(see [docs/RASPBERRY_PI.md](docs/RASPBERRY_PI.md) for the 30-second walkthrough)*

Then from your Mac:

```sh
scp scripts/bootstrap.sh pi@raspberrypi.local:~/
ssh pi@raspberrypi.local
sudo REPO=DeadFranz27/sierra ~/bootstrap.sh
```

Paste the PAT when prompted. Go make a coffee — 5 to 10 minutes on a Pi 4.

When it's done, the installer prints a URL like:

```
  Sierra is running.
  Open: https://raspberrypi.local/
```

Open it on your phone. Browser warns about the self-signed cert — accept once.

---

## First login

The installer also prints demo credentials — something like:

```
  Sierra demo credentials
  Username : demo
  Password : Xq7k-2nvB-Rt91
```

Log in. You'll land in the **setup wizard**, which walks you through:

1. Naming your zones (e.g. *Vegetable patch*, *Rose border*)
2. Picking a plant profile for each (tomato, lawn, herbs, ornamental, …)
3. Optionally: setting your location so weather-aware skipping works
4. Adding hardware — if you're running in mock mode you can skip this and play with simulated zones first

That's it. Sierra will now water each zone only when it's actually dry, skip if it rained or is about to, and leave a readable log of what it did and why.

---

## Hostname on the network

Raspberry Pi OS ships with mDNS enabled, so the Pi is reachable on your LAN at **`<hostname>.local`** — whatever you named it during `rpi-imager` setup. Default is `raspberrypi.local`.

If `.local` doesn't resolve from your phone (some Android builds don't speak mDNS), fall back to the Pi's LAN IP — the installer prints it at the end.

---

## What runs on the Pi

| Container     | Purpose                                            |
|---------------|----------------------------------------------------|
| `frontend`    | nginx serving the React UI over HTTPS (port 443)   |
| `backend`     | FastAPI — API, scheduler, MQTT bridge, onboarding  |
| `mosquitto`   | MQTT broker — ESPHome devices talk to this         |
| `mock-hub`    | Simulated sensors/valves for demo mode             |

All orchestrated by `docker-compose`, brought up by `systemd` at boot.

---

## Modes

**Mock mode (default)** — simulated zones, simulated weather. You can click around the entire app without plugging in any hardware. Perfect for a demo or for trying profiles.

**Real hardware mode** — run the installer with `--real-hw`. Sierra expects ESPHome devices announcing themselves over mDNS and publishing to the MQTT topic contract documented in `docs/`.

Switch between them anytime:

```sh
cd ~/sierra
sudo ./scripts/install.sh --real-hw   # or re-run without flags to go back to mock
```

Your zones and history are preserved — only the data source changes.

---

## Day-to-day

```sh
# Is it running?
sudo systemctl status sierra

# Stop / start
sudo systemctl stop sierra
sudo systemctl start sierra

# Tail the logs
docker compose -f ~/sierra/docker-compose.yml logs -f

# Pull the latest code and restart
cd ~/sierra && git pull && sudo systemctl restart sierra
```

---

## Deeper docs

- **[docs/RASPBERRY_PI.md](docs/RASPBERRY_PI.md)** — full Pi installer reference, PAT rotation, troubleshooting
- **[docs/SECURITY.md](docs/SECURITY.md)** — threat model, secret handling, TLS

---

## Philosophy

One command to install. One URL to open. One password to remember. Everything else Sierra figures out on its own.
