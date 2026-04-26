#include "mqtt_client.h"

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

#include "config.h"
#include "log.h"
#include "nvs_store.h"
#include "state.h"

static WiFiClient net;
static PubSubClient mqtt(net);
static MqttCreds creds;

static String topic_moisture;
static String topic_status;
static String topic_control;

static unsigned long last_moisture_ms = 0;
static unsigned long last_status_ms   = 0;
static unsigned long last_reconnect_ms = 0;

static bool ntp_started = false;

static String iso8601_now() {
  time_t now = time(nullptr);
  if (now < 1700000000) return "";  // NTP not synced yet
  struct tm tm_utc;
  gmtime_r(&now, &tm_utc);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
  return String(buf);
}

static float fake_moisture_value() {
  // Step 5 will replace this with a real ADC reading.
  // Until then, send a stable value with a small random wiggle so the hub
  // sees live data and the sparkline isn't flat-lined.
  const float base = 42.0f;
  const float jitter = (esp_random() % 200) / 100.0f - 1.0f;  // -1.0 .. +1.0
  return base + jitter;
}

static void publish_moisture() {
  JsonDocument doc;
  doc["value"] = fake_moisture_value();
  const String ts = iso8601_now();
  if (ts.length() > 0) doc["ts"] = ts;
  String body;
  serializeJson(doc, body);
  if (mqtt.publish(topic_moisture.c_str(), body.c_str())) {
    LOG_I("mqtt", "pub %s %s", topic_moisture.c_str(), body.c_str());
  } else {
    LOG_W("mqtt", "pub %s failed", topic_moisture.c_str());
  }
}

static void publish_status() {
  JsonDocument doc;
  doc["rssi"] = WiFi.RSSI();
  doc["fw"]   = FW_VERSION;
  String body;
  serializeJson(doc, body);
  if (mqtt.publish(topic_status.c_str(), body.c_str())) {
    LOG_I("mqtt", "pub %s %s", topic_status.c_str(), body.c_str());
  } else {
    LOG_W("mqtt", "pub %s failed", topic_status.c_str());
  }
}

// Forward declared — wifi_provisioning owns the AP-mode entry.
extern void wifi_provisioning_begin();

static void handle_control(const String& payload) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    LOG_W("mqtt", "control: bad json (%s)", err.c_str());
    return;
  }
  const char* action = doc["action"] | "";
  LOG_I("mqtt", "control: action=%s", action);

  if (strcmp(action, "restart") == 0) {
    delay(200);
    ESP.restart();
  } else if (strcmp(action, "unpair") == 0 || strcmp(action, "factory_reset") == 0) {
    // unpair clears MQTT only; factory_reset wipes wifi too.
    if (strcmp(action, "factory_reset") == 0) nvs_clear_all();
    else nvs_clear_mqtt();
    delay(200);
    ESP.restart();
  } else if (strcmp(action, "reprovision_wifi") == 0) {
    nvs_clear_wifi();
    delay(200);
    ESP.restart();
  } else {
    LOG_W("mqtt", "control: unknown action '%s'", action);
  }
}

static void on_message(char* topic, byte* payload, unsigned int length) {
  String body;
  body.reserve(length);
  for (unsigned int i = 0; i < length; i++) body += (char)payload[i];
  LOG_I("mqtt", "rx %s %s", topic, body.c_str());
  if (topic_control.equals(topic)) handle_control(body);
}

static bool connect_once() {
  // Client ID must be unique on the broker; pair credentials are already
  // per-device, but we still derive a stable client id from the username.
  const String client_id = creds.username;
  LOG_I("mqtt", "connecting to %s:%d as %s ...",
        creds.host.c_str(), MQTT_PORT, creds.username.c_str());

  if (!mqtt.connect(client_id.c_str(),
                    creds.username.c_str(),
                    creds.password.c_str())) {
    LOG_W("mqtt", "connect failed, rc=%d", mqtt.state());
    return false;
  }

  mqtt.subscribe(topic_control.c_str());
  LOG_I("mqtt", "connected, sub %s", topic_control.c_str());

  // Send an immediate status ping so the hub flips us to online quickly.
  publish_status();
  last_status_ms   = millis();
  last_moisture_ms = millis() - INTERVAL_MOISTURE_MS;  // pub moisture asap too
  return true;
}

void mqtt_client_begin() {
  if (!nvs_load_mqtt(creds)) {
    LOG_E("mqtt", "no creds in NVS — cannot start");
    return;
  }

  topic_moisture = String("sierra/hub/") + SIERRA_HUB_ID + "/moisture";
  topic_status   = String("sierra/hub/") + SIERRA_HUB_ID + "/status";
  topic_control  = String("sierra/") + creds.username + "/control";

  if (!ntp_started) {
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    ntp_started = true;
  }

  mqtt.setServer(creds.host.c_str(), MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);
  mqtt.setCallback(on_message);

  connect_once();
  last_reconnect_ms = millis();
}

void mqtt_client_loop() {
  const unsigned long now = millis();

  if (!mqtt.connected()) {
    if (now - last_reconnect_ms >= MQTT_RECONNECT_MS) {
      last_reconnect_ms = now;
      connect_once();
    }
    return;
  }
  mqtt.loop();

  if (now - last_moisture_ms >= INTERVAL_MOISTURE_MS) {
    last_moisture_ms = now;
    publish_moisture();
  }
  if (now - last_status_ms >= INTERVAL_STATUS_MS) {
    last_status_ms = now;
    publish_status();
  }
}
