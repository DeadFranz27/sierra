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
os.environ.setdefault("MOCK_MODE", "true")
os.environ.setdefault("MOCK_SEED_HISTORY", "true")
os.environ.setdefault("DB_PATH", ":memory:")

# Point SQLAlchemy at in-memory SQLite before engine is created
import app.models.base as _base_mod
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
_test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
_test_session = async_sessionmaker(_test_engine, expire_on_commit=False)
_base_mod.engine = _test_engine
_base_mod.SessionLocal = _test_session

from app.main import app
from app.security.auth import hash_password
from app.security.rate_limit import limiter
# Prevent MQTT bridge from connecting during tests
import app.services.mqtt_bridge as _bridge
_bridge.run_bridge = lambda: asyncio.sleep(0)  # no-op coroutine


@pytest.fixture(autouse=True)
def reset_state(monkeypatch):
    monkeypatch.setenv("DEMO_PASSWORD_HASH", hash_password("correct-password"))
    limiter._storage.reset()
    yield
    limiter._storage.reset()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def auth_client(client):
    resp = client.post("/api/auth/login", json={"username": "demo", "password": "correct-password"})
    assert resp.status_code == 200
    return client
