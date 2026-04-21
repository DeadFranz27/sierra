import time
import pytest
from unittest.mock import patch
from physics import PhysicsState, WeatherState


def make_state(**kwargs) -> PhysicsState:
    return PhysicsState(**kwargs)


def no_noise():
    """Context manager that zeroes Gaussian noise for deterministic physics tests."""
    return patch("physics.random.gauss", return_value=0.0)


def test_initial_moisture_preserved():
    s = make_state(moisture=45.0)
    assert s.moisture == 45.0


def test_tick_returns_clamped_value():
    s = make_state(moisture=50.0)
    time.sleep(0.05)
    val = s.tick()
    assert 0.0 <= val <= 100.0


def test_moisture_decreases_over_time_sunny():
    with no_noise():
        s = make_state(moisture=60.0, time_scale=3600)
        time.sleep(0.2)
        val = s.tick()
    assert val < 60.0


def test_moisture_increases_when_valve_open():
    s = make_state(moisture=40.0)
    s.open_valve(duration_s=600)
    time.sleep(0.3)
    s.tick()
    assert s.moisture > 40.0


def test_valve_auto_closes_after_duration():
    s = make_state(moisture=40.0)
    s.open_valve(duration_s=1)
    time.sleep(1.2)
    s.tick()
    assert not s.valve_open


def test_moisture_does_not_exceed_100():
    s = make_state(moisture=99.9)
    s.open_valve(duration_s=600)
    for _ in range(5):
        time.sleep(0.1)
        v = s.tick()
    assert v <= 100.0


def test_moisture_does_not_go_below_0():
    with no_noise():
        s = make_state(moisture=0.1, time_scale=3600)
        time.sleep(0.2)
        val = s.tick()
    assert val >= 0.0


def test_drainage_kicks_in_above_80():
    with no_noise():
        s = make_state(moisture=85.0, time_scale=3600)
        time.sleep(0.3)
        val = s.tick()
    assert val < 85.0


def test_rainy_weather_slows_drying():
    with no_noise():
        s_sunny = make_state(moisture=60.0, time_scale=3600,
                             weather=WeatherState(condition="sunny"))
        s_rainy = make_state(moisture=60.0, time_scale=3600,
                             weather=WeatherState(condition="rainy"))
        time.sleep(0.2)
        v_sunny = s_sunny.tick()
        v_rainy = s_rainy.tick()
    assert v_rainy > v_sunny


def test_sensor_fail_flag():
    s = make_state(moisture=50.0, sensor_fail=True)
    assert s.sensor_fail is True


def test_network_fail_flag():
    s = make_state(moisture=50.0, network_fail=True)
    assert s.network_fail is True


def test_uptime_increases():
    s = make_state(moisture=50.0)
    t1 = s.uptime_s
    time.sleep(0.1)
    t2 = s.uptime_s
    assert t2 >= t1
