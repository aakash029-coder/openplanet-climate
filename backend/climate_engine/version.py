"""
climate_engine/version_control.py — Run Provenance & Reproducibility

Responsibilities
────────────────
- Generate a deterministic RunStamp for every scenario run.
- Hash the full ConfigManager state (not a partial dict).
- Track wall-clock duration via perf_counter.
- Expose ENGINE_VERSION as the single canonical version string.
- Connect directly to ConfigManager.to_dict() and ScenarioRun.run_metadata.

Design guarantees
─────────────────
- Same ConfigManager state + same seed → identical config_hash, always.
- config_hash is the full SHA-256 (64 chars), not truncated.
  Truncated hashes collide at scale — unacceptable for institutional audit.
- RunStamp is frozen — no mutation after creation.
- _start is excluded from equality, hashing, and serialisation.
  It is a measurement instrument, not part of the scientific record.
- to_metadata() output is stored directly in ScenarioRun.run_metadata (JSONB).
- generate_run_metadata() is the single entry point called by scenario_runner.py.

Connection map
──────────────
    ConfigManager.to_dict()       → config_hash input
    ConfigManager.summary()       → stored in metadata for human readability
    ScenarioRun.config_checksum   ← RunStamp.config_hash
    ScenarioRun.run_metadata      ← RunStamp.to_metadata()
    ScenarioRun.engine_version    ← ENGINE_VERSION
    audit/input_hashing.py        → input_checksum stored alongside config_hash
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, field, replace, fields
from datetime import datetime, timezone
from typing import Any, Optional

from climate_engine.config import ConfigManager

# ---------------------------------------------------------------------------
# Canonical version string
# Single source of truth — imported by ScenarioRun creation in scenario_runner.py
# and exposed on the /version API endpoint via main.py.
# ---------------------------------------------------------------------------
ENGINE_VERSION = "v1.0.0-GlobalCore"


# ---------------------------------------------------------------------------
# RunStamp — immutable provenance record for one scenario run
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RunStamp:
    """
    Immutable provenance record created at the start of every scenario run.

    Fields stored in ScenarioRun.run_metadata (all JSON-serialisable):
        version       — engine version string
        config_hash   — full SHA-256 of ConfigManager state (64 chars)
        config_summary— human-readable ConfigManager.summary() string
        utc_time      — ISO-8601 UTC timestamp at run creation
        seed          — Monte Carlo RNG seed
        projection_mode — True for future projections, False for historical
        n_monte_carlo — number of MC draws (0 = deterministic)
        elapsed_s     — wall-clock seconds from stamp() to finish()
        git_commit    — GIT_COMMIT_SHA env var if available

    Fields NOT serialised (measurement instruments only):
        _start        — perf_counter value at creation; excluded from
                        __eq__, __hash__, and to_metadata()
    """

    version:        str
    config_hash:    str   # full 64-char SHA-256 — never truncated
    config_summary: str   # ConfigManager.summary() for human readability
    utc_time:       str   # ISO-8601 UTC
    seed:           int
    projection_mode: bool
    n_monte_carlo:  int
    elapsed_s:      float
    git_commit:     Optional[str]

    # Measurement instrument — excluded from scientific record.
    # field(compare=False, hash=False) ensures frozen dataclass equality
    # and hashing ignore this field. repr=False keeps it out of logs.
    _start: float = field(
        default=0.0,
        compare=False,
        hash=False,
        repr=False,
    )

    def finish(self) -> RunStamp:
        """
        Return a new RunStamp with elapsed_s filled in.
        Call this immediately after the engine completes.

        Usage:
            stamp = VersionControl.stamp(cfg, seed=42)
            # ... run engine ...
            stamp = stamp.finish()
            scenario_run.run_metadata = stamp.to_metadata(extra={...})
        """
        return replace(
            self,
            elapsed_s=round(time.perf_counter() - self._start, 3),
        )

    def to_metadata(self, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """
        Serialise to a flat dict suitable for ScenarioRun.run_metadata (JSONB).

        Parameters
        ----------
        extra : dict | None
            Additional key-value pairs merged into the metadata dict.
            Used by scenario_runner.py to attach aggregates:
                stamp.to_metadata(extra={
                    "input_checksum": "abc123...",
                    "total_attributable_deaths": 4821.3,
                    ...
                })

        Returns
        -------
        dict  — all values are JSON-serialisable (str, int, float, bool, None).
        """
        base = {
            "engine_version":  self.version,
            "config_hash":     self.config_hash,
            "config_summary":  self.config_summary,
            "utc_time":        self.utc_time,
            "seed":            self.seed,
            "projection_mode": self.projection_mode,
            "n_monte_carlo":   self.n_monte_carlo,
            "elapsed_s":       self.elapsed_s,
            "git_commit":      self.git_commit,
        }
        if extra:
            # Extra keys must not silently overwrite core provenance fields
            overlap = set(extra) & set(base)
            if overlap:
                raise ValueError(
                    f"version_control.to_metadata(): extra dict contains keys "
                    f"that would overwrite core provenance fields: {sorted(overlap)}. "
                    f"Rename your extra keys."
                )
            base.update(extra)
        return base

    def verify(self, cfg: ConfigManager) -> bool:
        """
        Verify that a ConfigManager produces the same hash as this stamp.
        Used to confirm a stored run_metadata matches the config used.

        Usage:
            if not stamp.verify(current_config):
                raise RuntimeError("Config mismatch — run is not reproducible.")
        """
        import hmac
        return hmac.compare_digest(
            self.config_hash,
            VersionControl.hash_config(cfg),
        )


# ---------------------------------------------------------------------------
# VersionControl — stamp factory
# ---------------------------------------------------------------------------

class VersionControl:
    """
    Factory for RunStamp objects.

    Usage (in scenario_runner.py):
        stamp = VersionControl.stamp(cfg, seed=payload.monte_carlo_seed, ...)
        # ... run engine ...
        stamp = stamp.finish()
        scenario_run.run_metadata = stamp.to_metadata(extra={...})
        scenario_run.config_checksum = stamp.config_hash
    """

    CURRENT: str = ENGINE_VERSION

    @classmethod
    def stamp(
        cls,
        cfg: ConfigManager,
        *,
        seed: int,
        projection_mode: bool,
        n_monte_carlo: int = 0,
    ) -> RunStamp:
        """
        Create a RunStamp at the start of a scenario run.

        Parameters
        ----------
        cfg : ConfigManager
            The fully validated, frozen config for this run.
            ConfigManager.to_dict() is used as the hash input — the entire
            config state is captured, not a partial subset.
        seed : int
            Monte Carlo RNG seed. Stored for full reproducibility.
        projection_mode : bool
            True for SSP future projections, False for historical baseline.
        n_monte_carlo : int
            Number of MC draws. 0 = deterministic run.
        """
        return RunStamp(
            version=cls.CURRENT,
            config_hash=cls.hash_config(cfg),
            config_summary=cfg.summary(),
            utc_time=datetime.now(timezone.utc).isoformat(),
            seed=seed,
            projection_mode=projection_mode,
            n_monte_carlo=n_monte_carlo,
            elapsed_s=0.0,
            git_commit=os.environ.get("GIT_COMMIT_SHA"),
            _start=time.perf_counter(),
        )

    @staticmethod
    def hash_config(cfg: ConfigManager) -> str:
        """
        Compute the full SHA-256 hex digest of a ConfigManager's serialised state.

        Uses ConfigManager.to_dict() as the canonical serialisation — this
        captures every sub-config block (coupling, epidemiology, urban_physics,
        etc.) in a deterministic, sorted JSON representation.

        Returns a 64-character hex string. Never truncated.
        """
        raw = json.dumps(cfg.to_dict(), sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def verify_metadata(
        metadata: dict[str, Any],
        cfg: ConfigManager,
    ) -> bool:
        """
        Verify a stored run_metadata dict against a live ConfigManager.

        Returns True if the config hash in the metadata matches
        the hash of the provided config. Used in reproducibility audits.

        Usage:
            stored_meta = scenario_run.run_metadata
            if not VersionControl.verify_metadata(stored_meta, current_cfg):
                raise RuntimeError("Stored run cannot be reproduced with current config.")
        """
        import hmac
        stored_hash = metadata.get("config_hash", "")
        live_hash   = VersionControl.hash_config(cfg)
        return hmac.compare_digest(stored_hash, live_hash)


# ---------------------------------------------------------------------------
# generate_run_metadata() — drop-in for scenario_runner.py
# ---------------------------------------------------------------------------

def generate_run_metadata(
    config: ConfigManager,
    seed: int,
    projection_mode: bool,
    n_monte_carlo: int = 0,
    extra: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Convenience function called by scenario_runner.py after a run completes.

    Creates a stamp, immediately finishes it (elapsed_s ≈ 0 since this is
    called post-hoc), and returns the metadata dict for storage in
    ScenarioRun.run_metadata.

    For accurate elapsed_s: create the stamp at run START via
    VersionControl.stamp(), call stamp.finish() at run END, then call
    stamp.to_metadata(extra=...) directly.

    This function is provided for backward compatibility with callers that
    do not need precise timing.
    """
    stamp = VersionControl.stamp(
        config,
        seed=seed,
        projection_mode=projection_mode,
        n_monte_carlo=n_monte_carlo,
    ).finish()
    return stamp.to_metadata(extra=extra)