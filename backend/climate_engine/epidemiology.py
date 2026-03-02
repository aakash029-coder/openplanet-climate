"""
climate_engine/epidemiology.py — Heat-Attributable Mortality Engine

Public interface
────────────────
    compute_mortality(df, config, mmt_df, *, ac_rate_override, ac_efficiency_phi_override)
        → pd.DataFrame with columns: rr, af, baseline_deaths,
          attributable_deaths, ac_dampened_deaths, yll

This module is the single science entry point called by engine_bridge.py.
It wraps EpidemiologyLayer (the fully vectorised GBD-aligned pipeline)
behind a clean functional interface so the service layer never needs to
instantiate classes or manage state.

Pipeline (strict order — never reorder)
────────────────────────────────────────
    STEP 1  Merge MMT per H3 cell
    STEP 2  Select β by climate zone (tropical vs global)
    STEP 3  Heat-only RR = exp(β × max(T - MMT, 0))
    STEP 4  Acclimation dampening (late_summer column if present)
    STEP 5  Wet-bulb κ multiplier above threshold
    STEP 6  AC mortality dampening φ (projection mode only)
    STEP 7  Attributable Fraction AF = (RR - 1) / RR
    STEP 8  Attributable Deaths = AF × baseline_deaths_daily
    STEP 9  YLL = attributable_deaths × life_expectancy_remaining

Institutional guarantees
─────────────────────────
- Input DataFrame is never mutated — always copied at entry.
- No global state, no class instantiation required by caller.
- All overrides fully replace config values — no partial scaling.
- AC dampening never produces RR < 1 (clips to lower bound 1.0).
- CHECK constraints in models.py enforce: rr >= 0, af in [0,1],
  attributable_deaths >= 0. This layer produces values that satisfy
  those constraints by construction.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

from climate_engine.config import ConfigManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Required columns — validated at entry, not per-step
# ---------------------------------------------------------------------------

_REQUIRED_INPUT_COLS: frozenset[str] = frozenset({
    "h3_cell_id",
    "temperature_c",
    "t_wb",
    "population",
    "mortality_rate_baseline",
    "life_expectancy_remaining",
    "climate_zone",
})

_REQUIRED_MMT_COLS: frozenset[str] = frozenset({
    "h3_cell_id",
    "mmt",
})


# ---------------------------------------------------------------------------
# Public functional interface (called by engine_bridge.py)
# ---------------------------------------------------------------------------

def compute_mortality(
    df: pd.DataFrame,
    config: ConfigManager,
    mmt_df: pd.DataFrame,
    *,
    ac_rate_override: Optional[float] = None,
    ac_efficiency_phi_override: Optional[float] = None,
) -> pd.DataFrame:
    """
    Run the full heat-mortality pipeline over a batch DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        One row per H3 cell. Required columns:
            h3_cell_id, temperature_c, t_wb, population,
            mortality_rate_baseline, life_expectancy_remaining, climate_zone.
        Optional columns:
            late_summer (bool) — activates acclimation dampening.
            ac_rate (float)    — per-row AC penetration [0, 1].
    config : ConfigManager
        Frozen scientific config. Never mutated.
    mmt_df : pd.DataFrame
        Minimum Mortality Temperature lookup.
        Required columns: h3_cell_id, mmt.
    ac_rate_override : float | None
        Scalar AC penetration rate [0, 1] for the whole batch.
        Overrides per-row ac_rate column if both present.
        None = no AC dampening (historical baseline mode).
    ac_efficiency_phi_override : float | None
        AC mortality dampening coefficient φ.
        None = no AC dampening (historical baseline mode).

    Returns
    -------
    pd.DataFrame
        Input df copy with added columns:
            beta_used, rr, af, baseline_deaths,
            attributable_deaths, ac_dampened_deaths, yll.
    """
    _validate_input(df, mmt_df)

    layer = EpidemiologyLayer(config)
    return layer.run(
        df=df,
        mmt_df=mmt_df,
        ac_rate_override=ac_rate_override,
        ac_efficiency_phi=ac_efficiency_phi_override,
    )


# ---------------------------------------------------------------------------
# EpidemiologyLayer — vectorised GBD-aligned pipeline
# ---------------------------------------------------------------------------

class EpidemiologyLayer:
    """
    Heat-attributable mortality engine.

    Fully vectorised, deterministic, GBD-aligned pipeline.
    No global state. No mutation of inputs.
    Instantiated once per batch by compute_mortality().
    """

    def __init__(self, cfg: ConfigManager) -> None:
        self._cfg = cfg

    def run(
        self,
        df: pd.DataFrame,
        mmt_df: pd.DataFrame,
        *,
        beta_global_override: Optional[float] = None,
        beta_tropical_override: Optional[float] = None,
        ac_rate_override: Optional[float] = None,
        ac_efficiency_phi: Optional[float] = None,
    ) -> pd.DataFrame:
        """
        Execute all 9 pipeline steps in strict order.

        Parameters
        ----------
        beta_global_override : float | None
            Replaces EpidemiologyConfig.BETA_HEAT_GLOBAL.
            Used by Monte Carlo engine for per-draw β sampling.
        beta_tropical_override : float | None
            Replaces EpidemiologyConfig.BETA_HEAT_TROPICAL.
        ac_rate_override : float | None
            Explicit AC penetration rate for the batch.
            When None, falls back to per-row 'ac_rate' column,
            then to 0 (no dampening).
        ac_efficiency_phi : float | None
            AC mortality dampening coefficient φ.
            When None, AC dampening step is entirely skipped.
        """
        epi = self._cfg.epidemiology
        df  = df.copy()  # never mutate caller's DataFrame

        # ── STEP 1 — Merge MMT ───────────────────────────────────────────────
        pre_len = len(df)
        df = df.merge(
            mmt_df[["h3_cell_id", "mmt"]],
            on="h3_cell_id",
            how="left",
            validate="many_to_one",
        )
        n_missing = int(df["mmt"].isna().sum())
        if n_missing > 0:
            raise ValueError(
                f"EpidemiologyLayer STEP 1: {n_missing}/{pre_len} rows have no MMT "
                f"after merge. Ensure mmt_df covers all H3 cells in this batch."
            )

        # ── STEP 2 — Select β per climate zone ──────────────────────────────
        beta_global   = (beta_global_override
                         if beta_global_override is not None
                         else epi.BETA_HEAT_GLOBAL)
        beta_tropical = (beta_tropical_override
                         if beta_tropical_override is not None
                         else epi.BETA_HEAT_TROPICAL)

        df["beta_used"] = np.where(
            df["climate_zone"].str.startswith("A"),
            beta_tropical,
            beta_global,
        )

        # ── STEP 3 — Heat-only RR (right tail only, no cold risk) ───────────
        excess   = (df["temperature_c"] - df["mmt"]).clip(lower=0.0)
        log_rr   = np.clip(df["beta_used"] * excess, -50.0, 50.0)
        df["rr"] = np.where(
            df["temperature_c"] > df["mmt"],
            np.exp(log_rr),
            1.0,
        )

        # ── STEP 4 — Acclimation (late_summer column, optional) ──────────────
        if "late_summer" in df.columns:
            df["rr"] = np.where(
                df["late_summer"].astype(bool),
                df["rr"] * epi.ACCLIMATION_FACTOR,
                df["rr"],
            )

        # ── STEP 5 — Wet-bulb κ multiplier ──────────────────────────────────
        delta_wb = (df["t_wb"] - epi.WETBULB_THRESHOLD).clip(lower=0.0)
        kappa    = 1.0 + epi.WETBULB_KAPPA_STEEPNESS * delta_wb
        df["rr"] = np.where(
            df["t_wb"] >= epi.WETBULB_THRESHOLD,
            df["rr"] * kappa,
            df["rr"],
        )

        # ── STEP 6 — AC mortality dampening (projection mode only) ───────────
        # RR_adapted = RR × (1 − AC_rate × φ), clipped to [1.0, ∞).
        # AC reduces heat burden but cannot produce a protective RR < 1.
        # Step is entirely skipped when ac_efficiency_phi is None
        # (historical baseline runs).
        if ac_efficiency_phi is not None:
            if ac_rate_override is not None:
                ac_rate_col = float(ac_rate_override)
            elif "ac_rate" in df.columns:
                ac_rate_col = df["ac_rate"].clip(0.0, 1.0)
            else:
                ac_rate_col = 0.0

            dampening    = (1.0 - ac_rate_col * float(ac_efficiency_phi))
            df["rr"]     = (df["rr"] * dampening).clip(lower=1.0)

        # ── STEP 7 — Attributable Fraction ──────────────────────────────────
        df["af"] = np.where(
            df["rr"] > 1.0,
            (df["rr"] - 1.0) / df["rr"],
            0.0,
        )
        # Clip to [0, 1] as a hard safety net — satisfies DB CHECK constraint
        df["af"] = df["af"].clip(0.0, 1.0)

        # ── STEP 8 — Attributable Deaths ─────────────────────────────────────
        daily_baseline          = (
            df["population"] * df["mortality_rate_baseline"] / 365.0
        )
        df["baseline_deaths"]     = daily_baseline
        df["attributable_deaths"] = (df["af"] * daily_baseline).clip(lower=0.0)

        # AC-dampened deaths column — same as attributable_deaths when no AC,
        # already reduced via RR dampening in STEP 6 when AC is active.
        # We store it separately so the DB has both for comparison.
        df["ac_dampened_deaths"] = df["attributable_deaths"]

        # ── STEP 9 — YLL ─────────────────────────────────────────────────────
        df["yll"] = df["attributable_deaths"] * df["life_expectancy_remaining"]

        logger.debug(
            "EpidemiologyLayer: batch complete — %d rows, "
            "total_attr_deaths=%.4f, mean_rr=%.4f.",
            len(df),
            float(df["attributable_deaths"].sum()),
            float(df["rr"].mean()),
        )

        return df


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def _validate_input(df: pd.DataFrame, mmt_df: pd.DataFrame) -> None:
    """
    Validate required columns on both DataFrames before pipeline runs.
    Raises ValueError with a precise message on the first failure found.
    Called once at the top of compute_mortality() — not repeated per step.
    """
    # Input DataFrame
    missing_df = _REQUIRED_INPUT_COLS - set(df.columns)
    if missing_df:
        raise ValueError(
            f"epidemiology.compute_mortality: df is missing required columns: "
            f"{sorted(missing_df)}. "
            f"Present columns: {sorted(df.columns.tolist())}."
        )

    if df.empty:
        raise ValueError(
            "epidemiology.compute_mortality: df is empty. "
            "Nothing to compute."
        )

    if (df["mortality_rate_baseline"] < 0).any():
        raise ValueError(
            "epidemiology.compute_mortality: mortality_rate_baseline "
            "contains negative values. All values must be >= 0."
        )

    if (df["population"] < 0).any():
        raise ValueError(
            "epidemiology.compute_mortality: population contains negative values."
        )

    # MMT DataFrame
    missing_mmt = _REQUIRED_MMT_COLS - set(mmt_df.columns)
    if missing_mmt:
        raise ValueError(
            f"epidemiology.compute_mortality: mmt_df is missing required columns: "
            f"{sorted(missing_mmt)}."
        )

    if mmt_df["mmt"].isna().any():
        raise ValueError(
            "epidemiology.compute_mortality: mmt_df contains null MMT values. "
            "All H3 cells must have a valid MMT before the pipeline runs."
        )

    if mmt_df["h3_cell_id"].isna().any():
        raise ValueError(
            "epidemiology.compute_mortality: mmt_df contains null h3_cell_id values."
        )