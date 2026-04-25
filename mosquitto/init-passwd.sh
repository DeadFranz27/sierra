#!/bin/sh
# Mosquitto entrypoint: seed the password file from env vars, start a poller
# that reloads the broker when the backend rewrites the file (per-device
# credentials are appended at pair time), then exec mosquitto.
set -e
PASSWD_FILE=/mosquitto/config/passwd

# The passwd file is bind-mounted from the host so the backend container can
# write per-device credentials into it. Make sure the static users are present.
touch "$PASSWD_FILE"

# Re-add the static users every boot so rotating MQTT_PASS in .env actually
# takes effect. mosquitto_passwd -b updates an existing entry in place.
mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_USER" "$MQTT_PASS"
mosquitto_passwd -b "$PASSWD_FILE" "$SIERRA_HUB_MQTT_USER" "$SIERRA_HUB_MQTT_PASS"

# Watch the passwd file: when the backend appends/removes a per-device line,
# its mtime changes and we send SIGHUP so mosquitto rereads it. Polling because
# the eclipse-mosquitto image doesn't ship inotify-tools.
(
  last=$(stat -c %Y "$PASSWD_FILE" 2>/dev/null || echo 0)
  while sleep 2; do
    cur=$(stat -c %Y "$PASSWD_FILE" 2>/dev/null || echo 0)
    if [ "$cur" != "$last" ]; then
      last=$cur
      pid=$(pidof mosquitto || true)
      [ -n "$pid" ] && kill -HUP "$pid" && echo "passwd reloaded (SIGHUP $pid)"
    fi
  done
) &

exec mosquitto -c /mosquitto/config/mosquitto.conf
