from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables (e.g. DATABASE_URL)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'salary.db'}"
    # Directory with the built React app; served at "/" when it exists.
    static_dir: Path = BACKEND_DIR.parent / "frontend" / "dist"
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
