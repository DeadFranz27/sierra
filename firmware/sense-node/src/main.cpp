#include <Arduino.h>
#include <WiFi.h>

#include "config.h"
#include "log.h"
#include "nvs_store.h"
#include "state.h"
#include "wifi_provisioning.h"
#include "pair_server.h"
#include "mqtt_client.h"

static String mac_short() {
  String m = WiFi.macAddress();
  m.replace(":", "");
  return m.substring(m.length() - 4);
}

static void decide_initial_state() {
  WifiCreds w;
  MqttCreds m;
  const bool have_wifi = nvs_load_wifi(w);
  const bool have_mqtt = nvs_load_mqtt(m);

  if (!have_wifi) {
    LOG_I("boot", "no wifi creds, going to AP_PROVISIONING");
    state_transition(STATE_AP_PROVISIONING);
    return;
  }
  if (!have_mqtt) {
    LOG_I("boot", "have wifi (%s) but no mqtt creds, going to PAIRING", w.ssid.c_str());
    state_transition(STATE_PAIRING);
    return;
  }
  LOG_I("boot", "have wifi + mqtt creds, going to RUNNING");
  state_transition(STATE_RUNNING);
}

void setup() {
  log_init(115200);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  pinMode(PIN_SENSOR_POWER, OUTPUT);
  digitalWrite(PIN_SENSOR_POWER, LOW);
  pinMode(PIN_RESET_BUTTON, INPUT_PULLUP);

  LOG_I("boot", "sierra sense-node fw=%s hub=%s kind=%s",
        FW_VERSION, SIERRA_HUB_ID, DEVICE_KIND);
  LOG_I("boot", "mac=%s short=%s", WiFi.macAddress().c_str(), mac_short().c_str());

  nvs_init();
  decide_initial_state();

  if (g_state == STATE_AP_PROVISIONING) {
    wifi_provisioning_begin();
  } else if (g_state == STATE_PAIRING || g_state == STATE_RUNNING) {
    if (!wifi_sta_connect()) return;
    if (g_state == STATE_PAIRING) {
      pair_server_begin();
    } else {
      mqtt_client_begin();
    }
  }
}

void loop() {
  switch (g_state) {
    case STATE_AP_PROVISIONING:
      wifi_provisioning_loop();
      break;
    case STATE_PAIRING:
      pair_server_loop();
      break;
    case STATE_RUNNING:
      mqtt_client_loop();
      break;
    case STATE_FACTORY_RESET:
      nvs_clear_all();
      LOG_I("reset", "restarting");
      delay(200);
      ESP.restart();
      break;
    case STATE_BOOT:
      delay(100);
      break;
  }
}
