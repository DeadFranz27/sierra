"""SQLAlchemy ORM tables — matches PRD v0.6 §9 data model exactly."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# PlantProfile
# ---------------------------------------------------------------------------

class PlantProfile(Base):
    __tablename__ = "plant_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    is_preset: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preset_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    moisture_dry: Mapped[float] = mapped_column(Float, nullable=False)
    moisture_target: Mapped[float] = mapped_column(Float, nullable=False)
    moisture_wet: Mapped[float] = mapped_column(Float, nullable=False)
    default_run_min: Mapped[float] = mapped_column(Float, nullable=False)
    min_interval_hours: Mapped[float] = mapped_column(Float, nullable=False)
    max_run_min: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sun_preference: Mapped[str] = mapped_column(String, nullable=False, default="full")
    season_active: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    forked_from_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("plant_profiles.id"), nullable=True
    )
    seed_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    zones: Mapped[List[Zone]] = relationship(
        "Zone", back_populates="active_profile", foreign_keys="Zone.active_profile_id"
    )


# ---------------------------------------------------------------------------
# Zone
# ---------------------------------------------------------------------------

class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    area_m2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    valve_device_id: Mapped[str] = mapped_column(String, nullable=False)
    sensor_device_id: Mapped[str] = mapped_column(String, nullable=False)
    active_profile_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("plant_profiles.id"), nullable=True
    )
    growth_stage: Mapped[str] = mapped_column(String, nullable=False, default="established")
    profile_assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Calibration (PRD §6.6)
    is_calibrated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calibration_dry_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calibration_wet_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calibrated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    active_profile: Mapped[Optional[PlantProfile]] = relationship(
        "PlantProfile", back_populates="zones", foreign_keys=[active_profile_id]
    )
    schedules: Mapped[List[Schedule]] = relationship(
        "Schedule", back_populates="zone", cascade="all, delete-orphan"
    )
    moisture_readings: Mapped[List[MoistureReading]] = relationship(
        "MoistureReading", back_populates="zone", cascade="all, delete-orphan"
    )
    runs: Mapped[List[Run]] = relationship(
        "Run", back_populates="zone", cascade="all, delete-orphan"
    )
    alerts: Mapped[List[Alert]] = relationship(
        "Alert", back_populates="zone", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Device  (PRD §9.1 — extended in v0.6 with pairing fields)
# ---------------------------------------------------------------------------

class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String, nullable=False)          # hub | sense | valve
    name: Mapped[str] = mapped_column(String, nullable=False)
    firmware_version: Mapped[str] = mapped_column(String, nullable=False, default="unknown")
    actuator_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # valve only
    mac: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    wifi_rssi: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    valve_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # open | closed
    water_level: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)  # valve only
    error_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Pairing fields (new in v0.6)
    paired_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pairing_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # mdns_code | manual_ip | qr_scan
    mqtt_username: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    mqtt_password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    api_key_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pending_unpair: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    alerts: Mapped[List[Alert]] = relationship(
        "Alert", back_populates="device", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List[AuditLog]] = relationship(
        "AuditLog", back_populates="device", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# DeviceCandidate  (PRD §9.1 — new in v0.6)
# ---------------------------------------------------------------------------

class DeviceCandidate(Base):
    __tablename__ = "device_candidates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String, nullable=False)          # sense | valve
    mac: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    ip: Mapped[str] = mapped_column(String, nullable=False)
    port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hostname: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    firmware_version: Mapped[str] = mapped_column(String, nullable=False, default="unknown")
    announced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------

class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("zones.id"), nullable=False)
    days_of_week: Mapped[list] = mapped_column(JSON, nullable=False)
    time_local: Mapped[str] = mapped_column(String, nullable=False)
    duration_min: Mapped[float] = mapped_column(Float, nullable=False)
    smart: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    zone: Mapped[Zone] = relationship("Zone", back_populates="schedules")


# ---------------------------------------------------------------------------
# MoistureReading
# ---------------------------------------------------------------------------

class MoistureReading(Base):
    __tablename__ = "moisture_readings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("zones.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    value_percent: Mapped[float] = mapped_column(Float, nullable=False)
    raw_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temp_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    zone: Mapped[Zone] = relationship("Zone", back_populates="moisture_readings")


# ---------------------------------------------------------------------------
# Run  (PRD §9.1 — extended with valve_fault_detected, water_level_at_start)
# ---------------------------------------------------------------------------

class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("zones.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_ml: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trigger: Mapped[str] = mapped_column(String, nullable=False)       # manual | scheduled | smart
    profile_id_at_run: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    growth_stage_at_run: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    moisture_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    moisture_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    water_level_at_start: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    skipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    skip_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    valve_fault_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    zone: Mapped[Zone] = relationship("Zone", back_populates="runs")


# ---------------------------------------------------------------------------
# Alert  (PRD §9.1 — new in v0.6)
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    zone_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("zones.id"), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # reservoir_empty | sensor_trouble | valve_fault | valve_offline_mid_watering |
    # hub_degraded | sense_implausible | device_offline
    severity: Mapped[str] = mapped_column(String, nullable=False, default="warning")
    # info | warning | error
    message: Mapped[str] = mapped_column(Text, nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    zone: Mapped[Optional[Zone]] = relationship("Zone", back_populates="alerts")
    device: Mapped[Optional[Device]] = relationship("Device", back_populates="alerts")


# ---------------------------------------------------------------------------
# OnboardingProgress  (PRD §9.1 — new in v0.6)
# ---------------------------------------------------------------------------

class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    state_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# AuditLog  (PRD §9.1 — new in v0.6)
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    # user_login | user_logout | user_bootstrap | device_pair | device_unpair |
    # device_factory_reset | device_reprovision_wifi | zone_profile_change |
    # alert_acknowledge | calibration_complete
    target_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    target_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    outcome: Mapped[str] = mapped_column(String, nullable=False, default="success")  # success | failure
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    device: Mapped[Optional[Device]] = relationship("Device", back_populates="audit_logs")


# ---------------------------------------------------------------------------
# SiteSetting  (key/value store for hub location, etc.)
# ---------------------------------------------------------------------------

class SiteSetting(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
