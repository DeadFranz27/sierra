#include "pair_server.h"

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "config.h"
#include "log.h"
#include "nvs_store.h"
#include "state.h"

static WebServer http(80);
static bool server_up = false;
static unsigned long last_blink = 0;
static unsigned long last_announce = 0;
static bool led_on = false;

// Zero-touch pairing (TOFU). The device announces itself to the hub every
// ANNOUNCE_INTERVAL_MS; the hub UI shows the announcement and the user
// taps "Pair" — no shared secret required. Trust roots in:
//   1. the device's source IP at announce time (LAN-only via nginx);
//   2. the hub being able to reach the device back at that same IP.
//
// /device/info still exposes the legacy pairing_code_hash field as null so
// older hub builds don't choke on a missing key.

static void handle_info() {
  JsonDocument doc;
  doc["kind"]              = DEVICE_KIND;
  doc["mac"]               = WiFi.macAddress();
  doc["firmware"]          = FW_VERSION;
  doc["pairing_code_hash"] = nullptr;
  String body;
  serializeJson(doc, body);
  http.send(200, "application/json", body);
}

static void handle_credentials() {
  // No code check: the hub reached us at our LAN IP — that *is* the trust
  // signal. A drive-by attacker on the same LAN could in theory race the
  // legitimate hub, but home WPA2 is the perimeter and the user is staring
  // at the pair button when this fires. See pair_server.h for the model.
  const String body = http.arg("plain");
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    LOG_W("pair", "/device/credentials: bad json (%s)", err.c_str());
    http.send(400, "text/plain", "bad json");
    return;
  }
  if (!doc["mqtt_username"].is<const char*>() || !doc["mqtt_password"].is<const char*>()) {
    LOG_W("pair", "/device/credentials: missing fields in json body='%s'", body.c_str());
    http.send(400, "text/plain", "missing fields");
    return;
  }

  MqttCreds c;
  c.username = doc["mqtt_username"].as<const char*>();
  c.password = doc["mqtt_password"].as<const char*>();
  // The hub backend called us over HTTP; the MQTT broker is on the same host.
  c.host = http.client().remoteIP().toString();
  nvs_save_mqtt(c);

  http.send(204, "text/plain", "");
  LOG_I("pair", "paired, hub=%s user=%s", c.host.c_str(), c.username.c_str());

  delay(200);
  state_transition(STATE_RUNNING);
  ESP.restart();
}

static void handle_not_found() {
  http.send(404, "text/plain", "not found");
}

static void announce_to_hub() {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  doc["kind"]             = DEVICE_KIND;
  doc["mac"]              = WiFi.macAddress();
  doc["port"]             = 80;
  doc["hostname"]         = WiFi.getHostname();
  doc["firmware_version"] = FW_VERSION;
  String body;
  serializeJson(doc, body);

  HTTPClient client;
  client.setConnectTimeout(2000);
  client.setTimeout(3000);
  if (!client.begin(HUB_ANNOUNCE_URL)) {
    LOG_W("pair", "announce: HTTPClient.begin failed");
    return;
  }
  client.addHeader("Content-Type", "application/json");
  const int code = client.POST(body);
  if (code <= 0) {
    LOG_D("pair", "announce: transport error %d (hub not on LAN yet?)", code);
  } else if (code != 204) {
    LOG_W("pair", "announce: hub returned HTTP %d", code);
  } else {
    LOG_D("pair", "announce: ok");
  }
  client.end();
}

void pair_server_begin() {
  if (server_up) return;

  http.on("/device/info", HTTP_GET, handle_info);
  http.on("/device/credentials", HTTP_POST, handle_credentials);
  http.onNotFound(handle_not_found);
  http.begin();

  server_up = true;
  last_blink = millis();
  last_announce = 0;  // fire announce immediately on first loop pass

  LOG_I("pair", "pair server listening on :80, ip=%s",
        WiFi.localIP().toString().c_str());
  LOG_I("pair", "zero-touch pairing — announcing to %s every %dms",
        HUB_ANNOUNCE_URL, ANNOUNCE_INTERVAL_MS);
}

void pair_server_loop() {
  http.handleClient();

  const unsigned long now = millis();
  if (now - last_blink >= 1000) {
    led_on = !led_on;
    digitalWrite(PIN_STATUS_LED, led_on ? HIGH : LOW);
    last_blink = now;
  }
  if (now - last_announce >= ANNOUNCE_INTERVAL_MS) {
    announce_to_hub();
    last_announce = now;
  }
}
