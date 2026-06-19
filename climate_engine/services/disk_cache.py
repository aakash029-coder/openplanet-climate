"""
climate_engine/services/disk_cache.py — Tiny JSON disk cache for heavy upstream
responses (ERA5 bundles, CMIP6 full series).

Why: OpenPlanet runs on Hugging Face free tier — a shared outbound IP behind
Open-Meteo rate limits, with ephemeral storage and cold starts that wipe the
in-memory cache. Persisting the expensive upstream payloads to disk means the
warm path makes ZERO API calls, surviving restarts for the container's life.
Precomputed cache files for popular cities can be committed so even a cold start
serves them instantly and accurately.

The cache is best-effort: any read/write error degrades silently to a miss, so a
read-only or full filesystem never breaks a request.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Override location on HF with OPENPLANET_CACHE_DIR (e.g. a persistent volume).
CACHE_DIR = os.environ.get(
    "OPENPLANET_CACHE_DIR",
    os.path.join(os.path.dirname(__file__), "..", "data", "cache"),
)
MAX_FILES = int(os.environ.get("OPENPLANET_CACHE_MAX_FILES", "5000"))


def _path_for(key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"{digest}.json")


def disk_get(key: str, ttl: Optional[float] = None) -> Optional[Any]:
    """Return cached value for key, or None on miss/expiry/error."""
    path = _path_for(key)
    try:
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as fh:
            wrapped = json.load(fh)
        ts = wrapped.get("_ts", 0)
        if ttl is not None and ttl > 0 and (time.time() - ts) > ttl:
            return None
        return wrapped.get("data")
    except Exception as exc:  # corrupt file, permission error, etc.
        logger.debug("[disk_cache] read miss for %s: %s", key, exc)
        return None


def disk_set(key: str, data: Any) -> None:
    """Persist value for key. Best-effort; never raises."""
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = _path_for(key)
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"_ts": time.time(), "key": key, "data": data}, fh)
        os.replace(tmp, path)  # atomic
        _evict_if_needed()
    except Exception as exc:
        logger.debug("[disk_cache] write skipped for %s: %s", key, exc)


def _evict_if_needed() -> None:
    """Keep the cache under MAX_FILES by deleting the oldest entries."""
    try:
        entries = [
            os.path.join(CACHE_DIR, f)
            for f in os.listdir(CACHE_DIR)
            if f.endswith(".json")
        ]
        if len(entries) <= MAX_FILES:
            return
        entries.sort(key=lambda p: os.path.getmtime(p))
        for path in entries[: len(entries) - MAX_FILES]:
            try:
                os.remove(path)
            except OSError:
                pass
    except Exception:
        pass
