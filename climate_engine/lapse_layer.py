"""
climate_engine/lapse_layer.py — Elevation Correction Engine

Responsibilities
────────────────
- Apply environmental lapse rate to correct temperature for elevation.
- Support explicit lapse_rate_override for Monte Carlo sampling.
- Enforce elevation presence when required.
- Never mutate config or input DataFrame.

Institutional rules
───────────────────
- Sign convention ENFORCED: lapse_rate must be negative (°C/km).
  Higher elevation → colder temperature.
  temp_corrected = temp_c + lapse_rate * elevation_km
- Override fully replaces config default — no partial scaling.
- In projection_mode with override: elevation_km is REQUIRED.
  Missing elevation raises immediately — no silent skip.
- Input DataFrame is always copied — never mutated.
"""

from __future__ import annotations

import logging
from typing import Optional

import pandas as pd

from climate_engine.config import ConfigManager

logger = logging.getLogger(__name__)


def apply_lapse_correction(
    df: pd.DataFrame,
    config: ConfigManager,
    *,
    lapse_rate_override: Optional[float] = None,
    projection_mode: bool = False,
) -> pd.DataFrame:
    """
    Apply environmental lapse rate correction to temperature.

    Sign convention (enforced — raises ValueError if violated):
        lapse_rate = -6.5 °C/km  →  higher elevation is colder.
        temp_corrected_c = temp_c + lapse_rate * elevation_km

    Parameters
    ----------
    df : pd.DataFrame
        Must contain 'temp_c'.
        Must contain 'elevation_km' when projection_mode=True
        or when lapse_rate_override is provided.
    config : ConfigManager
        Frozen engine config. Never mutated.
    lapse_rate_override : float | None
        Explicit lapse rate (°C/km). Fully replaces config default.
        No partial scaling — override IS the value used.
    projection_mode : bool
        When True with any override: elevation_km is strictly required.
        Raises ValueError rather than silently skipping.

    Returns
    -------
    pd.DataFrame
        Copy of input with 'temp_corrected_c' column added.
        Original 'temp_c' column is never modified.

    Raises
    ------
    ValueError
        - lapse_rate is positive (sign convention violated).
        - elevation_km is missing when required.
        - elevation_km contains null values.
    """
    # Never mutate the caller's DataFrame
    df = df.copy()

    # ── Resolve effective lapse rate ─────────────────────────────────────────
    lapse_rate = (
        lapse_rate_override
        if lapse_rate_override is not None
        else config.lapse.lapse_rate
    )

    # ── Enforce sign convention ──────────────────────────────────────────────
    if lapse_rate > 0:
        raise ValueError(
            f"lapse_layer.py: lapse_rate must be negative (°C/km). "
            f"Got {lapse_rate}. "
            "Convention: higher elevation → colder temperature. "
            "Use a negative value e.g. -6.5."
        )

    # ── Elevation requirement logic ──────────────────────────────────────────
    # Strict requirement: projection_mode + override, or any override alone.
    requires_elevation = projection_mode and lapse_rate_override is not None
    override_present   = lapse_rate_override is not None

    if requires_elevation or override_present:
        _require_elevation(df)

    # ── Apply correction ─────────────────────────────────────────────────────
    if "elevation_km" not in df.columns:
        # No elevation data, no override — pass through with identity correction.
        # Only reached in non-projection mode with default config lapse rate.
        logger.debug(
            "lapse_layer.py: No 'elevation_km' column found and no override "
            "provided. Passing temp_c through as temp_corrected_c (no correction)."
        )
        df["temp_corrected_c"] = df["temp_c"]
        return df

    # Validate elevation values before computation
    _require_elevation(df)

    # Core correction: temp_corrected = temp_c + lapse_rate * elevation_km
    df["temp_corrected_c"] = df["temp_c"] + lapse_rate * df["elevation_km"]

    logger.debug(
        "lapse_layer.py: Lapse correction applied "
        "(lapse_rate=%.4f °C/km, n_rows=%d, "
        "temp_corrected range=[%.2f, %.2f] °C).",
        lapse_rate,
        len(df),
        df["temp_corrected_c"].min(),
        df["temp_corrected_c"].max(),
    )

    return df


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_elevation(df: pd.DataFrame) -> None:
    """
    Assert that 'elevation_km' is present and fully populated.
    Raises ValueError with a clear message if either check fails.
    """
    if "elevation_km" not in df.columns:
        raise ValueError(
            "lapse_layer.py: 'elevation_km' column is required but missing. "
            "Cannot apply lapse correction without elevation data. "
            "Ensure your ingestion pipeline provides elevation values."
        )

    n_null = int(df["elevation_km"].isnull().sum())
    if n_null > 0:
        raise ValueError(
            f"lapse_layer.py: 'elevation_km' contains {n_null} null value(s). "
            "All rows must have valid elevation data before lapse correction. "
            "Fill or drop nulls in the ingestion layer."
        )