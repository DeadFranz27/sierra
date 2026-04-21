#!/usr/bin/env bash
# Sierra — one-shot installer for Raspberry Pi (or any Debian/Ubuntu host).
#
#   sudo ./scripts/install.sh              # mock mode (default)
#   sudo ./scripts/install.sh --real-hw    # real ESPHome hardware on the LAN
#   sudo ./scripts/install.sh --no-autostart
#
# What it does:
#   1. Verifies OS + architecture (arm64, armv7, amd64)
#   2. Installs Docker Engine + compose plugin if missing
#   3. Generates .env with strong random secrets (idempotent — re-uses existing .env)
#   4. Generates a self-signed TLS certificate
#   5. Builds and starts the full stack
#   6. Installs a systemd unit so Sierra comes up at boot
#   7. Prints the LAN URL and the demo credentials
set -euo pipefail

# ── paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIERRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SIERRA_DIR/.env"
ENV_EXAMPLE="$SIERRA_DIR/.env.example"
CERTS_DIR="$SIERRA_DIR/certs"
SYSTEMD_UNIT="/etc/systemd/system/sierra.service"

# ── flags ──────────────────────────────────────────────────────────────────────
REAL_HW=0
AUTOSTART=1
for arg in "$@"; do
    case "$arg" in
        --real-hw) REAL_HW=1 ;;
        --no-autostart) AUTOSTART=0 ;;
        -h|--help)
            sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

# ── output helpers ─────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'
else
    B=""; G=""; Y=""; R=""; D=""; N=""
fi
step() { printf '\n%s▸ %s%s\n' "$B" "$1" "$N"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
die()  { printf '\n%s✗ %s%s\n' "$R" "$1" "$N" >&2; exit 1; }

# ── 0. sanity ──────────────────────────────────────────────────────────────────
step "Sanity checks"

if [ "$(id -u)" -ne 0 ]; then
    die "Run with sudo: sudo $0 $*"
fi

# SUDO_USER is the human who invoked sudo — we use it for the docker group and unit ownership.
TARGET_USER="${SUDO_USER:-root}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
ok "Target user: $TARGET_USER"

ARCH="$(uname -m)"
case "$ARCH" in
    aarch64|arm64)   ok "Architecture: $ARCH (Raspberry Pi 4/5 64-bit, ok)" ;;
    armv7l|armhf)    ok "Architecture: $ARCH (Raspberry Pi 3 32-bit, ok)"
                     warn "32-bit ARM is supported but slower — consider 64-bit Pi OS." ;;
    x86_64|amd64)    ok "Architecture: $ARCH (dev host, ok)" ;;
    *) die "Unsupported architecture: $ARCH" ;;
esac

if [ -f /etc/os-release ]; then
    . /etc/os-release
    ok "OS: ${PRETTY_NAME:-unknown}"
else
    warn "Cannot detect OS (no /etc/os-release). Assuming Debian-compatible."
fi

# ── 1. docker ──────────────────────────────────────────────────────────────────
step "Docker"

if command -v docker >/dev/null 2>&1; then
    ok "Docker already installed ($(docker --version))"
else
    warn "Docker not found — installing via get.docker.com"
    curl -fsSL https://get.docker.com | sh
    ok "Docker installed"
fi

if docker compose version >/dev/null 2>&1; then
    ok "Compose plugin ok ($(docker compose version --short))"
else
    warn "Compose plugin missing — installing"
    apt-get update -qq
    apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker >/dev/null 2>&1 || true

if ! getent group docker | grep -q "\b$TARGET_USER\b"; then
    usermod -aG docker "$TARGET_USER"
    warn "Added $TARGET_USER to the docker group. Log out + back in for it to take effect."
fi

# ── 2. .env ────────────────────────────────────────────────────────────────────
step "Environment file"

gen_hex() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
gen_pw()  { head -c 24 /dev/urandom | base64 | tr -d '=+/'; }

if [ -f "$ENV_FILE" ]; then
    ok "Re-using existing .env (will only patch MOCK_MODE + *_BIND values)"
else
    [ -f "$ENV_EXAMPLE" ] || die ".env.example not found at $ENV_EXAMPLE"
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    SESSION_SECRET="$(gen_hex)"
    ARGON2_PEPPER="$(gen_hex)"
    MQTT_PASS="$(gen_pw)"
    SIERRA_HUB_MQTT_PASS="$(gen_pw)"

    # inline substitutions — sed -i differs on BSD/macOS, we assume GNU sed on Pi/Debian
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|"                 "$ENV_FILE"
    sed -i "s|^ARGON2_PEPPER=.*|ARGON2_PEPPER=$ARGON2_PEPPER|"                   "$ENV_FILE"
    sed -i "s|^MQTT_PASS=.*|MQTT_PASS=$MQTT_PASS|"                                "$ENV_FILE"
    sed -i "s|^SIERRA_HUB_MQTT_PASS=.*|SIERRA_HUB_MQTT_PASS=$SIERRA_HUB_MQTT_PASS|" "$ENV_FILE"

    chown "$TARGET_USER":"$TARGET_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    ok "Generated fresh .env with random secrets"
fi

# Mode + LAN binding — rewritten on every run so flags take effect
set_env() {  # set_env KEY VALUE
    local key="$1" val="$2"
    if grep -q "^$key=" "$ENV_FILE"; then
        sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    fi
}

if [ "$REAL_HW" -eq 1 ]; then
    set_env MOCK_MODE false
    set_env MQTT_BIND 0.0.0.0     # ESPHome needs LAN access to the broker
    ok "Real-hardware mode: MOCK_MODE=false, MQTT exposed on LAN"
else
    set_env MOCK_MODE true
    set_env MQTT_BIND 127.0.0.1
    ok "Mock mode: fake zones + simulated sensors"
fi

# Always expose the web UI on the LAN — that's the whole point of running on a Pi
set_env HTTP_BIND 0.0.0.0
set_env BACKEND_BIND 127.0.0.1
# ALLOWED_ORIGINS must include the LAN IP used for the UI
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$LAN_IP" ] && LAN_IP="localhost"
set_env ALLOWED_ORIGINS "https://localhost,https://$LAN_IP"

# ── 3. certs ───────────────────────────────────────────────────────────────────
step "TLS certificate"
if [ -f "$CERTS_DIR/sierra.crt" ]; then
    ok "Certificate already exists — keeping it"
else
    sh "$SCRIPT_DIR/gen-certs.sh"
    chown -R "$TARGET_USER":"$TARGET_USER" "$CERTS_DIR"
fi

# ── 4. compose build + up ──────────────────────────────────────────────────────
step "Building and starting containers (this takes a few minutes on first run)"

COMPOSE_FILES=(-f "$SIERRA_DIR/docker-compose.yml")
if [ "$REAL_HW" -eq 1 ]; then
    COMPOSE_FILES+=(-f "$SIERRA_DIR/docker-compose.real.yml")
fi

# Run compose as the target user so image/volume ownership is sane
sudo -u "$TARGET_USER" docker compose "${COMPOSE_FILES[@]}" --project-directory "$SIERRA_DIR" build
sudo -u "$TARGET_USER" docker compose "${COMPOSE_FILES[@]}" --project-directory "$SIERRA_DIR" up -d

# ── 5. health check ────────────────────────────────────────────────────────────
step "Waiting for backend to be healthy"
HEALTHY=0
for i in $(seq 1 60); do
    if curl -fsS -o /dev/null -k "https://127.0.0.1/api/health" 2>/dev/null \
    || curl -fsS -o /dev/null "http://127.0.0.1:8000/health" 2>/dev/null; then
        HEALTHY=1; break
    fi
    sleep 2
done
[ "$HEALTHY" -eq 1 ] && ok "Backend is up" || warn "Backend not responding yet — check: docker compose logs backend"

# ── 6. systemd autostart ───────────────────────────────────────────────────────
if [ "$AUTOSTART" -eq 1 ]; then
    step "Autostart at boot (systemd)"
    if [ -f "$SCRIPT_DIR/sierra.service" ]; then
        sed "s|__SIERRA_DIR__|$SIERRA_DIR|g; s|__USER__|$TARGET_USER|g" \
            "$SCRIPT_DIR/sierra.service" > "$SYSTEMD_UNIT"
        systemctl daemon-reload
        systemctl enable sierra.service >/dev/null
        ok "sierra.service enabled — run 'systemctl status sierra' to inspect"
    else
        warn "scripts/sierra.service template missing — skipping systemd unit"
    fi
else
    warn "Autostart skipped (--no-autostart)"
fi

# ── 7. summary ─────────────────────────────────────────────────────────────────
step "Done"
cat <<EOF
  ${G}Sierra is running.${N}

  Open the UI:     ${B}https://$LAN_IP/${N}
                   (self-signed cert — your browser will warn once, then accept)

  Demo credentials: printed by the backend on first boot. Check:
    ${D}docker compose -f $SIERRA_DIR/docker-compose.yml logs backend | grep -i demo${N}

  Useful commands:
    Stop:    ${D}docker compose -f $SIERRA_DIR/docker-compose.yml down${N}
    Restart: ${D}sudo systemctl restart sierra${N}
    Logs:    ${D}docker compose -f $SIERRA_DIR/docker-compose.yml logs -f${N}

EOF
