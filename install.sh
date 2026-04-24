#!/usr/bin/env bash
# Sierra — one-command installer.
#
# Simple path (public repo):
#     curl -fsSL https://raw.githubusercontent.com/DeadFranz27/sierra/main/install.sh | sudo bash
#
# If you already cloned the repo:
#     cd sierra && sudo ./install.sh
#
# Flags (all optional):
#     --real-hw          Use real ESPHome hardware instead of the mock simulator.
#     --no-autostart     Don't register the systemd unit (manual start only).
#     --branch=NAME      Clone a branch other than main (default: main).
#     --dir=PATH         Where to install (default: ~/sierra for the invoking user).
#
set -euo pipefail

SIERRA_VERSION="0.3.0"
DEFAULT_REPO="DeadFranz27/sierra"

# ── flags ──────────────────────────────────────────────────────────────────────
REAL_HW=0
AUTOSTART=1
DEMO_MODE=0
BRANCH="main"
TARGET_DIR=""

for arg in "$@"; do
    case "$arg" in
        --real-hw)          REAL_HW=1 ;;
        --no-autostart)     AUTOSTART=0 ;;
        --demo)             DEMO_MODE=1 ;;
        --branch=*)         BRANCH="${arg#--branch=}" ;;
        --dir=*)            TARGET_DIR="${arg#--dir=}" ;;
        -h|--help)
            sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
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
step "Sierra installer v$SIERRA_VERSION"

[ "$(id -u)" -eq 0 ] || die "Run with sudo:  sudo bash install.sh"

TARGET_USER="${SUDO_USER:-root}"
[ "$TARGET_USER" = "root" ] && warn "Running as root (no SUDO_USER). Installing into /root/sierra."
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
[ -z "$TARGET_DIR" ] && TARGET_DIR="$TARGET_HOME/sierra"
ok "Target user: $TARGET_USER"
ok "Install dir: $TARGET_DIR"

case "$(uname -m)" in
    aarch64|arm64)   ok "Architecture: ARM64 (Raspberry Pi 4/5, ok)" ;;
    armv7l|armhf)    ok "Architecture: 32-bit ARM (Raspberry Pi 3, ok but slow)" ;;
    x86_64|amd64)    ok "Architecture: x86_64 (dev host, ok)" ;;
    *)               die "Unsupported architecture: $(uname -m)" ;;
esac

# ── 1. network + base packages ─────────────────────────────────────────────────
step "Base packages"

# Fail early if the Pi has no internet — every subsequent step needs it.
if ! curl -fsS --max-time 10 -o /dev/null https://github.com; then
    die "No internet on this host. Check Wi-Fi / Ethernet and DNS, then re-run.
         Quick test:  ping -c1 8.8.8.8  &&  nslookup github.com"
fi
ok "Internet reachable"

APT_UPDATED=0
apt_update_once() { [ "$APT_UPDATED" -eq 0 ] && apt-get update -qq && APT_UPDATED=1; }

for pkg in git curl ca-certificates openssl; do
    if ! command -v "$pkg" >/dev/null 2>&1; then
        apt_update_once
        apt-get install -y --no-install-recommends "$pkg" \
            || die "Failed to install $pkg. Is this a Debian-based system?"
    fi
done
ok "git, curl, openssl ready"

# ── 2. decide: are we already inside the repo, or do we need to clone? ─────────
step "Source tree"

# Are we running from inside a checked-out copy of the repo?
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
INSIDE_REPO=0
if [ -f "$SCRIPT_PATH" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    if [ -f "$SCRIPT_DIR/docker-compose.yml" ] && [ -d "$SCRIPT_DIR/backend" ]; then
        INSIDE_REPO=1
        # If the user ran `sudo ./install.sh` from the repo, respect that location
        # instead of moving things into ~/sierra.
        TARGET_DIR="$SCRIPT_DIR"
        ok "Running from an existing checkout: $TARGET_DIR"
    fi
fi

if [ "$INSIDE_REPO" -eq 0 ]; then
    if [ -d "$TARGET_DIR/.git" ]; then
        ok "Repo already present at $TARGET_DIR — pulling latest"
        sudo -u "$TARGET_USER" git -C "$TARGET_DIR" pull --ff-only origin "$BRANCH" \
            || die "git pull failed. Check that $DEFAULT_REPO is still public, or fix conflicts manually."
    else
        mkdir -p "$(dirname "$TARGET_DIR")"
        chown "$TARGET_USER":"$TARGET_USER" "$(dirname "$TARGET_DIR")"
        warn "Cloning $DEFAULT_REPO (must be publicly accessible)"
        sudo -u "$TARGET_USER" git clone --branch "$BRANCH" --depth 1 \
            "https://github.com/$DEFAULT_REPO.git" "$TARGET_DIR" \
            || die "Clone failed. Is the repo public and the branch '$BRANCH' valid?"
        ok "Cloned into $TARGET_DIR"
    fi
fi

# From here on we work inside $TARGET_DIR
cd "$TARGET_DIR"

# ── 3. Docker ──────────────────────────────────────────────────────────────────
step "Docker"
if command -v docker >/dev/null 2>&1; then
    ok "Docker present ($(docker --version | awk '{print $3}' | tr -d ,))"
else
    warn "Installing Docker via get.docker.com (a few minutes)"
    # Fetch first, then run — so a network failure is caught explicitly.
    DOCKER_INSTALLER="$(mktemp)"
    if ! curl -fsSL -o "$DOCKER_INSTALLER" https://get.docker.com; then
        rm -f "$DOCKER_INSTALLER"
        die "Could not download Docker installer. Check the Pi's internet connection:
         curl -v https://get.docker.com"
    fi
    sh "$DOCKER_INSTALLER" || { rm -f "$DOCKER_INSTALLER"; die "Docker install script failed. Re-run with 'sudo bash install.sh' and read the output above."; }
    rm -f "$DOCKER_INSTALLER"

    # Verify it actually worked.
    if ! command -v docker >/dev/null 2>&1; then
        die "Docker install reported success but 'docker' is not on PATH. Try:
         sudo apt-get install -y docker.io docker-compose-plugin"
    fi
    ok "Docker installed ($(docker --version | awk '{print $3}' | tr -d ,))"
fi

# Compose v2 plugin — three-tier install: apt → Docker repo → GitHub binary.
# The GitHub-binary fallback works on any Debian release, including ones newer than
# what download.docker.com has indexed (seen on Debian 13 trixie early 2026).
install_compose_plugin() {
    # Tier 1: apt (works if docker.io or docker-ce already brought the plugin in)
    apt_update_once
    if apt-get install -y docker-compose-plugin >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        return 0
    fi

    # Tier 2: add Docker's official repo, try again. Works when apt knows the codename.
    local codename
    codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
    if [ -n "$codename" ] && ! [ -f /etc/apt/sources.list.d/docker.list ]; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null || \
        curl -fsSL https://download.docker.com/linux/raspbian/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null || true
        chmod a+r /etc/apt/keyrings/docker.asc 2>/dev/null || true
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $codename stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -qq 2>/dev/null || true
        if apt-get install -y docker-compose-plugin >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
            return 0
        fi
        # Tier 2 failed — probably because trixie (or similar) isn't yet in download.docker.com.
        # Remove the list so apt-update doesn't keep failing on subsequent runs.
        rm -f /etc/apt/sources.list.d/docker.list
    fi

    # Tier 3: drop the compose binary into the CLI-plugins dir. Works offline-ish
    # (one GitHub download), independent of the distro.
    warn "Falling back to GitHub binary for docker-compose-plugin"
    local arch compose_version plugins_dir
    arch="$(uname -m)"
    case "$arch" in
        aarch64|arm64)  arch="aarch64" ;;
        armv7l|armhf)   arch="armv7" ;;
        x86_64|amd64)   arch="x86_64" ;;
        *) die "Unsupported arch for compose binary fallback: $arch" ;;
    esac
    compose_version="v2.32.4"
    plugins_dir="/usr/local/lib/docker/cli-plugins"
    mkdir -p "$plugins_dir"
    if ! curl -fsSL -o "$plugins_dir/docker-compose" \
        "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-${arch}"; then
        die "Could not download docker compose binary from GitHub. Check connectivity:
         curl -v https://github.com/docker/compose/releases/"
    fi
    chmod +x "$plugins_dir/docker-compose"
    docker compose version >/dev/null 2>&1 \
        || die "Installed compose binary but 'docker compose' still fails. Check $plugins_dir/docker-compose."
    return 0
}

if ! docker compose version >/dev/null 2>&1; then
    warn "Compose plugin missing — installing"
    install_compose_plugin
fi
ok "Compose plugin ready ($(docker compose version --short))"

# Start the Docker daemon (fresh installs have it disabled on some images).
systemctl enable --now docker >/dev/null 2>&1 || true
if ! systemctl is-active --quiet docker; then
    die "Docker daemon is not running. Check:
         sudo systemctl status docker
         sudo journalctl -u docker -n 50"
fi
ok "Docker daemon is running"

# Prove the daemon actually accepts commands as root.
if ! docker info >/dev/null 2>&1; then
    die "'docker info' failed. The daemon might still be initializing — wait 10s and re-run."
fi

if ! getent group docker | grep -q "\b$TARGET_USER\b"; then
    usermod -aG docker "$TARGET_USER"
    warn "Added $TARGET_USER to the 'docker' group — log out + back in for your shell to pick it up."
fi

# ── 4. .env ────────────────────────────────────────────────────────────────────
step "Environment file"
ENV_FILE="$TARGET_DIR/.env"
ENV_EXAMPLE="$TARGET_DIR/.env.example"

gen_hex() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
gen_pw()  { head -c 24 /dev/urandom | base64 | tr -d '=+/' | cut -c1-24; }

set_env() {  # set_env KEY VALUE
    local key="$1" val="$2"
    if grep -q "^$key=" "$ENV_FILE"; then
        # Use a delimiter unlikely to appear in secrets
        local esc
        esc=$(printf '%s' "$val" | sed 's|[\\|&]|\\&|g')
        sed -i "s|^$key=.*|$key=$esc|" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    fi
}

if [ -f "$ENV_FILE" ]; then
    ok "Re-using existing .env (secrets preserved, mode + LAN bind re-applied)"
else
    [ -f "$ENV_EXAMPLE" ] || die ".env.example missing — corrupt repo?"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    chown "$TARGET_USER":"$TARGET_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"

    set_env SESSION_SECRET        "$(gen_hex)"
    set_env ARGON2_PEPPER         "$(gen_hex)"
    set_env MQTT_PASS             "$(gen_pw)"
    set_env SIERRA_HUB_MQTT_PASS  "$(gen_pw)"
    ok "Generated fresh .env with random secrets"
fi

if [ "$REAL_HW" -eq 1 ]; then
    set_env MOCK_MODE   "false"
    set_env MQTT_BIND   "0.0.0.0"
    ok "Real-hardware mode — MQTT broker will be reachable on the LAN"
else
    set_env MOCK_MODE   "true"
    set_env MQTT_BIND   "127.0.0.1"
    ok "Demo mode — simulated zones and sensors"
fi

if [ "$DEMO_MODE" -eq 1 ]; then
    set_env SIERRA_DEMO_MODE "1"
    ok "Demo account enabled — 'demo' / 'sierra2024' will work alongside any account you create"
else
    set_env SIERRA_DEMO_MODE "0"
fi

set_env HTTP_BIND    "0.0.0.0"
set_env BACKEND_BIND "127.0.0.1"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$LAN_IP" ] && LAN_IP="localhost"
HOSTNAME_LOCAL="$(hostname 2>/dev/null).local"
set_env ALLOWED_ORIGINS "https://localhost,https://$LAN_IP,https://$HOSTNAME_LOCAL"

# ── 5. TLS certificate ─────────────────────────────────────────────────────────
step "TLS certificate"
CERTS_DIR="$TARGET_DIR/certs"
mkdir -p "$CERTS_DIR"
if [ -f "$CERTS_DIR/sierra.crt" ]; then
    ok "Existing certificate kept"
else
    openssl req -x509 -nodes -days 730 \
        -newkey rsa:2048 \
        -keyout "$CERTS_DIR/sierra.key" \
        -out    "$CERTS_DIR/sierra.crt" \
        -subj   "/C=IT/ST=FVG/O=Sierra/CN=$HOSTNAME_LOCAL" \
        -addext "subjectAltName=DNS:localhost,DNS:$HOSTNAME_LOCAL,IP:127.0.0.1,IP:$LAN_IP" \
        >/dev/null 2>&1
    chmod 600 "$CERTS_DIR/sierra.key"
    ok "Self-signed cert written (valid 2 years, includes $HOSTNAME_LOCAL and $LAN_IP)"
fi
chown -R "$TARGET_USER":"$TARGET_USER" "$CERTS_DIR"

# ── 6. Build + up ──────────────────────────────────────────────────────────────
step "Building and starting containers (5–10 min on first run)"
COMPOSE_FILES=(-f "$TARGET_DIR/docker-compose.yml")
if [ "$REAL_HW" -eq 1 ] && [ -f "$TARGET_DIR/docker-compose.real.yml" ]; then
    COMPOSE_FILES+=(-f "$TARGET_DIR/docker-compose.real.yml")
fi

# Run compose as root — the image + volume ownership ends up fine because the containers
# themselves drop privileges inside, and this sidesteps the "user was just added to the
# docker group but the new group isn't active yet in this session" trap.
docker compose "${COMPOSE_FILES[@]}" --project-directory "$TARGET_DIR" build \
    || die "docker compose build failed. Scroll up for the actual error."
docker compose "${COMPOSE_FILES[@]}" --project-directory "$TARGET_DIR" up -d \
    || die "docker compose up failed. Check: docker compose -f $TARGET_DIR/docker-compose.yml ps"

# ── 7. health check ────────────────────────────────────────────────────────────
step "Waiting for backend"
HEALTHY=0
for _ in $(seq 1 60); do
    if curl -fsS -k -o /dev/null "https://127.0.0.1/api/health" 2>/dev/null \
    || curl -fsS    -o /dev/null "http://127.0.0.1:8000/health" 2>/dev/null; then
        HEALTHY=1; break
    fi
    sleep 2
done
[ "$HEALTHY" -eq 1 ] && ok "Backend is up" || warn "Backend not responding yet — check  docker compose logs backend"

# ── 8. systemd autostart ───────────────────────────────────────────────────────
if [ "$AUTOSTART" -eq 1 ]; then
    step "Autostart at boot"
    TEMPLATE="$TARGET_DIR/scripts/sierra.service"
    if [ -f "$TEMPLATE" ]; then
        sed "s|__SIERRA_DIR__|$TARGET_DIR|g; s|__USER__|$TARGET_USER|g" \
            "$TEMPLATE" > /etc/systemd/system/sierra.service
        systemctl daemon-reload
        systemctl enable sierra.service >/dev/null
        ok "sierra.service enabled — will start at every boot"
    else
        warn "scripts/sierra.service template missing — skipping"
    fi
fi

# ── 9. summary ─────────────────────────────────────────────────────────────────
step "Done — Sierra v$SIERRA_VERSION is running"
if [ "$DEMO_MODE" -eq 1 ]; then
    FIRST_LOGIN_MSG="  Demo mode is on. Accedi con ${B}demo${N} / ${B}sierra2024${N}, oppure crea
  il tuo account dal wizard al primo avvio."
else
    FIRST_LOGIN_MSG="  Al primo accesso l'interfaccia ti chiederà di creare username e password
  per il tuo account. Nessuna credenziale di default."
fi
cat <<EOF
  Open the UI:    ${B}https://$HOSTNAME_LOCAL/${N}
                  ${D}(or https://$LAN_IP/ if .local doesn't resolve)${N}

  Accept the self-signed certificate once.

$FIRST_LOGIN_MSG

  Useful commands:
    Status:   ${D}sudo systemctl status sierra${N}
    Stop:     ${D}sudo systemctl stop sierra${N}
    Restart:  ${D}sudo systemctl restart sierra${N}
    Logs:     ${D}docker compose -f $TARGET_DIR/docker-compose.yml logs -f${N}
    Update:   ${D}cd $TARGET_DIR && git pull && sudo systemctl restart sierra${N}

EOF
