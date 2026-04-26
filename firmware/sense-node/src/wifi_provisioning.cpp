#include "wifi_provisioning.h"

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>

#include "config.h"
#include "log.h"
#include "nvs_store.h"
#include "state.h"

static WebServer http(80);
static DNSServer dns;
static bool ap_up = false;
static unsigned long last_blink = 0;
static bool led_on = false;

static String ap_ssid() {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  return String(AP_SSID_PREFIX) + mac.substring(mac.length() - 4);
}

static const char PAGE_FORM[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sierra — Wi-Fi setup</title>
<style>
  :root { --moss:#4E7A5C; --stone:#1B1915; --mist:#EDF2EC; }
  * { box-sizing: border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
         background:var(--mist); color:var(--stone); margin:0; padding:24px;
         display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { background:#fff; border-radius:14px; padding:28px 24px; max-width:380px; width:100%;
          box-shadow:0 1px 2px rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.06); }
  h1 { font-family:"Instrument Serif",Georgia,serif; font-weight:400; color:var(--moss);
       margin:0 0 6px; font-size:28px; }
  p  { color:#555; font-size:14px; margin:0 0 22px; line-height:1.45; }
  label { display:block; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
          color:#777; margin:14px 0 6px; }
  input { width:100%; padding:11px 12px; font-size:15px; border:1px solid #d8d8d8;
          border-radius:8px; background:#fafafa; }
  input:focus { outline:none; border-color:var(--moss); background:#fff; }
  button { margin-top:22px; width:100%; padding:12px; background:var(--moss); color:#fff;
           border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; }
  button:hover { filter:brightness(.95); }
  .hint { color:#888; font-size:12px; margin-top:14px; }
</style></head><body>
<form class="card" method="POST" action="/wifi">
  <h1>Connect your sensor</h1>
  <p>Pick your Wi-Fi network. The sensor joins it and won't be reachable here again.</p>
  <label>SSID</label>
  <input name="ssid" required autocomplete="off" autocapitalize="off">
  <label>Password</label>
  <input name="password" type="password" autocomplete="off">
  <button type="submit">Save and restart</button>
  <div class="hint">5 GHz networks are not supported. Use 2.4 GHz.</div>
</form>
</body></html>
)HTML";

static const char PAGE_SAVED[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Sierra — saved</title>
<style>
  body { font-family:-apple-system,sans-serif; background:#EDF2EC; color:#1B1915;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#fff; padding:28px; border-radius:14px; max-width:380px;
          box-shadow:0 10px 30px rgba(0,0,0,.06); }
  h1 { font-family:"Instrument Serif",Georgia,serif; color:#4E7A5C; font-weight:400; margin:0 0 8px; }
  p  { color:#555; line-height:1.45; }
</style></head><body>
<div class="card">
  <h1>Saved.</h1>
  <p>The sensor is restarting and will join your Wi-Fi. You can close this page.</p>
</div>
</body></html>
)HTML";

static void handle_root() {
  http.send_P(200, "text/html", PAGE_FORM);
}

static void handle_save() {
  if (!http.hasArg("ssid")) {
    http.send(400, "text/plain", "missing ssid");
    return;
  }
  WifiCreds c;
  c.ssid = http.arg("ssid");
  c.password = http.hasArg("password") ? http.arg("password") : "";
  if (c.ssid.length() == 0) {
    http.send(400, "text/plain", "empty ssid");
    return;
  }
  nvs_save_wifi(c);
  http.send_P(200, "text/html", PAGE_SAVED);
  delay(400);
  LOG_I("wifi", "credentials saved, restarting");
  ESP.restart();
}

static void handle_not_found() {
  // Captive-portal trick: redirect every unknown host to the form.
  http.sendHeader("Location", "/", true);
  http.send(302, "text/plain", "");
}

void wifi_provisioning_begin() {
  if (ap_up) return;

  WiFi.mode(WIFI_AP);
  String ssid = ap_ssid();
  bool ok = WiFi.softAP(ssid.c_str(), strlen(AP_PASSWORD) > 0 ? AP_PASSWORD : nullptr);
  if (!ok) {
    LOG_E("wifi", "softAP failed");
    return;
  }
  IPAddress ip = WiFi.softAPIP();
  LOG_I("wifi", "AP up: ssid=%s ip=%s", ssid.c_str(), ip.toString().c_str());

  dns.start(53, "*", ip);

  http.on("/", HTTP_GET, handle_root);
  http.on("/wifi", HTTP_POST, handle_save);
  http.onNotFound(handle_not_found);
  http.begin();

  ap_up = true;
  last_blink = millis();
}

void wifi_provisioning_loop() {
  dns.processNextRequest();
  http.handleClient();

  const unsigned long now = millis();
  if (now - last_blink >= 250) {
    led_on = !led_on;
    digitalWrite(PIN_STATUS_LED, led_on ? HIGH : LOW);
    last_blink = now;
  }
}

bool wifi_sta_connect(unsigned long timeout_ms) {
  WifiCreds c;
  if (!nvs_load_wifi(c)) {
    LOG_W("wifi", "sta_connect: no creds in NVS");
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(c.ssid.c_str(), c.password.c_str());
  LOG_I("wifi", "connecting to %s ...", c.ssid.c_str());

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout_ms) {
    delay(250);
  }

  if (WiFi.status() != WL_CONNECTED) {
    LOG_E("wifi", "connect failed, clearing creds and restarting to AP");
    nvs_clear_wifi();
    delay(300);
    ESP.restart();
    return false;
  }

  LOG_I("wifi", "connected, ip=%s rssi=%d dBm",
        WiFi.localIP().toString().c_str(), WiFi.RSSI());
  return true;
}
