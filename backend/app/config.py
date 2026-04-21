from __future__ import annotations

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    sierra_env: str = "development"

    session_secret: str
    argon2_pepper: str
    allowed_origins: str = "https://localhost"

    mqtt_host: str = "mosquitto"
    mqtt_port: int = 1883
    mqtt_user: str
    mqtt_pass: str
    sierra_hub_mqtt_user: str
    sierra_hub_mqtt_pass: str

    demo_password_hash: Optional[str] = None

    mock_mode: bool = True
    mock_scenario: str = "default"
    mock_time_scale: int = 1
    mock_seed_history: bool = True

    timezone: str = "Europe/Rome"
    log_level: str = "INFO"
    db_path: str = "/app/data/sierra.db"

    @field_validator("session_secret", "argon2_pepper")
    @classmethod
    def must_be_long_enough(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("must be at least 32 characters")
        return v

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split() if o.strip()]


settings = Settings()
