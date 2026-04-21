#!/bin/sh
# Generates a self-signed TLS certificate for local HTTPS.
# Run once before docker-compose up. Output goes to certs/.
set -e
CERTS_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/sierra.crt" ]; then
    echo "Certificates already exist — skipping. Delete certs/sierra.* to regenerate."
    exit 0
fi

openssl req -x509 -nodes -days 730 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/sierra.key" \
  -out "$CERTS_DIR/sierra.crt" \
  -subj "/C=IT/ST=FVG/O=Sierra/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$CERTS_DIR/sierra.key"
echo "Self-signed certificate written to certs/sierra.crt"
