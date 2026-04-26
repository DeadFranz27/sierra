#pragma once

// Identity
#ifndef FW_VERSION
#define FW_VERSION "0.0.0-dev"
#endif
#ifndef SIERRA_HUB_ID
#define SIERRA_HUB_ID "001"
#endif

#define DEVICE_KIND "sense"

// Pins (ESP32-WROOM-32 DevKit)
#define PIN_ADC          34   // ADC1_CH6, input-only
#define PIN_SENSOR_POWER 25   // power-cycle the capacitive probe
#define PIN_STATUS_LED   2    // onboard LED
#define PIN_RESET_BUTTON 0    // boot button, long-press for factory reset

// Intervals (ms)
#define INTERVAL_MOISTURE_MS 60000
#define INTERVAL_STATUS_MS   60000
#define MQTT_RECONNECT_MS    5000
#define FACTORY_RESET_HOLD_MS 5000
#define ANNOUNCE_INTERVAL_MS 5000

// Zero-touch pairing: while in PAIRING state, the device POSTs to this URL
// every ANNOUNCE_INTERVAL_MS so the hub UI can discover it without the user
// ever typing a code. Hardcoded LAN IP for the home Pi — mDNS on the
// Raspberry advertises the docker bridge instead of the LAN address, so
// sierra-hub.local resolves to 172.18.0.1 from the device's perspective
// and the announce never lands.
#define HUB_ANNOUNCE_URL "http://192.168.3.87/api/devices/announce"

// NVS
#define NVS_NAMESPACE "sierra"
#define NVS_KEY_WIFI_SSID "wifi_ssid"
#define NVS_KEY_WIFI_PASS "wifi_pass"
#define NVS_KEY_MQTT_USER "mqtt_user"
#define NVS_KEY_MQTT_PASS "mqtt_pass"

// MQTT broker is on the same LAN as the hub. The hub IP is discovered via
// the pair handshake — the backend POSTs it alongside the MQTT credentials.
#define NVS_KEY_MQTT_HOST "mqtt_host"
#define MQTT_PORT 1883

// AP provisioning
#define AP_SSID_PREFIX "Sierra-Setup-"
#define AP_PASSWORD   ""   // open network; user only reaches it once at setup
