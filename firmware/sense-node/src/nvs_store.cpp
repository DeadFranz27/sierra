#include "nvs_store.h"

#include <Preferences.h>

#include "config.h"
#include "log.h"

static Preferences prefs;

static bool open_rw()  { return prefs.begin(NVS_NAMESPACE, false); }
static bool open_ro()  { return prefs.begin(NVS_NAMESPACE, true);  }
static void close_()   { prefs.end(); }

void nvs_init() {
  if (!open_ro()) {
    LOG_W("nvs", "namespace missing on first boot, will be created on first write");
    return;
  }
  close_();
}

bool nvs_load_wifi(WifiCreds& out) {
  if (!open_ro()) return false;
  out.ssid     = prefs.getString(NVS_KEY_WIFI_SSID, "");
  out.password = prefs.getString(NVS_KEY_WIFI_PASS, "");
  close_();
  return out.ssid.length() > 0;
}

void nvs_save_wifi(const WifiCreds& creds) {
  if (!open_rw()) {
    LOG_E("nvs", "save_wifi: open failed");
    return;
  }
  prefs.putString(NVS_KEY_WIFI_SSID, creds.ssid);
  prefs.putString(NVS_KEY_WIFI_PASS, creds.password);
  close_();
  LOG_I("nvs", "wifi creds saved, ssid=%s", creds.ssid.c_str());
}

void nvs_clear_wifi() {
  if (!open_rw()) return;
  prefs.remove(NVS_KEY_WIFI_SSID);
  prefs.remove(NVS_KEY_WIFI_PASS);
  close_();
  LOG_I("nvs", "wifi creds cleared");
}

bool nvs_load_mqtt(MqttCreds& out) {
  if (!open_ro()) return false;
  out.username = prefs.getString(NVS_KEY_MQTT_USER, "");
  out.password = prefs.getString(NVS_KEY_MQTT_PASS, "");
  out.host     = prefs.getString(NVS_KEY_MQTT_HOST, "");
  close_();
  return out.username.length() > 0 && out.password.length() > 0;
}

void nvs_save_mqtt(const MqttCreds& creds) {
  if (!open_rw()) {
    LOG_E("nvs", "save_mqtt: open failed");
    return;
  }
  prefs.putString(NVS_KEY_MQTT_USER, creds.username);
  prefs.putString(NVS_KEY_MQTT_PASS, creds.password);
  prefs.putString(NVS_KEY_MQTT_HOST, creds.host);
  close_();
  LOG_I("nvs", "mqtt creds saved, user=%s host=%s", creds.username.c_str(), creds.host.c_str());
}

void nvs_clear_mqtt() {
  if (!open_rw()) return;
  prefs.remove(NVS_KEY_MQTT_USER);
  prefs.remove(NVS_KEY_MQTT_PASS);
  prefs.remove(NVS_KEY_MQTT_HOST);
  close_();
  LOG_I("nvs", "mqtt creds cleared");
}

void nvs_clear_all() {
  if (!open_rw()) return;
  prefs.clear();
  close_();
  LOG_I("nvs", "all creds cleared");
}
