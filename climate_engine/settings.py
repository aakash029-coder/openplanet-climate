"""
climate_engine/settings.py — Centralised Settings & Environment Governance

All environment variables are validated at startup.
The application will refuse to start with a clear error message
rather than silently using wrong/missing configuration.
"""

from __future__ import annotations

import logging
import os
from enum import Enum
from functools import lru_cache

from pydantic import (
    SecretStr,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

# Bootstrap logging before settings loads.
# Reads LOG_LEVEL from system env only (.env not parsed yet — intentional).
_bootstrap_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _bootstrap_level, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


class EnvMode(str, Enum):
    development = "development"
    production = "production"


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── API credentials ───────────────────────────────────────────────────
    GROQ_API_KEY: SecretStr = SecretStr("")
    ECMWF_UID: SecretStr = SecretStr("")
    ECMWF_API_KEY: SecretStr = SecretStr("")
    NASA_EARTHDATA_USERNAME: SecretStr = SecretStr("")
    NASA_EARTHDATA_PASSWORD: SecretStr = SecretStr("")

    # ── Google Earth Engine ───────────────────────────────────────────────
    GEE_SERVICE_ACCOUNT_EMAIL: str = ""
    GEE_SERVICE_ACCOUNT_FILE: str = ""
    GEE_PROJECT_ID: str = ""

    # ── Security ──────────────────────────────────────────────────────────
    # Comma-separated list of valid API keys for endpoint protection.
    # If empty string, API key validation is DISABLED (dev mode only).
    API_KEYS: str = ""
    # Rate limit: requests per minute per IP
    RATE_LIMIT_PER_MINUTE: int = 100
    # CORS: comma-separated allowed origins. "*" = all (dev only)
    CORS_ORIGINS: str = "*"
    # Secret for signing internal tokens (min 32 chars in production)
    SECRET_KEY: SecretStr = SecretStr("aakash_mega_power_secret_key_1234567890_secured")
    # ── Runtime ───────────────────────────────────────────────────────────
    ENV_MODE: EnvMode = EnvMode.development
    LOG_LEVEL: LogLevel = LogLevel.INFO

    # ── Vercel Tunnel ─────────────────────────────────────────────────────
    VERCEL_TUNNEL_URL: str = "https://openplanet-ai.vercel.app/api/tunnel"

    # ── Engine Tuning ─────────────────────────────────────────────────────
    ERA5_CACHE_TTL_SECONDS: int = 86400       # 24 hours
    CMIP6_CACHE_TTL_SECONDS: int = 86400      # 24 hours
    CITY_CACHE_TTL_SECONDS: int = 604800      # 7 days
    COUNTRY_CACHE_TTL_SECONDS: int = 2592000  # 30 days
    HTTP_TIMEOUT_SECONDS: float = 30.0
    MAX_CONCURRENT_API_CALLS: int = 5

    # ── Validators ────────────────────────────────────────────────────────

    @field_validator("GEE_SERVICE_ACCOUNT_EMAIL", mode="after")
    @classmethod
    def validate_gee_email(cls, v: str) -> str:
        if v and ("@" not in v or not v.endswith(".gserviceaccount.com")):
            raise ValueError(
                "GEE_SERVICE_ACCOUNT_EMAIL must end in '.gserviceaccount.com'. "
                f"Got: '{v}'."
            )
        return v

    @field_validator("GEE_SERVICE_ACCOUNT_FILE", mode="after")
    @classmethod
    def validate_gee_key_file(cls, v: str) -> str:
        if v:
            if not v.endswith(".json"):
                raise ValueError(
                    f"GEE_SERVICE_ACCOUNT_FILE must be a .json file. Got: '{v}'."
                )
            if not os.path.exists(v):
                logger.warning(
                    "GEE_SERVICE_ACCOUNT_FILE not found on disk: '%s'. "
                    "GEE-dependent features will be unavailable.",
                    v,
                )
        return v

    @model_validator(mode="after")
    def production_safety_checks(self) -> "Settings":
        if self.ENV_MODE == EnvMode.production:
            if self.LOG_LEVEL == LogLevel.DEBUG:
                raise ValueError(
                    "LOG_LEVEL=DEBUG is not permitted in production. "
                    "Set LOG_LEVEL to INFO, WARNING, or ERROR."
                )
            secret = self.SECRET_KEY.get_secret_value()
            if secret == "dev-secret-change-in-production-min32chars":
                raise ValueError(
                    "SECRET_KEY must be changed from the default in production."
                )
            if len(secret) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production."
                )
        return self

    @property
    def allowed_api_keys(self) -> set[str]:
        """Return set of valid API keys (empty = no key required)."""
        if not self.API_KEYS:
            return set()
        return {k.strip() for k in self.API_KEYS.split(",") if k.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        """Return parsed CORS origin list."""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def safe_summary(self) -> dict:
        return {
            "ENV_MODE": self.ENV_MODE.value,
            "LOG_LEVEL": self.LOG_LEVEL.value,
            "GEE_SERVICE_ACCOUNT_EMAIL": self.GEE_SERVICE_ACCOUNT_EMAIL or "(not set)",
            "GEE_PROJECT_ID": self.GEE_PROJECT_ID or "(not set)",
            "GEE_SERVICE_ACCOUNT_FILE": self.GEE_SERVICE_ACCOUNT_FILE or "(not set)",
            "RATE_LIMIT_PER_MINUTE": self.RATE_LIMIT_PER_MINUTE,
            "CORS_ORIGINS": self.CORS_ORIGINS,
            "API_KEY_PROTECTION": bool(self.API_KEYS),
            "GROQ_API_KEY": "**redacted**" if self.GROQ_API_KEY.get_secret_value() else "(not set)",
            "ECMWF_UID": "**redacted**" if self.ECMWF_UID.get_secret_value() else "(not set)",
            "NASA_EARTHDATA_USERNAME": "**redacted**" if self.NASA_EARTHDATA_USERNAME.get_secret_value() else "(not set)",
            "SECRET_KEY": "**redacted**",
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