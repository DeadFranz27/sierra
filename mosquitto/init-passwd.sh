#!/bin/sh
# Generates Mosquitto password file from env vars at container startup.
# Runs as root before mosquitto drops privileges.
set -e
PASSWD_FILE=/mosquitto/config/passwd
touch "$PASSWD_FILE"
mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_USER" "$MQTT_PASS"
mosquitto_passwd -b "$PASSWD_FILE" "$SIERRA_HUB_MQTT_USER" "$SIERRA_HUB_MQTT_PASS"
exec mosquitto -c /mosquitto/config/mosquitto.conf
