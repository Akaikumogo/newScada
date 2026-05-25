from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    app_name: str = "TEST127"
    environment: str = Field(
        default="development",
        pattern="^(development|staging|production|test)$",
    )
    debug: bool = False
    api_prefix: str = "/api"
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://test127:test127@localhost:5432/test127"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()

