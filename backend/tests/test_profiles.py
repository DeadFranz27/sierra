import pytest
from fastapi.testclient import TestClient


def test_list_profiles_requires_auth(client: TestClient):
    r = client.get("/api/profiles")
    assert r.status_code == 401


def test_list_profiles_returns_8_presets(auth_client: TestClient):
    r = auth_client.get("/api/profiles")
    assert r.status_code == 200
    presets = [p for p in r.json() if p["is_preset"]]
    assert len(presets) == 8


def test_preset_keys_present(auth_client: TestClient):
    r = auth_client.get("/api/profiles")
    keys = {p["preset_key"] for p in r.json() if p["is_preset"]}
    assert "turfgrass" in keys
    assert "succulents_cacti" in keys
    assert "fruiting_vegetables" in keys


def test_create_custom_profile(auth_client: TestClient):
    r = auth_client.post("/api/profiles", json={
        "name": "My herbs",
        "description": "Custom herb mix",
        "moisture_dry": 30.0,
        "moisture_target": 55.0,
        "moisture_wet": 70.0,
        "default_run_min": 3.0,
        "min_interval_hours": 36.0,
        "max_run_min": 8.0,
        "sun_preference": "partial",
        "season_active": [4, 5, 6, 7, 8, 9],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "My herbs"
    assert data["is_preset"] is False


def test_create_profile_invalid_thresholds(auth_client: TestClient):
    r = auth_client.post("/api/profiles", json={
        "name": "Bad thresholds",
        "moisture_dry": 60.0,
        "moisture_target": 40.0,   # dry > target — invalid
        "moisture_wet": 80.0,
        "default_run_min": 5.0,
        "min_interval_hours": 24.0,
        "max_run_min": 10.0,
    })
    assert r.status_code == 422


def test_create_profile_invalid_run_duration(auth_client: TestClient):
    r = auth_client.post("/api/profiles", json={
        "name": "Too long",
        "moisture_dry": 30.0,
        "moisture_target": 50.0,
        "moisture_wet": 70.0,
        "default_run_min": 5.0,
        "min_interval_hours": 24.0,
        "max_run_min": 99.0,   # > 30 — invalid
    })
    assert r.status_code == 422


def test_cannot_update_preset(auth_client: TestClient):
    presets = auth_client.get("/api/profiles").json()
    preset_id = next(p["id"] for p in presets if p["is_preset"])
    r = auth_client.put(f"/api/profiles/{preset_id}", json={
        "name": "Hacked preset",
        "moisture_dry": 10.0,
        "moisture_target": 30.0,
        "moisture_wet": 50.0,
        "default_run_min": 2.0,
        "min_interval_hours": 24.0,
        "max_run_min": 5.0,
    })
    assert r.status_code == 403


def test_cannot_delete_preset(auth_client: TestClient):
    presets = auth_client.get("/api/profiles").json()
    preset_id = next(p["id"] for p in presets if p["is_preset"])
    r = auth_client.delete(f"/api/profiles/{preset_id}")
    assert r.status_code == 403


def test_delete_custom_profile(auth_client: TestClient):
    created = auth_client.post("/api/profiles", json={
        "name": "Temp profile",
        "moisture_dry": 30.0,
        "moisture_target": 55.0,
        "moisture_wet": 70.0,
        "default_run_min": 3.0,
        "min_interval_hours": 36.0,
        "max_run_min": 8.0,
    }).json()
    r = auth_client.delete(f"/api/profiles/{created['id']}")
    assert r.status_code == 204
