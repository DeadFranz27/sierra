#include "state.h"
#include "log.h"

State g_state = STATE_BOOT;

const char* state_name(State s) {
  switch (s) {
    case STATE_BOOT:             return "BOOT";
    case STATE_AP_PROVISIONING:  return "AP_PROVISIONING";
    case STATE_PAIRING:          return "PAIRING";
    case STATE_RUNNING:          return "RUNNING";
    case STATE_FACTORY_RESET:    return "FACTORY_RESET";
  }
  return "UNKNOWN";
}

void state_transition(State next) {
  if (next == g_state) return;
  LOG_I("state", "%s -> %s", state_name(g_state), state_name(next));
  g_state = next;
}
