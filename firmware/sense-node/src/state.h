#pragma once

enum State {
  STATE_BOOT,
  STATE_AP_PROVISIONING,
  STATE_PAIRING,
  STATE_RUNNING,
  STATE_FACTORY_RESET,
};

extern State g_state;

const char* state_name(State s);
void state_transition(State next);
