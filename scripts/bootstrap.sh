#!/usr/bin/env bash
# Sierra — bootstrap for a fresh Raspberry Pi.
#
# Clones the private repo using a short-lived GitHub Personal Access Token,
# strips the token from the stored remote URL, and runs install.sh.
#
# Usage (interactive — recommended):
#     curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/bootstrap.sh | sudo REPO=OWNER/REPO bash
#
#   You'll be prompted for the PAT (input is hidden).
#
# Usage (non-interactive, e.g. from CI):
#     sudo REPO=OWNER/REPO GITHUB_TOKEN=ghp_xxx bash bootstrap.sh
#
# Flags passed after `--` are forwarded to install.sh:
#     sudo REPO=OWNER/REPO bash bootstrap.sh -- --real-hw
set -euo pipefail

# ── args / env ─────────────────────────────────────────────────────────────────
REPO="${REPO:-}"
BRANCH="${BRANCH:-main}"
TARGET_DIR="${TARGET_DIR:-$HOME/sierra}"
INSTALL_ARGS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --) shift; INSTALL_ARGS=("$@"); break ;;
        -h|--help)
            sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

# When piped via `curl | sudo bash`, $HOME may be /root — prefer the invoking user's home.
if [ "${SUDO_USER:-}" ] && [ "$(id -u)" -eq 0 ] && [ "$TARGET_DIR" = "/root/sierra" ]; then
    TARGET_DIR="$(getent passwd "$SUDO_USER" | cut -d: -f6)/sierra"
fi

# ── output helpers ─────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
else
    B=""; G=""; Y=""; R=""; N=""
fi
step() { printf '\n%s▸ %s%s\n' "$B" "$1" "$N"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
die()  { printf '\n%s✗ %s%s\n' "$R" "$1" "$N" >&2; exit 1; }

# ── 0. sanity ──────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "Run with sudo."
[ -n "$REPO" ]       || die "Set REPO=owner/repo (e.g. REPO=francescotroian/sierra)"

# ── 1. base packages ───────────────────────────────────────────────────────────
step "Base packages"
if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y --no-install-recommends git curl ca-certificates
fi
ok "git + curl ready"

# ── 2. PAT ─────────────────────────────────────────────────────────────────────
step "GitHub authentication"
if [ -z "${GITHUB_TOKEN:-}" ]; then
    # Read from the controlling TTY so `curl | sudo bash` still prompts.
    if [ -r /dev/tty ]; then
        printf "  Paste your GitHub fine-grained PAT (input hidden): "
        # shellcheck disable=SC2162
        stty -echo < /dev/tty
        read GITHUB_TOKEN < /dev/tty
        stty echo < /dev/tty
        printf '\n'
    else
        die "No GITHUB_TOKEN in env and no TTY available. Set GITHUB_TOKEN and retry."
    fi
fi
[ -n "${GITHUB_TOKEN:-}" ] || die "Empty token."
ok "Token received (${#GITHUB_TOKEN} chars)"

# Validate with a lightweight API call before we try to clone.
HTTP_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO" || echo "000")"
case "$HTTP_CODE" in
    200) ok "Token has access to $REPO" ;;
    401) die "GitHub rejected the token (401). Generate a fresh PAT." ;;
    404) die "Repo $REPO not found, or token lacks 'Contents: read' on it (404)." ;;
    *)   die "Unexpected GitHub API response: HTTP $HTTP_CODE" ;;
esac

# ── 3. clone ───────────────────────────────────────────────────────────────────
step "Cloning $REPO into $TARGET_DIR"
if [ -d "$TARGET_DIR/.git" ]; then
    ok "Repo already present — pulling latest"
    git -C "$TARGET_DIR" -c "http.extraheader=Authorization: Bearer $GITHUB_TOKEN" \
        pull --ff-only origin "$BRANCH"
else
    mkdir -p "$(dirname "$TARGET_DIR")"
    # Use an in-memory header instead of embedding the token in the remote URL, so
    # the PAT never gets written to .git/config.
    git -c "http.extraheader=Authorization: Bearer $GITHUB_TOKEN" \
        clone --branch "$BRANCH" --depth 1 \
        "https://github.com/$REPO.git" "$TARGET_DIR"
fi
# Make sure the on-disk remote is clean (no token anywhere).
git -C "$TARGET_DIR" remote set-url origin "https://github.com/$REPO.git"
# Chown to the invoking user so git/docker don't need sudo later.
if [ "${SUDO_USER:-}" ]; then
    chown -R "$SUDO_USER":"$SUDO_USER" "$TARGET_DIR"
fi
unset GITHUB_TOKEN
ok "Clone complete (token stripped from remote config)"

# ── 4. hand off to installer ───────────────────────────────────────────────────
step "Running install.sh"
INSTALL_SH="$TARGET_DIR/scripts/install.sh"
[ -x "$INSTALL_SH" ] || chmod +x "$INSTALL_SH"
exec "$INSTALL_SH" "${INSTALL_ARGS[@]}"
