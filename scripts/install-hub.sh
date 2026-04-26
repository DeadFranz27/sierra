#!/usr/bin/env bash
#
# Sierra hub one-shot host setup.
#
# Run this ONCE on a fresh Raspberry Pi (or any Linux host) where Sierra
# will live. Idempotent — safe to re-run.
#
# It does two things:
#
#   1. Installs and configures avahi so the hub advertises itself as
#      `sierra-hub.local` on the *LAN* interface only. Without this,
#      avahi may publish the docker bridge IP (e.g. 172.18.0.1) and ESP
#      devices on the LAN cannot resolve the hub.
#
#   2. Sets the system hostname to `sierra-hub` so .local resolution
#      works regardless of router/SSID.
#
# Usage:  sudo bash scripts/install-hub.sh
#
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

HOSTNAME_TARGET="sierra-hub"
AVAHI_CONF="/etc/avahi/avahi-daemon.conf"

echo "==> ensuring avahi-daemon is installed"
apt-get update -qq
apt-get install -y -qq avahi-daemon

echo "==> setting hostname to ${HOSTNAME_TARGET}"
hostnamectl set-hostname "${HOSTNAME_TARGET}"
if grep -qE '^\s*127\.0\.1\.1\s' /etc/hosts; then
  sed -i -E "s/^\s*127\.0\.1\.1\s.*$/127.0.1.1\t${HOSTNAME_TARGET}/" /etc/hosts
else
  echo -e "127.0.1.1\t${HOSTNAME_TARGET}" >> /etc/hosts
fi

# Detect LAN interfaces dynamically so this works on any host: Raspberry
# Pi (eth0/wlan0), Debian server (enp*s*/wlp*s*), etc. We exclude
# loopback, docker bridges, veth pairs, and anything else virtual.
echo "==> detecting LAN interfaces"
LAN_IFACES=$(ip -o link show \
  | awk -F': ' '{print $2}' \
  | awk -F'@' '{print $1}' \
  | grep -Ev '^(lo|docker[0-9]+|br-[a-f0-9]+|veth[a-f0-9]+|tun[0-9]+|tap[0-9]+|wg[0-9]+)$' \
  | paste -sd, -)

if [[ -z "${LAN_IFACES}" ]]; then
  echo "ERROR: could not detect any LAN interface — bailing." >&2
  ip -o link show >&2
  exit 1
fi
echo "    LAN interfaces: ${LAN_IFACES}"

echo "==> writing avahi config"
# Rewrite the conf in full from a template. Backing up the original once
# so a re-run doesn't overwrite the user's first backup.
if [[ ! -f "${AVAHI_CONF}.sierra-orig" ]]; then
  cp "${AVAHI_CONF}" "${AVAHI_CONF}.sierra-orig"
fi

cat > "${AVAHI_CONF}" <<EOF
# Managed by sierra/scripts/install-hub.sh — re-run the script to update.
[server]
host-name=${HOSTNAME_TARGET}
use-ipv4=yes
use-ipv6=no
allow-interfaces=${LAN_IFACES}
ratelimit-interval-usec=1000000
ratelimit-burst=1000

[wide-area]
enable-wide-area=yes

[publish]
publish-hinfo=no
publish-workstation=no
publish-aaaa-on-ipv4=no
publish-a-on-ipv6=no

[reflector]

[rlimits]
EOF

echo "==> restarting avahi-daemon"
systemctl enable --now avahi-daemon
systemctl restart avahi-daemon
sleep 2

echo "==> verifying sierra-hub.local resolves to a LAN address"
RESOLVED=$(getent hosts sierra-hub.local | awk '{print $1}' | head -n1 || true)
if [[ -z "${RESOLVED}" ]]; then
  echo "WARN: sierra-hub.local did not resolve. Check: systemctl status avahi-daemon" >&2
elif [[ "${RESOLVED}" =~ ^(172\.1[6-9]|172\.2[0-9]|172\.3[0-1]|169\.254) ]]; then
  echo "WARN: sierra-hub.local resolved to ${RESOLVED} (docker/link-local)." >&2
  echo "      Detected LAN interfaces may be wrong: ${LAN_IFACES}" >&2
  echo "      Check 'ip -o addr' and edit allow-interfaces in ${AVAHI_CONF}." >&2
else
  echo "OK: sierra-hub.local -> ${RESOLVED}"
fi

echo
echo "==> done. ESP devices on the LAN can now reach the hub by name."
echo "    Next: cd to the sierra repo and run 'docker compose up -d --build'."
