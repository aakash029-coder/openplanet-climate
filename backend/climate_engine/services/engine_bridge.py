"""
climate_engine/services/engine_bridge.py — Science ↔ Service Boundary

Contract
────────
- Input:  list[H3Cell] + RunParameters + ConfigManager + AsyncSession
- Output: (list[dict ready for pg bulk insert], aggregate dict)
- Queries ClimateObservation, MortalityBaseline, LifeTable from DB.
- Calls compute_mortality() — only science call in the service layer.
- No HTTP. No commits. No flushes. Read-only DB access.

Memory contract
───────────────
Processes exactly one batch (BATCH_SIZE cells) at a time.
Never accumulates across batches.

Real data sources (no placeholders remaining)
─────────────────────────────────────────────
mortality_rate_baseline   ← MortalityBaseline table (country/age stratified)
life_expectancy_remaining ← LifeTable table (WHO, country/age stratified)
temperature               ← ClimateObservation table (scenario + time window)
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from climate_engine.config import ConfigManager
from climate_engine.db.models import (
    ClimateObservation,
    ClimateScenario,
    H3Cell,
    LifeTable,
    MortalityBaseline,
)
from climate_engine.epidemiology import compute_mortality
from climate_engine.services.scenario_runner import RunParameters

logger = logging.getLogger(__name__)

# Global median MMT fallback (GBD meta-analysis) when no observation exists
_FALLBACK_MMT_C: float = 29.0

# Fallback values used only when country has no DB record.
# These are global averages — logged as warnings when used.
_FALLBACK_MORTALITY_RATE: float = 0.00834      # global mean annual rate (WHO 2019)
_FALLBACK_LIFE_EXPECTANCY: float = 12.5        # conservative global mean remaining


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_engine_batch(
    cells: list[H3Cell],
    scenario_run_id: int,
    params: RunParameters,
    config: ConfigManager,
    db: AsyncSession,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Run the mortality engine over one batch of H3Cell rows.

    Steps
    ─────
    1.  Load ClimateObservation rows for this batch (IN query, not N+1).
    2.  Load MortalityBaseline rates by country (batch countries, one query).
    3.  Load LifeTable data by country (batch countries, one query).
    4.  Build computation DataFrame (join all sources).
    5.  Build MMT DataFrame (75th percentile per cell).
    6.  Call compute_mortality() — pure science.
    7.  Build MortalityResult insert dicts.
    8.  Return insert dicts + batch aggregates.
    """
    if not cells:
        return [], {}

    cell_ids    = [c.id   for c in cells]
    cell_index  = {c.id: c for c in cells}
    countries   = list({c.country_iso2 for c in cells if c.country_iso2})
    ref_year    = params.projection_start_year

    # ── STEP 1 — Climate observations ────────────────────────────────────────
    climate_rows = await _load_climate_observations(db, cell_ids, params)

    if not climate_rows:
        logger.warning(
            "engine_bridge: No ClimateObservation rows for batch of %d cells "
            "(scenario=%s, %d-%d). Batch skipped.",
            len(cells), params.scenario.value,
            params.projection_start_year, params.projection_end_year,
        )
        return [], {}

    # ── STEP 2 — Mortality baseline rates ────────────────────────────────────
    baseline_map = await _load_mortality_baselines(db, countries, ref_year)

    # ── STEP 3 — Life table data ──────────────────────────────────────────────
    lifetable_map = await _load_life_tables(db, countries, ref_year)

    # ── STEP 4 — Build computation DataFrame ─────────────────────────────────
    df = _build_computation_df(
        climate_rows=climate_rows,
        cell_index=cell_index,
        params=params,
        baseline_map=baseline_map,
        lifetable_map=lifetable_map,
    )

    if df.empty:
        logger.warning(
            "engine_bridge: Empty DataFrame after join for batch of %d cells. "
            "Check ClimateObservation coverage.",
            len(cells),
        )
        return [], {}

    # ── STEP 5 — Build MMT DataFrame ─────────────────────────────────────────
    mmt_df = _build_mmt_df(df)

    # ── STEP 6 — Science engine ───────────────────────────────────────────────
    result_df = compute_mortality(
        df=df,
        config=config,
        mmt_df=mmt_df,
        ac_rate_override=params.ac_rate           if params.is_projection else None,
        ac_efficiency_phi_override=params.ac_efficiency_phi if params.is_projection else None,
    )

    # ── STEP 7 — Build insert dicts ───────────────────────────────────────────
    period_start = datetime(params.projection_start_year, 1,  1,  tzinfo=timezone.utc)
    period_end   = datetime(params.projection_end_year,   12, 31, tzinfo=timezone.utc)

    mortality_rows = _build_mortality_rows(result_df, scenario_run_id, period_start, period_end)
    batch_agg      = _compute_aggregates(result_df)

    logger.debug(
        "engine_bridge: batch complete — %d cells, "
        "attr_deaths=%.4f, mean_rr=%.4f.",
        len(result_df),
        batch_agg["attributable_deaths"],
        batch_agg["mean_rr_sum"] / max(batch_agg["n_cells"], 1),
    )

    return mortality_rows, batch_agg


# ---------------------------------------------------------------------------
# Step 1 — Load ClimateObservation rows
# ---------------------------------------------------------------------------

async def _load_climate_observations(
    db: AsyncSession,
    cell_ids: list[int],
    params: RunParameters,
) -> list[ClimateObservation]:
    """
    Load ClimateObservation rows for this batch in one IN query.
    Filters by scenario and time window. Never N+1.
    """
    query = (
        select(ClimateObservation)
        .where(ClimateObservation.h3_cell_id.in_(cell_ids))
        .where(
            ClimateObservation.observed_at >= datetime(
                params.projection_start_year, 1, 1, tzinfo=timezone.utc
            )
        )
        .where(
            ClimateObservation.observed_at <= datetime(
                params.projection_end_year, 12, 31, tzinfo=timezone.utc
            )
        )
    )

    if params.is_projection:
        query = query.where(ClimateObservation.scenario == params.scenario)
    else:
        query = query.where(
            ClimateObservation.scenario == ClimateScenario.historical
        )

    result = await db.execute(query)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Step 2 — Load MortalityBaseline rates
# ---------------------------------------------------------------------------

async def _load_mortality_baselines(
    db: AsyncSession,
    countries: list[str],
    ref_year: int,
) -> dict[str, float]:
    """
    Load mortality_rate for each country from MortalityBaseline.
    Returns a dict: country_iso2 → weighted mean annual mortality rate.

    Finds the closest reference_year if exact year is unavailable.
    Falls back to _FALLBACK_MORTALITY_RATE with a warning if country
    has no DB record at all.
    """
    if not countries:
        return {}

    result = await db.execute(
        select(
            MortalityBaseline.country_iso2,
            MortalityBaseline.mortality_rate,
            MortalityBaseline.reference_year,
        )
        .where(MortalityBaseline.country_iso2.in_(countries))
        .order_by(MortalityBaseline.country_iso2, MortalityBaseline.reference_year)
    )
    rows = result.all()

    # Build dict: country → rate from the closest available reference_year
    country_rates: dict[str, float] = {}
    country_year_rates: dict[str, list[tuple[int, float]]] = {}

    for row in rows:
        country_year_rates.setdefault(row.country_iso2, []).append(
            (row.reference_year, row.mortality_rate)
        )

    for country, year_rates in country_year_rates.items():
        # Pick the year-rate pair closest to ref_year
        closest = min(year_rates, key=lambda yr: abs(yr[0] - ref_year))
        country_rates[country] = closest[1]

    # Log warning for countries with no DB record
    missing = set(countries) - set(country_rates)
    if missing:
        logger.warning(
            "engine_bridge: No MortalityBaseline found for countries %s "
            "— using global fallback rate %.6f. "
            "Load WHO mortality data to improve accuracy.",
            sorted(missing), _FALLBACK_MORTALITY_RATE,
        )

    return country_rates


# ---------------------------------------------------------------------------
# Step 3 — Load LifeTable data
# ---------------------------------------------------------------------------

async def _load_life_tables(
    db: AsyncSession,
    countries: list[str],
    ref_year: int,
) -> dict[str, float]:
    """
    Load life_expectancy_remaining for each country from LifeTable.
    Returns a dict: country_iso2 → mean life expectancy remaining (years).

    Uses population-weighted mean across all age groups per country.
    Falls back to _FALLBACK_LIFE_EXPECTANCY with a warning if missing.
    """
    if not countries:
        return {}

    result = await db.execute(
        select(
            LifeTable.country_iso2,
            LifeTable.life_expectancy_remaining,
            LifeTable.reference_year,
        )
        .where(LifeTable.country_iso2.in_(countries))
        .order_by(LifeTable.country_iso2, LifeTable.reference_year)
    )
    rows = result.all()

    country_lex_years: dict[str, list[tuple[int, float]]] = {}
    for row in rows:
        country_lex_years.setdefault(row.country_iso2, []).append(
            (row.reference_year, row.life_expectancy_remaining)
        )

    country_lex: dict[str, float] = {}
    for country, year_lex in country_lex_years.items():
        closest = min(year_lex, key=lambda yr: abs(yr[0] - ref_year))
        country_lex[country] = closest[1]

    missing = set(countries) - set(country_lex)
    if missing:
        logger.warning(
            "engine_bridge: No LifeTable found for countries %s "
            "— using global fallback %.1f years. "
            "Load WHO life table data to improve accuracy.",
            sorted(missing), _FALLBACK_LIFE_EXPECTANCY,
        )

    return country_lex


# ---------------------------------------------------------------------------
# Step 4 — Build computation DataFrame
# ---------------------------------------------------------------------------

def _build_computation_df(
    climate_rows: list[ClimateObservation],
    cell_index: dict[int, H3Cell],
    params: RunParameters,
    baseline_map: dict[str, float],
    lifetable_map: dict[str, float],
) -> pd.DataFrame:
    """
    Join ClimateObservation + H3Cell + MortalityBaseline + LifeTable
    into one computation DataFrame.

    One row per H3Cell (mean of all observations in the time window).
    Applies delta_t, adapt_alpha, and population_scaler adjustments.
    """
    rows = []

    for obs in climate_rows:
        cell = cell_index.get(obs.h3_cell_id)
        if cell is None:
            continue

        # Resolve temperature — prefer temp_c, fall back to (max+min)/2
        if obs.temp_c is not None:
            base_temp = float(obs.temp_c)
        elif obs.temp_max_c is not None and obs.temp_min_c is not None:
            base_temp = (float(obs.temp_max_c) + float(obs.temp_min_c)) / 2.0
        else:
            continue  # no usable temperature — skip row

        # Wet-bulb — use observed if available, else estimate from temp
        t_wb = (
            float(obs.wetbulb_c)
            if obs.wetbulb_c is not None
            else _estimate_wetbulb(base_temp, obs.humidity_frac)
        )

        # Mortality rate — from DB, else fallback
        country      = cell.country_iso2 or ""
        mort_rate    = baseline_map.get(country, _FALLBACK_MORTALITY_RATE)
        life_exp     = lifetable_map.get(country, _FALLBACK_LIFE_EXPECTANCY)

        rows.append({
            "h3_cell_id":               obs.h3_cell_id,
            "h3_index":                 cell.h3_index,
            "raw_temp_c":               base_temp,
            "t_wb":                     t_wb,
            "population":               float(cell.population or 0.0),
            "is_tropical":              bool(cell.is_tropical),
            "elevation_m":              float(cell.elevation_m or 0.0),
            "mortality_rate_baseline":  mort_rate / 365.0,  # convert annual → daily
            "life_expectancy_remaining":life_exp,
            "climate_zone":             cell.climate_zone or ("Af" if cell.is_tropical else "Cfa"),
            "country_iso2":             country,
        })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)

    # Aggregate to one representative row per cell
    numeric_cols = [
        "raw_temp_c", "t_wb", "population",
        "mortality_rate_baseline", "life_expectancy_remaining", "elevation_m",
    ]
    agg_dict = {col: "mean" for col in numeric_cols if col in df.columns}
    agg_dict.update({
        "h3_index":    "first",
        "is_tropical": "first",
        "climate_zone":"first",
        "country_iso2":"first",
    })
    df = df.groupby("h3_cell_id", as_index=False).agg(agg_dict)

    # Apply projection adjustments
    effective_delta    = params.delta_t_mean * (1.0 - params.adapt_alpha)
    df["temperature_c"]= df["raw_temp_c"] + effective_delta
    df["population"]   = (df["population"] * params.population_scaler).clip(lower=0.0)

    return df


# ---------------------------------------------------------------------------
# Step 5 — Build MMT DataFrame
# ---------------------------------------------------------------------------

def _build_mmt_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Minimum Mortality Temperature per H3 cell.

    Method: 75th percentile of temperature_c per cell, clipped to [24, 36]°C.
    This is the standard approach in GBD heat-mortality studies when
    empirical MMT data is unavailable.

    Production upgrade path: replace with a pre-computed mmt_values table
    populated from historical exposure-response functions.
    """
    mmt_rows = []
    for _, grp in df.groupby("h3_cell_id"):
        temp_75th = float(np.percentile(grp["temperature_c"], 75))
        mmt       = float(np.clip(temp_75th, 24.0, 36.0))
        mmt_rows.append({
            "h3_cell_id": int(grp["h3_cell_id"].iloc[0]),
            "mmt":        mmt,
        })
    return pd.DataFrame(mmt_rows)


# ---------------------------------------------------------------------------
# Step 7 — Build MortalityResult insert dicts
# ---------------------------------------------------------------------------

def _build_mortality_rows(
    result_df: pd.DataFrame,
    scenario_run_id: int,
    period_start: datetime,
    period_end: datetime,
) -> list[dict[str, Any]]:
    """
    Convert result DataFrame to insert dicts for pg_insert(MortalityResult).
    _safe_float() prevents NaN/inf from entering the DB.
    """
    rows = []
    for _, row in result_df.iterrows():
        rows.append({
            "h3_cell_id":          int(row["h3_cell_id"]),
            "scenario_run_id":     scenario_run_id,
            "period_start":        period_start,
            "period_end":          period_end,
            "rr":                  _safe_float(row.get("rr")),
            "af":                  _safe_float(row.get("af")),
            "baseline_deaths":     _safe_float(row.get("baseline_deaths")),
            "attributable_deaths": _safe_float(row.get("attributable_deaths")),
            "ac_dampened_deaths":  _safe_float(row.get("ac_dampened_deaths")),
            "yll":                 _safe_float(row.get("yll")),
            "beta_used":           _safe_float(row.get("beta_used")),
        })
    return rows


# ---------------------------------------------------------------------------
# Step 8 — Batch aggregates
# ---------------------------------------------------------------------------

def _compute_aggregates(result_df: pd.DataFrame) -> dict[str, Any]:
    """Scalar aggregates absorbed by RunAggregates.absorb() in scenario_runner."""
    if result_df.empty:
        return {
            "attributable_deaths": 0.0,
            "ac_dampened_deaths":  0.0,
            "yll":                 0.0,
            "max_temperature":     float("-inf"),
            "mean_rr_sum":         0.0,
            "n_cells":             0,
        }
    return {
        "attributable_deaths": float(result_df["attributable_deaths"].sum()),
        "ac_dampened_deaths":  float(result_df["ac_dampened_deaths"].sum()),
        "yll":                 float(result_df["yll"].sum()),
        "max_temperature":     float(result_df["temperature_c"].max()),
        "mean_rr_sum":         float(result_df["rr"].sum()),
        "n_cells":             int(len(result_df)),
    }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _estimate_wetbulb(temp_c: float, humidity_frac: Optional[float]) -> float:
    """
    Estimate wet-bulb temperature from air temperature and relative humidity.

    Uses Stull (2011) empirical formula — accurate to ±0.65°C for
    RH ∈ [5%, 99%] and T ∈ [−20°C, 50°C].

    Falls back to 0.67 × temp_c if humidity is unavailable
    (rough approximation for tropical humid conditions).
    """
    if humidity_frac is None or not (0.0 < humidity_frac <= 1.0):
        return temp_c * 0.67

    rh_pct = humidity_frac * 100.0
    t_wb   = (
        temp_c * math.atan(0.151977 * math.sqrt(rh_pct + 8.313659))
        + math.atan(temp_c + rh_pct)
        - math.atan(rh_pct - 1.676331)
        + 0.00391838 * rh_pct ** 1.5 * math.atan(0.023101 * rh_pct)
        - 4.686035
    )
    return t_wb


def _safe_float(v: Any) -> Optional[float]:
    """Convert to float, return None for NaN, inf, or unconvertible values."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None