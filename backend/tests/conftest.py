import asyncio
import os
import pytest
from fastapi.testclient import TestClient

# Must be set before any app import
os.environ.setdefault("SIERRA_ENV", "test")
os.environ.setdefault("SESSION_SECRET", "a" * 64)
os.environ.setdefault("ARGON2_PEPPER", "b" * 64)
os.environ.setdefault("MQTT_USER", "test-backend")
os.environ.setdefault("MQTT_PASS", "test-pass")
os.environ.setdefault("SIERRA_HUB_MQTT_USER", "test-hub")
os.environ.setdefault("SIERRA_HUB_MQTT_PASS", "test-hub-pass")
os.environ.setdefault("DB_PATH", ":memory:")

# Point SQLAlchemy at in-memory SQLite before engine is created
import app.models.base as _base_mod
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
_test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
_test_session = async_sessionmaker(_test_engine, expire_on_commit=False)
_base_mod.engine = _test_engine
_base_mod.SessionLocal = _test_session

from app.main import app
from app.models.base import Base
from app.security.rate_limit import limiter
# Prevent MQTT bridge from connecting during tests
import app.services.mqtt_bridge as _bridge
_bridge.run_bridge = lambda: asyncio.sleep(0)  # no-op coroutine


async def _reset_db():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture(autouse=True)
def reset_state():
    limiter._storage.reset()
    # Fresh DB per test — run in an isolated loop so TestClient's lifespan
    # gets a clean SQLite in-memory on each construction.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_reset_db())
    finally:
        loop.close()
    # Clear in-memory session store
    from app.security import auth as _auth_mod
    _auth_mod._sessions.clear()
    yield
    limiter._storage.reset()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def auth_client(client):
    """Create the first user via /auth/setup — the response sets the session cookie."""
    resp = client.post(
        "/api/auth/setup",
        json={"username": "tester", "password": "testpass1"},
    )
    assert resp.status_code == 201, f"setup failed: {resp.status_code} {resp.text}"
    return client
