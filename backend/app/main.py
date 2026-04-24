from __future__ import annotations

import asyncio
import logging
import secrets
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from sqlalchemy import select

from app.config import settings
from app.models.base import init_db, SessionLocal
from app.models.tables import User
from app.routers import auth as auth_router
from app.routers import zones as zones_router
from app.routers import profiles as profiles_router
from app.routers import schedules as schedules_router
from app.routers import devices as devices_router
from app.routers import mock_control as mock_router
from app.routers import settings as settings_router
from app.routers import alerts as alerts_router
from app.routers import onboarding as onboarding_router
from app.security.auth import hash_password
from app.security.rate_limit import limiter
from app.services.seed import seed_presets, seed_mock_history
from app.services.mqtt_bridge import run_bridge
from app.services.scheduler import start_scheduler, stop_scheduler, reload_schedules

logging.basicConfig(
    stream=sys.stdout,
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "connect-src 'self';"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with SessionLocal() as db:
        await _bootstrap_users(db)
        await seed_presets(db)
        if settings.mock_mode and settings.mock_seed_history:
            await seed_mock_history(db)
    if settings.mock_mode:
        asyncio.create_task(run_bridge())
        log.info("MQTT bridge started (mock mode)")
    sched = start_scheduler(settings.timezone)
    await reload_schedules(settings.timezone)
    yield
    stop_scheduler()


async def _bootstrap_users(db) -> None:
    """On first boot, optionally seed a demo account.

    Normal install: no users exist, wizard step 0 creates the first one.
    Demo install (SIERRA_DEMO_MODE=1): seed demo/sierra2024 so showcase
    setups can log in without touching the UI.
    """
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none() is not None:
        return
    if not settings.demo_mode:
        return
    password = "sierra2024"
    demo_user = User(
        username="demo",
        password_hash=hash_password(password),
        is_demo=True,
    )
    db.add(demo_user)
    await db.commit()
    print(f"\n{'='*60}", flush=True)
    print(f"  Sierra demo credentials", flush=True)
    print(f"  Username : demo", flush=True)
    print(f"  Password : {password}", flush=True)
    print(f"{'='*60}\n", flush=True)


app = FastAPI(
    title="Sierra",
    docs_url=None,
    redoc_url=None,
    openapi_url=None if settings.sierra_env == "production" else "/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "mock_mode": settings.mock_mode}


app.include_router(auth_router.router, prefix="/api")
app.include_router(zones_router.router, prefix="/api")
app.include_router(profiles_router.router, prefix="/api")
app.include_router(schedules_router.router, prefix="/api")
app.include_router(devices_router.router, prefix="/api")
app.include_router(mock_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(alerts_router.router, prefix="/api")
app.include_router(onboarding_router.router, prefix="/api")
