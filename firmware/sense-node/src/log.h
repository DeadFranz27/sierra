#pragma once

#include <Arduino.h>

enum LogLevel {
  LOG_DEBUG,
  LOG_INFO,
  LOG_WARN,
  LOG_ERROR,
};

void log_init(unsigned long baud = 115200);
void log_line(LogLevel lvl, const char* module, const char* fmt, ...);

#define LOG_D(mod, ...) log_line(LOG_DEBUG, mod, __VA_ARGS__)
#define LOG_I(mod, ...) log_line(LOG_INFO,  mod, __VA_ARGS__)
#define LOG_W(mod, ...) log_line(LOG_WARN,  mod, __VA_ARGS__)
#define LOG_E(mod, ...) log_line(LOG_ERROR, mod, __VA_ARGS__)
