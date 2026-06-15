"""
climate_engine/api/physics/audit.py — Audit trail builder for all scientific formulas.
"""
from __future__ import annotations

import math
from typing import Optional

from .climate_zone import ZoneClassification, detect_climate_archetype
from .mortality import _HEAT_BETA, _saturating_temp_excess, _AF_MAX
from .economics import compute_hybrid_economic_loss
from .wetbulb import _stull_wetbulb


def _build_audit_trail(
    pop: int,
    death_rate: float,
    hw_days: float,
    temp_excess: float,
    vuln: float,
    gdp: float,
    mean_temp: float,
    tx5d: float,
    rh: float,
    zone: Optional[ZoneClassification] = None,
    true_wbt: Optional[float] = None,
) -> dict:
    """Build a transparent, human-readable audit trail for all scientific formulas."""
    if zone is None:
        zone = detect_climate_archetype(mean_temp, rh, tx5d, true_wbt=true_wbt)

    beta = _HEAT_BETA
    dt_eff = _saturating_temp_excess(temp_excess)
    rr = math.exp(beta * dt_eff)
    af = round(min((rr - 1.0) / rr if rr > 1.0 else 0.0, _AF_MAX), 4)
    hwf = round(min(hw_days / 365.0, 1.0), 4)
    deaths_result = int(pop * (death_rate / 1000.0) * hwf * af * vuln)

    econ_loss = compute_hybrid_economic_loss(gdp, mean_temp, tx5d, hw_days)
    wbt_result = _stull_wetbulb(tx5d, rh, zone.zone)
    wbt_display = true_wbt if true_wbt is not None else wbt_result.wbt_celsius

    return {
        "climate_zone": {
            "detected_zone": zone.zone.value,
            "confidence": zone.confidence,
            "diagnostic_flags": list(zone.diagnostic_flags),
            "lethal_risk_days": zone.lethal_risk_days,
            "source": "Köppen-Geiger inspired self-diagnosis from ERA5 signatures",
        },
        "mortality": {
            "formula": "Deaths = Pop × (DR/1000) × (HW/365) × AF × V",
            "variables": {
                "Pop": pop,
                "DR": round(death_rate, 2),
                "HW": round(hw_days, 1),
                "AF": af,
                "V": round(vuln, 3),
                "beta": beta,
                "RR": round(rr, 4),
                "temp_excess_c": round(temp_excess, 2),
                "temp_excess_effective_c": round(dt_eff, 2),
                "AF_cap": _AF_MAX,
            },
            "computation": (
                f"{deaths_result:,} = {pop:,} × ({death_rate:.2f}/1000) × "
                f"({hw_days:.0f}/365) × {af} × {vuln:.3f}"
            ),
            "result": deaths_result,
            "source": (
                "Gasparrini et al. (2017), Lancet Planetary Health — "
                "saturating exposure-response (ΔT asymptote 6°C, AF cap 0.35)"
            ),
        },
        "economics": {
            "formula": "Hybrid Bipartite Model (Burke Baseline + ILO Extreme Shocks)",
            "zone_adjustment": zone.zone.value,
            "variables": {
                "GDP": round(gdp),
                "T_mean": round(mean_temp, 2),
                "Tx5d": round(tx5d, 2),
                "HW_days": round(hw_days, 1),
            },
            "adjustment_notes": [
                "Burke (2018) applied to standard operational days",
                "ILO Heat Stress guidelines applied to days exceeding 34.0°C"
            ],
            "computation": (
                f"${econ_loss / 1e6:.1f}M = Baseline Allocation + Extreme Shock Allocation"
            ),
            "result": round(econ_loss),
            "source": "Burke et al. (2018), Nature & ILO Heat Stress Standards",
        },
        "wetbulb": {
            "formula": "WBT = Stull (2011) pure empirical equation",
            "variables": {
                "T": round(tx5d, 2),
                "RH": round(rh, 1),
                "survivability_cap": "35.0°C (Sherwood & Huber 2010)",
            },
            "result": round(wbt_display, 2),
            "capped": wbt_display >= 35.0,
            "theoretical_uncapped": wbt_result.theoretical_uncapped_wbt,
            "lethal_risk_flag": wbt_result.lethal_risk_flag,
            "source": (
                "ERA5 observed daily-max wet-bulb (P95) + CMIP6 warming delta; "
                "Stull (2011) empirical equation on co-occurring T/RH"
            ),
        },
    }
