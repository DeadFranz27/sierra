#include "log.h"

#include <stdarg.h>
#include <stdio.h>

static const char* level_name(LogLevel lvl) {
  switch (lvl) {
    case LOG_DEBUG: return "DEBG";
    case LOG_INFO:  return "INFO";
    case LOG_WARN:  return "WARN";
    case LOG_ERROR: return "ERRO";
  }
  return "    ";
}

void log_init(unsigned long baud) {
  Serial.begin(baud);
  delay(50);
}

void log_line(LogLevel lvl, const char* module, const char* fmt, ...) {
  unsigned long ms = millis();
  unsigned long s  = ms / 1000;
  unsigned long h  = s / 3600;
  unsigned long m  = (s / 60) % 60;
  unsigned long ss = s % 60;

  char msg[256];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(msg, sizeof(msg), fmt, ap);
  va_end(ap);

  Serial.printf("[%02lu:%02lu:%02lu] %s %s \xE2\x80\x94 %s\n",
                h, m, ss, level_name(lvl), module, msg);
}
