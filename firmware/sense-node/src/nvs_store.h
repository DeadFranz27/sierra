#pragma once

#include <Arduino.h>

struct WifiCreds {
  String ssid;
  String password;
};

struct MqttCreds {
  String username;
  String password;
  String host;
};

void nvs_init();

bool nvs_load_wifi(WifiCreds& out);
void nvs_save_wifi(const WifiCreds& creds);
void nvs_clear_wifi();

bool nvs_load_mqtt(MqttCreds& out);
void nvs_save_mqtt(const MqttCreds& creds);
void nvs_clear_mqtt();

void nvs_clear_all();
