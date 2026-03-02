"""
climate_engine/audit/input_hashing.py — Deterministic Payload Checksums

compute_checksum(dict) → SHA-256 hex string.
Keys sorted before serialisation — insertion order never affects the hash.
Zero external dependencies (stdlib only).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def compute_checksum(payload: dict[str, Any]) -> str:
    """
    SHA-256 of a JSON-serialised payload dict.
    Keys are sorted so the same logical payload always produces the same hash.

    Usage:
        checksum = compute_checksum(request.model_dump(mode="json"))
    """
    try:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    except TypeError as exc:
        raise TypeError(
            "compute_checksum: payload not JSON-serialisable. "
            f"Use model.model_dump(mode='json') first. Detail: {exc}"
        ) from exc
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_checksum_from_string(s: str) -> str:
    """SHA-256 of an arbitrary UTF-8 string (config files, SQL, etc.)."""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def verify_checksum(payload: dict[str, Any], expected: str) -> bool:
    """
    Verify payload matches a stored checksum.
    Uses hmac.compare_digest to prevent timing attacks.
    """
    return hmac.compare_digest(compute_checksum(payload), expected.lower())