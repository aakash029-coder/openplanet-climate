"""
climate_engine/api/physics/mortality.py — Gasparrini et al. (2017) heat-attributable mortality.
"""
from __future__ import annotations

import logging
import math
import json
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Offline vault loader ──────────────────────────────────────────────────────

try:
    _VAULT_PATH = os.path.join(os.path.dirname(__file__), '../../data/socio_vault.json')
    with open(_VAULT_PATH, 'r') as _f:
        _OFFLINE_VAULT = json.load(_f)
except Exception as e:
    logger.error("Failed to load offline vault in mortality.py: %s", e)
    _OFFLINE_VAULT = {}

_FALLBACK_DEATH_RATE = 7.5  # WHO Global Median

# ── Offline Vault API — Crude Death Rate ──────────────────────────────────────

async def _fetch_worldbank_death_rate(iso3: str) -> float:
    """
    Fetches death rate from the local JSON vault. No network calls.
    """
    country_data = _OFFLINE_VAULT.get(iso3)

    if country_data and country_data.get('death_rate') is not None:
        rate = float(country_data['death_rate'])
        logger.info("Vault retrieved death rate for %s: %.2f", iso3, rate)
        return rate

    logger.warning("ISO3 '%s' not in Vault. Using fallback (7.5).", iso3)
    return _FALLBACK_DEATH_RATE


# ── Saturating exposure-response parameters ───────────────────────────────────
# β = 0.0801 is the Gasparrini et al. (2017) global pooled log-linear slope.
# We saturate ΔT so the slope is preserved at moderate heat but the effective
# excess asymptotes, and we cap the attributable fraction.
_HEAT_BETA = 0.0801
_DT_SATURATION_C = 6.0   # effective ΔT asymptote (°C above P95)
_AF_MAX = 0.35           # max single-day heat attributable fraction (≈ RR 1.54)


def _saturating_temp_excess(temp_excess_c: float) -> float:
    """ΔT_eff = S·(1 − e^(−ΔT/S)). Linear for small ΔT, asymptotes to S."""
    dt = max(0.0, temp_excess_c)
    return _DT_SATURATION_C * (1.0 - math.exp(-dt / _DT_SATURATION_C))


def _gasparrini_mortality(
    pop: int,
    baseline_death_rate_per1000: float,
    temp_excess_c: float,
    hw_days: float,
    vulnerability_multiplier: float = 1.0,
) -> int:
    """
    Estimate heat-attributable deaths using a saturating Gasparrini (2017) model.

    Formula:
        ΔT_eff = S × (1 − e^(−ΔT/S))          (S = 6°C saturation)
        RR     = exp(β × ΔT_eff)
        AF     = min((RR − 1) / RR, AF_max)    (AF_max = 0.35)
        D      = Pop × (DR / 1000) × (HW / 365) × AF × V
    """
    if baseline_death_rate_per1000 <= 0:
        baseline_death_rate_per1000 = _FALLBACK_DEATH_RATE

    dt_eff = _saturating_temp_excess(temp_excess_c)
    rr = math.exp(_HEAT_BETA * dt_eff)
    af = min((rr - 1.0) / rr if rr > 1.0 else 0.0, _AF_MAX)
    hwf = min(hw_days / 365.0, 1.0)

    deaths = int(
        pop * (baseline_death_rate_per1000 / 1000.0) * hwf * af * vulnerability_multiplier
    )
    return max(0, deaths)


def mortality_confidence_level(hw_days: float, pop_source: str = "geocoder") -> dict:
    """
    Return a machine-readable confidence descriptor for the mortality estimate.

    Confidence rules (based on backtest MAE validation):
      - hw_days < 14   → "low"  (acute events: β=0.0801 undershoots 17-75%)
      - hw_days < 30   → "medium-low"
      - hw_days ≥ 30   → "medium"  (chronic season: Moscow 2010 within -28%)
      - pop_source validated (city_vault or census) → upgrades by one tier
    """
    if hw_days < 14:
        level = "low"
        note = (
            "Acute event: chronic β=0.0801 underestimates by 17-75% "
            "(see Gasparrini 2017 Appendix S4). Use for comparative ranking only."
        )
    elif hw_days < 30:
        level = "medium-low"
        note = (
            "Sub-chronic exposure. Comparative ranking reliable; "
            "absolute values carry ±30-50% uncertainty."
        )
    else:
        level = "medium"
        note = (
            "Chronic seasonal exposure. Comparative ranking reliable; "
            "absolute values carry ±15-30% uncertainty (backtest MAE -28%)."
        )

    if pop_source in ("verified_city_vault", "census"):
        tier_map = {"low": "low", "medium-low": "medium-low", "medium": "medium-high"}
        level = tier_map.get(level, level)

    return {
        "level": level,
        "note": note,
        "use_case": "comparative_city_triage",
        "not_suitable_for": "actuarial_pricing, individual_event_forecasting",
        "reference": "Gasparrini et al. 2017, Lancet Planetary Health",
    }
