"""
climate_engine/api/security.py — Enterprise Security Module

Responsibilities:
1. API key validation via X-API-Key header (optional — disabled when no keys configured).
2. SlowAPI rate limiting: per-IP, configurable req/min ceiling.
3. Request ID injection for distributed tracing.
4. Security headers middleware.
5. Helpers for the global exception handler in main.py.

Design principles:
- If API_KEYS env var is empty → key validation skipped (dev mode).
- If API_KEYS is populated → every protected endpoint requires a valid key.
- Rate limiting is ALWAYS active regardless of key config.
- All security failures return clean JSON (never HTML).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate Limiter — SlowAPI
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],           # We attach limits per-route for granularity
    headers_enabled=True,        # Exposes X-RateLimit-* headers to client
    swallow_errors=False,        # Let the error bubble to the global handler
)


def get_rate_limit_string() -> str:
    """
    Build the SlowAPI limit string from settings at call time.
    Called once during app setup, not per-request.
    """
    from climate_engine.settings import settings
    return f"{settings.RATE_LIMIT_PER_MINUTE}/minute"


# ---------------------------------------------------------------------------
# API Key Authentication
# ---------------------------------------------------------------------------

_api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False,   # We raise the error ourselves with a clean message
)


async def verify_api_key(
    request: Request,
    api_key: Optional[str] = Security(_api_key_header),
) -> Optional[str]:
    """
    FastAPI dependency that validates the X-API-Key header.

    Behaviour matrix:
    ┌─────────────────────────┬───────────────────────────────────────────────┐
    │ API_KEYS configured?    │ Behaviour                                     │
    ├─────────────────────────┼───────────────────────────────────────────────┤
    │ No (empty string)       │ Always passes — dev/open mode                 │
    │ Yes                     │ Requires valid X-API-Key; 401 if missing/wrong│
    └─────────────────────────┴───────────────────────────────────────────────┘

    Returns the validated API key string on success, or None in open mode.
    """
    from climate_engine.settings import settings

    allowed = settings.allowed_api_keys

    # Open mode — no key required
    if not allowed:
        return None

    # Key required but not provided
    if not api_key:
        logger.warning(
            "API key missing | ip=%s | path=%s",
            get_remote_address(request),
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "MISSING_API_KEY",
                "detail": "X-API-Key header is required. "
                          "Obtain a key from the OpenPlanet developer portal.",
            },
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Key provided but not in allowed set
    if api_key not in allowed:
        logger.warning(
            "Invalid API key | ip=%s | path=%s | key_prefix=%s",
            get_remote_address(request),
            request.url.path,
            api_key[:6] + "..." if len(api_key) > 6 else "***",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "INVALID_API_KEY",
                "detail": "The provided X-API-Key is not valid or has been revoked.",
            },
        )

    logger.debug(
        "API key validated | ip=%s | path=%s",
        get_remote_address(request),
        request.url.path,
    )
    return api_key


# ---------------------------------------------------------------------------
# Request ID Middleware
# ---------------------------------------------------------------------------

async def inject_request_id(request: Request, call_next):
    """
    Middleware that assigns a unique request ID to every request.
    Propagated via the X-Request-ID response header for distributed tracing.
    """
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------

async def add_security_headers(request: Request, call_next):
    """
    Middleware that adds OWASP-recommended security headers to every response.
    These are defensive headers — they do not break any functionality.
    """
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), "
        "gyroscope=(), magnetometer=(), microphone=(), payment=()"
    )
    # Only set HSTS in production (breaks local http:// dev)
    try:
        from climate_engine.settings import settings
        # FIX: Safe comparison, avoids AttributeError if ENV_MODE is a pure string
        if str(settings.ENV_MODE) == "production" or getattr(settings.ENV_MODE, "value", "") == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
    except Exception:
        pass

    return response


# ---------------------------------------------------------------------------
# Convenience dependency combining rate limit + optional API key
# ---------------------------------------------------------------------------

def protected(
    request: Request,
    _key: Optional[str] = Depends(verify_api_key),
) -> None:
    """
    Combined dependency for protected endpoints.
    Apply with: `dependencies=[Depends(protected)]`
    or as a parameter: `_ = Depends(protected)`
    """
    pass