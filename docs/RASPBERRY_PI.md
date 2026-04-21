# Sierra on Raspberry Pi

One command, a fresh Pi, done.

## What you need

- **Raspberry Pi 4 or 5** with **Raspberry Pi OS (64-bit)** — Pi 3 with 32-bit works but is slow
- SSH access (or keyboard + monitor)
- Pi connected to your Wi-Fi / LAN
- A **GitHub fine-grained Personal Access Token** with read access to this (private) repo — see below

## 1. Create a GitHub fine-grained PAT

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Token name:** `sierra-pi-<hostname>` (so you can tell which Pi it belongs to)
3. **Expiration:** 30 days (rotate it — see below)
4. **Resource owner:** your account
5. **Repository access:** *Only select repositories* → pick `sierra`
6. **Permissions → Repository permissions:**
   - `Contents` → **Read-only**
   - everything else → *No access*
7. **Generate** and copy the token (starts with `github_pat_…`) — you'll only see it once

Why fine-grained, not classic: the token is scoped to **one repo, read-only**. If the Pi is ever compromised, the blast radius is "clone this repo" — nothing more.

## 2. Install on the Pi

SSH into the Pi, then one of these:

### Option A — one-liner (recommended)

```sh
curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/bootstrap.sh \
  | sudo REPO=OWNER/REPO bash
```

Replace `OWNER/REPO` with your repo (e.g. `francescotroian/sierra`).

*Note:* the `curl` needs the file to be reachable. For a private repo you can either (a) make only `scripts/bootstrap.sh` temporarily public by copying it to a public gist, or (b) use Option B.

### Option B — download bootstrap.sh first

```sh
# On your Mac
scp scripts/bootstrap.sh pi@<pi-ip>:~/

# On the Pi
sudo REPO=OWNER/REPO ~/bootstrap.sh
```

Either way: you'll be prompted for the PAT (input is hidden). The script:

1. Installs `git` / `curl` if missing
2. Validates the token against the GitHub API
3. Clones the repo into `~/sierra` — without writing the token to `.git/config`
4. Hands off to `install.sh`, which sets up Docker, secrets, TLS, systemd and brings the stack up

Passing flags to the installer:

```sh
sudo REPO=OWNER/REPO bash bootstrap.sh -- --real-hw
```

## 3. After install

The installer prints the LAN URL (`https://<pi-ip>/`) and where to find the demo credentials. First build takes ~5–10 minutes on a Pi 4.

## Updating the Pi later

Once the repo is on disk, updates don't need the PAT — `git pull` works as long as the repo remains accessible and the PAT is still valid:

```sh
cd ~/sierra
sudo -u $USER git -c "http.extraheader=Authorization: Bearer $GITHUB_TOKEN" pull
sudo systemctl restart sierra
```

Better: re-run `bootstrap.sh` with a fresh PAT. It detects the existing clone and does a `pull` instead.

## Rotating the PAT (do this every 30 days)

1. Create a new fine-grained PAT (same settings as step 1)
2. Revoke the old one in GitHub → Settings → Developer settings → PATs → **Revoke**
3. Next time you re-run `bootstrap.sh` on the Pi, use the new token

The token is **never persisted on the Pi** — the installer only uses it for the clone, then unsets it. So "rotation" really just means generating a new one when you need to re-deploy or update.

If you ever suspect a token leak: revoke it immediately in GitHub, then generate a new one.

## Flags (install.sh)

| Flag              | Meaning                                                                 |
|-------------------|-------------------------------------------------------------------------|
| *(none)*          | Mock mode — simulated zones and sensors                                 |
| `--real-hw`       | Real ESPHome hardware; exposes MQTT on the LAN                          |
| `--no-autostart`  | Skip the systemd unit — run manually with `docker compose up -d`        |

## Day-to-day

```sh
# stop everything
sudo systemctl stop sierra

# start again
sudo systemctl start sierra

# tail logs
docker compose -f ~/sierra/docker-compose.yml logs -f

# rebuild after a code update
cd ~/sierra && git pull && sudo systemctl restart sierra
```

## Troubleshooting

**Browser warns about the certificate.** Expected — it's self-signed. Accept once.

**Can't reach `https://<pi-ip>/` from your phone.** Check that the Pi is on the same network and the firewall (if any) allows port 443. The installer binds the UI to `0.0.0.0`.

**`GitHub rejected the token (401)`.** PAT is wrong, expired, or revoked. Generate a new one.

**`Repo not found (404)`.** Either `REPO=OWNER/REPO` is wrong, or the PAT doesn't have `Contents: read` on that specific repo.

**Backend won't start.** `docker compose -f ~/sierra/docker-compose.yml logs backend`. Most common cause: stale `.env`. Delete it and re-run `install.sh`.

**Switch from mock to real hardware.** Re-run the installer with `--real-hw`. It patches `.env` and restarts containers — your database is preserved.
