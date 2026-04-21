import pytest
from fastapi.testclient import TestClient
from physics import PhysicsState
from admin_api import create_admin_app


@pytest.fixture
def state():
    return PhysicsState(moisture=50.0)


@pytest.fixture
def client(state):
    app = create_admin_app(state)
    return TestClient(app)


def test_get_state(client, state):
    r = client.get("/state")
    assert r.status_code == 200
    data = r.json()
    assert data["moisture"] == 50.0
    assert data["valve_open"] is False
    assert data["sensor_fail"] is False
    assert data["network_fail"] is False


def test_set_moisture(client, state):
    r = client.post("/moisture/set", json={"value": 75.0})
    assert r.status_code == 200
    assert state.moisture == 75.0


def test_set_moisture_out_of_range(client):
    r = client.post("/moisture/set", json={"value": 110.0})
    assert r.status_code == 422


def test_set_moisture_negative(client):
    r = client.post("/moisture/set", json={"value": -1.0})
    assert r.status_code == 422


def test_set_time_scale(client, state):
    r = client.post("/time/scale", json={"scale": 60})
    assert r.status_code == 200
    assert state.time_scale == 60


def test_set_time_scale_invalid(client):
    r = client.post("/time/scale", json={"scale": 0})
    assert r.status_code == 422


def test_set_weather(client, state):
    r = client.post("/weather/set", json={"condition": "rainy", "temp_c": 12.0})
    assert r.status_code == 200
    assert state.weather.condition == "rainy"
    assert state.weather.temp_c == 12.0


def test_set_weather_invalid_condition(client):
    r = client.post("/weather/set", json={"condition": "hurricane"})
    assert r.status_code == 422


def test_fail_sensor(client, state):
    r = client.post("/fail/sensor")
    assert r.status_code == 200
    assert state.sensor_fail is True


def test_fail_network(client, state):
    r = client.post("/fail/network")
    assert r.status_code == 200
    assert state.network_fail is True


def test_reset(client, state):
    state.sensor_fail = True
    state.network_fail = True
    state.moisture = 90.0
    r = client.post("/reset")
    assert r.status_code == 200
    assert state.sensor_fail is False
    assert state.network_fail is False
    assert state.moisture == 45.0  # default scenario initial_moisture


def test_scenario_default(client, state):
    state.moisture = 99.0
    r = client.post("/scenario/default")
    assert r.status_code == 200
    assert state.moisture == 45.0


def test_scenario_rain_incoming(client, state):
    r = client.post("/scenario/rain_incoming")
    assert r.status_code == 200
    assert state.weather.rain_forecast_mm == 8.0


def test_scenario_unknown(client):
    r = client.post("/scenario/nonexistent_scenario")
    assert r.status_code == 404


def test_scenario_drying_out(client, state):
    r = client.post("/scenario/drying_out")
    assert r.status_code == 200
    assert state.moisture == 30.0


def test_scenario_oversaturated(client, state):
    r = client.post("/scenario/oversaturated")
    assert r.status_code == 200
    assert state.moisture == 82.0
