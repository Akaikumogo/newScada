import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/newscada"
    REDIS_URL:    str = "redis://localhost:6379/0"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    LOG_FILE: str = "logs/backend.log"
    LOG_DEVICE_PAYLOADS: bool = True
    IEC_CONNECT_TIMEOUT_SECONDS: float = 5.0
    IEC_GI_MAX_SECONDS: float = 15.0
    IEC_GI_INTERVAL_SECONDS: float = 30.0
    IEC_IDLE_AFTER_DATA_SECONDS: float = 1.5
    IEC_LISTEN_SECONDS: float = 1.0
    IEC_READ_WINDOW_SECONDS: float = 15.0
    IEC_SIGNAL_CACHE_SECONDS: float = 300.0
    IEC_MAX_PARALLEL_POLLS: int = 2
    IEC_LIVE_CACHE_SECONDS: int = 86400
    IEC_RECORD_COLLECTOR_ENABLED: bool = True
    IEC_RECORD_INTERVAL_SECONDS: float = 1.0
    IEC_RECORD_CONNECT_TIMEOUT_SECONDS: float = 1.0
    IEC_RECORD_READ_TIMEOUT_SECONDS: float = 1.0
    IEC_RECORD_IDLE_AFTER_DATA_SECONDS: float = 0.4
    IEC_RECORD_MAX_PARALLEL_POLLS: int = 10

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            value = v.strip()
            if value.startswith("["):
                return json.loads(value)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


settings = Settings()
