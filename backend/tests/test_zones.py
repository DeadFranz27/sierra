import pytest
from fastapi.testclient import TestClient


def _create_zone(client: TestClient, name: str = "Test zone") -> dict:
    r = client.post("/api/zones", json={
        "name": name,
        "valve_device_id": "hub-001",
        "sensor_device_id": "sense-001",
    })
    assert r.status_code == 201
    return r.json()


def test_list_zones_requires_auth(client: TestClient):
    r = client.get("/api/zones")
    assert r.status_code == 401


def test_create_zone(auth_client: TestClient):
    z = _create_zone(auth_client)
    assert z["name"] == "Test zone"
    assert z["growth_stage"] == "established"
    assert z["active_profile_id"] is None


def test_list_zones_returns_seeded_zone(auth_client: TestClient):
    r = auth_client.get("/api/zones")
    assert r.status_code == 200
    assert len(r.json()) >= 1
    names = [z["name"] for z in r.json()]
    assert "Back lawn" in names


def test_get_zone_not_found(auth_client: TestClient):
    r = auth_client.get("/api/zones/nonexistent-id")
    assert r.status_code == 404


def test_update_zone_name(auth_client: TestClient):
    z = _create_zone(auth_client, "Original name")
    r = auth_client.patch(f"/api/zones/{z['id']}", json={"name": "Updated name"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated name"


def test_assign_profile_to_zone(auth_client: TestClient):
    z = _create_zone(auth_client)
    profiles = auth_client.get("/api/profiles").json()
    turfgrass = next(p for p in profiles if p["preset_key"] == "turfgrass")
    r = auth_client.post(f"/api/zones/{z['id']}/profile", json={"profile_id": turfgrass["id"]})
    assert r.status_code == 200
    assert r.json()["active_profile_id"] == turfgrass["id"]


def test_assign_nonexistent_profile(auth_client: TestClient):
    z = _create_zone(auth_client)
    r = auth_client.post(f"/api/zones/{z['id']}/profile", json={"profile_id": "does-not-exist"})
    assert r.status_code == 404


def test_update_growth_stage(auth_client: TestClient):
    z = _create_zone(auth_client)
    r = auth_client.patch(f"/api/zones/{z['id']}/growth-stage", json={"growth_stage": "seedling"})
    assert r.status_code == 200
    assert r.json()["growth_stage"] == "seedling"


def test_invalid_growth_stage(auth_client: TestClient):
    z = _create_zone(auth_client)
    r = auth_client.patch(f"/api/zones/{z['id']}/growth-stage", json={"growth_stage": "adult"})
    assert r.status_code == 422


def test_water_requires_profile(auth_client: TestClient):
    z = _create_zone(auth_client)
    r = auth_client.post(f"/api/zones/{z['id']}/water", json={})
    assert r.status_code == 409


def test_water_with_profile_clamps_duration(auth_client: TestClient):
    z = _create_zone(auth_client)
    profiles = auth_client.get("/api/profiles").json()
    succulents = next(p for p in profiles if p["preset_key"] == "succulents_cacti")
    auth_client.post(f"/api/zones/{z['id']}/profile", json={"profile_id": succulents["id"]})
    # succulents max_run_min=3, request 10 min → should be clamped to 3
    r = auth_client.post(f"/api/zones/{z['id']}/water", json={"duration_min": 10.0})
    assert r.status_code == 201
    assert r.json()["duration_min"] <= 3.0


def test_moisture_history_invalid_hours(auth_client: TestClient):
    zones = auth_client.get("/api/zones").json()
    zone_id = zones[0]["id"]
    r = auth_client.get(f"/api/zones/{zone_id}/history?hours=99")
    assert r.status_code == 422


def test_moisture_history_returns_data(auth_client: TestClient):
    zones = auth_client.get("/api/zones").json()
    back_lawn = next(z for z in zones if z["name"] == "Back lawn")
    r = auth_client.get(f"/api/zones/{back_lawn['id']}/history?hours=168")
    assert r.status_code == 200
    assert len(r.json()) > 0


def test_delete_zone(auth_client: TestClient):
    z = _create_zone(auth_client)
    r = auth_client.delete(f"/api/zones/{z['id']}")
    assert r.status_code == 204
    r2 = auth_client.get(f"/api/zones/{z['id']}")
    assert r2.status_code == 404
