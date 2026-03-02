"""
climate_engine/settings.py — Centralised Settings & Environment Governance
"""

from __future__ import annotations

import logging
import os
from enum import Enum
from functools import lru_cache

from pydantic import (
    PostgresDsn,
    SecretStr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

_postgres_dsn_adapter: TypeAdapter[PostgresDsn] = TypeAdapter(PostgresDsn)

# Bootstrap logging before settings loads
# Reads LOG_LEVEL from system env only (.env not parsed yet — intentional)
_bootstrap_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _bootstrap_level, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


class EnvMode(str, Enum):
    development = "development"
    production  = "production"


class LogLevel(str, Enum):
    DEBUG   = "DEBUG"
    INFO    = "INFO"
    WARNING = "WARNING"
    ERROR   = "ERROR"


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── API credentials ───────────────────────────────────────────────────
    GROQ_API_KEY:            SecretStr = SecretStr("")
    ECMWF_UID:               SecretStr = SecretStr("")
    ECMWF_API_KEY:           SecretStr = SecretStr("")
    NASA_EARTHDATA_USERNAME: SecretStr = SecretStr("")
    NASA_EARTHDATA_PASSWORD: SecretStr = SecretStr("")

    # ── Google Earth Engine ───────────────────────────────────────────────
    GEE_SERVICE_ACCOUNT_EMAIL: str
    GEE_SERVICE_ACCOUNT_FILE:  str
    GEE_PROJECT_ID:            str

    # ── Database ──────────────────────────────────────────────────────────
    POSTGRES_URL: SecretStr

    # ── Runtime ───────────────────────────────────────────────────────────
    ENV_MODE:  EnvMode  = EnvMode.development
    LOG_LEVEL: LogLevel = LogLevel.INFO

    # ── Database Pool Governance ──────────────────────────────────────────
    DB_POOL_SIZE: int = 5
    """Persistent connections per worker process."""

    DB_MAX_OVERFLOW: int = 10
    """Burst connections beyond pool_size. Closed when returned to pool."""

    DB_POOL_TIMEOUT: int = 30
    """Seconds to wait for a free connection before raising PoolTimeout."""

    DB_POOL_RECYCLE: int = 1800
    """Recycle connections after N seconds to prevent stale TCP."""

    DB_STATEMENT_TIMEOUT_MS: int = 30000
    """Server-side statement timeout in milliseconds (asyncpg server_settings)."""

    # ── Validators ────────────────────────────────────────────────────────

    @field_validator("POSTGRES_URL", mode="before")
    @classmethod
    def validate_postgres_url(cls, v: str) -> str:
        raw = v.get_secret_value() if hasattr(v, "get_secret_value") else str(v)
        if not raw.startswith("postgresql"):
            raise ValueError(
                "POSTGRES_URL must start with 'postgresql' "
                f"(e.g. postgresql://user:pass@host:5432/db). Got: '{raw.split(':')[0]}'."
            )
        try:
            _postgres_dsn_adapter.validate_python(raw)
        except Exception as exc:
            raise ValueError(f"POSTGRES_URL is not a valid PostgreSQL URL: {exc}") from exc
        return v

    @field_validator("GEE_SERVICE_ACCOUNT_EMAIL", mode="after")
    @classmethod
    def validate_gee_email(cls, v: str) -> str:
        if "@" not in v or not v.endswith(".gserviceaccount.com"):
            raise ValueError(
                "GEE_SERVICE_ACCOUNT_EMAIL must end in '.gserviceaccount.com'. "
                f"Got: '{v}'."
            )
        return v

    @field_validator("GEE_SERVICE_ACCOUNT_FILE", mode="after")
    @classmethod
    def validate_gee_key_file(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("GEE_SERVICE_ACCOUNT_FILE must not be empty.")
        if not v.endswith(".json"):
            raise ValueError(f"GEE_SERVICE_ACCOUNT_FILE must be a .json file. Got: '{v}'.")
        if not os.path.exists(v):
            raise ValueError(
                f"GEE_SERVICE_ACCOUNT_FILE does not exist on disk: '{v}'. "
                "Ensure the file is mounted before starting."
            )
        return v

    @model_validator(mode="after")
    def production_safety_checks(self) -> "Settings":
        if self.ENV_MODE == EnvMode.production and self.LOG_LEVEL == LogLevel.DEBUG:
            raise ValueError(
                "LOG_LEVEL=DEBUG is not permitted in production. "
                "Set LOG_LEVEL to INFO, WARNING, or ERROR."
            )
        return self

    def safe_summary(self) -> dict:
        return {
            "ENV_MODE":                  self.ENV_MODE.value,
            "LOG_LEVEL":                 self.LOG_LEVEL.value,
            "GEE_SERVICE_ACCOUNT_EMAIL": self.GEE_SERVICE_ACCOUNT_EMAIL,
            "GEE_PROJECT_ID":            self.GEE_PROJECT_ID,
            "GEE_SERVICE_ACCOUNT_FILE":  self.GEE_SERVICE_ACCOUNT_FILE,
            "DB_POOL_SIZE":              self.DB_POOL_SIZE,
            "DB_MAX_OVERFLOW":           self.DB_MAX_OVERFLOW,
            "DB_POOL_TIMEOUT":           self.DB_POOL_TIMEOUT,
            "DB_POOL_RECYCLE":           self.DB_POOL_RECYCLE,
            "DB_STATEMENT_TIMEOUT_MS":   self.DB_STATEMENT_TIMEOUT_MS,
            "GROQ_API_KEY":              "**redacted**",
            "ECMWF_UID":                 "**redacted**",
            "ECMWF_API_KEY":             "**redacted**",
            "NASA_EARTHDATA_USERNAME":   "**redacted**",
            "NASA_EARTHDATA_PASSWORD":   "**redacted**",
            "POSTGRES_URL":              "**redacted**",
        }

    def __repr__(self) -> str:
        return (
            f"Settings(ENV_MODE={self.ENV_MODE.value!r}, "
            f"LOG_LEVEL={self.LOG_LEVEL.value!r}, "
            f"GEE_PROJECT_ID={self.GEE_PROJECT_ID!r}, "
            f"[secrets redacted])"
        )


def _create_settings() -> Settings:
    try:
        instance = Settings()  # type: ignore[call-arg]
        logger.info("Settings loaded: %s", instance.safe_summary())
        return instance
    except Exception as exc:
        raise RuntimeError(
            "❌  climate_engine failed to load settings.\n"
            "    Check your .env file or environment variables.\n"
            f"    Detail: {exc}"
        ) from exc


settings: Settings = _create_settings()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return settings