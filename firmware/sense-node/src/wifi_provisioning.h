#pragma once

// AP-mode provisioning. Raises `Sierra-Setup-<mac4>` on 192.168.4.1,
// serves a small form, saves SSID/password to NVS, then restarts.
void wifi_provisioning_begin();
void wifi_provisioning_loop();

// Attempts a STA connection with creds from NVS.
// Returns true on success. On failure, clears wifi creds and restarts into AP mode.
bool wifi_sta_connect(unsigned long timeout_ms = 20000);
