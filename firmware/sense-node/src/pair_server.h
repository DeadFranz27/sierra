#pragma once

// Zero-touch pairing.
//
// Entered when WiFi STA is up but no MQTT credentials exist in NVS.
//
// Two things happen in parallel:
//   1. We POST a small announce payload to HUB_ANNOUNCE_URL every
//      ANNOUNCE_INTERVAL_MS so the hub UI can list this device as a
//      pair candidate without the user typing anything.
//   2. We expose an HTTP server on :80 that the hub calls back to:
//        GET  /device/info
//              -> { "kind", "mac", "firmware", "pairing_code_hash": null }
//        POST /device/credentials
//              body: { "mqtt_username", "mqtt_password" }
//              -> 204 No Content on success
//
// Trust model (TOFU): we accept whichever caller reaches /device/credentials
// first because the hub had to know our LAN IP to call us, and the only way
// it could know was via the announce we just sent. The shared LAN (WPA2) is
// the security perimeter; the user is physically present at pair time.
//
// On success, MQTT creds are persisted (host = the peer that made the POST)
// and the device transitions to RUNNING and reboots.
void pair_server_begin();
void pair_server_loop();
