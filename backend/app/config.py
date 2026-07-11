from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "A股个人投研看板"
    data_mode: str = Field(default="seed", validation_alias="A_DASHBOARD_DATA_MODE")
    cache_ttl_seconds: int = Field(default=90, validation_alias="A_DASHBOARD_CACHE_TTL")
    live_fetch_timeout_seconds: float = Field(default=4.0, validation_alias="A_DASHBOARD_LIVE_TIMEOUT")
    db_path: Path = Field(default=Path("data/dashboard.sqlite3"), validation_alias="A_DASHBOARD_DB")
    cors_origins: str = Field(
        default=(
            "https://ahh-060913.github.io,"
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5174,http://127.0.0.1:5174,"
            "http://localhost:5175,http://127.0.0.1:5175"
        ),
        validation_alias="A_DASHBOARD_CORS",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
