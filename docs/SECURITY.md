# Sierra — Security document

## Threat model

Sierra runs on a home network, controls a physical water valve, and may optionally be exposed to the internet. The threat model covers:

**In scope:**
- Unauthorized valve actuation (physical consequence: flooding, water waste)
- Credential theft via network interception or local file access
- Session hijacking
- Injection attacks against the API (SQL, command)
- Denial of service against the local API
- Accidental internet exposure without user intent

**Out of scope for PoC:**
- Nation-state adversaries
- Physical access to the server machine
- Compromise of the home router

---

## Mitigations applied (M1)

| Area | Control |
|---|---|
| Authentication | Argon2id (time=3, mem=64 MB, p=2) + pepper. Generic error messages. |
| Session tokens | `secrets.token_hex(32)` (256 bit). `HttpOnly; Secure; SameSite=Strict` cookies. Server-side session store — no JWT in localStorage. |
| Transport | HTTPS-only (self-signed cert for PoC). HTTP redirects to HTTPS. HSTS header. |
| CORS | Explicit allowlist from `ALLOWED_ORIGINS` env var. Wildcard (`*`) is rejected at startup. |
| Rate limiting | `/api/auth/login` capped at 5 req/min per IP. Global 200 req/min. Failed logins logged (username, IP). |
| Input validation | Pydantic schemas on every request body. Length limits enforced. |
| Security headers | CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS. |
| Network binding | All services bound to `127.0.0.1` by default. No service is reachable from LAN without explicit config change. |
| Secrets | No secrets in source. `.env` gitignored. `.env.example` contains only placeholders. Demo password generated randomly at first startup, printed to stdout once. |
| Containers | Non-root user (`sierra`, uid 1000) in all images. |
| Valve safety | Any authenticated endpoint triggering the valve enforces `max_run_min` from the active plant profile. Valve defaults to CLOSED on any error. |

---

## Enabling LAN or WAN access

By default, Sierra is only reachable from the machine running Docker (`127.0.0.1`).

**LAN access:** Edit `docker-compose.yml` and change `127.0.0.1:443:443` to `0.0.0.0:443:443`. Your router's firewall should restrict who on the LAN can reach port 443.

**WAN access:** Not recommended for a PoC. If required: place a reverse proxy (Caddy, Traefik) with a valid TLS certificate in front, enable firewall rules, and ensure the demo password was changed from the generated value.

---

## Residual risks

- Self-signed TLS certificate — browsers will warn. Acceptable for local PoC; replace with a CA-signed cert for any production or LAN-wide deployment.
- Single-user auth — no account lockout after N failures beyond rate limiting. Sufficient for local PoC; add lockout before multi-user deployment.
- In-memory session store (M1) — sessions lost on restart. Migrated to DB in M3.
- MQTT lacks TLS in the default setup — traffic is authenticated but not encrypted. Acceptable for loopback-only binding; enable Mosquitto TLS before LAN exposure.

---

## Security update process

Run before any release:

```sh
pip-audit -r backend/requirements.txt
cd frontend && npm audit --audit-level=high
```

Any high or critical finding blocks the release.
