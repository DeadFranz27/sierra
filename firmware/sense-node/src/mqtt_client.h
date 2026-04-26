#pragma once

// MQTT runtime for the sense-node, active only in STATE_RUNNING.
//
// Topics (hub-side contract from app/services/mqtt_bridge.py):
//   pub  sierra/hub/<HUB_ID>/moisture   { "value": <0..100>, "ts": "<iso8601>" }
//   pub  sierra/hub/<HUB_ID>/status     { "rssi": <int>, "fw": "<version>" }
//   sub  sierra/<mqtt_user>/control     { "action": "unpair"|"factory_reset"|"restart"|"reprovision_wifi" }
void mqtt_client_begin();
void mqtt_client_loop();
