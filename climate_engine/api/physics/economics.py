"""
climate_engine/api/physics/economics.py — Burke (2018) + ILO economic damage model.
"""
from __future__ import annotations


def apply_burke_formula(gdp_share: float, t_mean: float) -> float:
    """
    Simplified Burke (2018) macroeconomic damage function.
    Optimum annual temperature is ~13C. Non-linear penalty scales identically
    as T_mean deviates from optimal.
    """
    temp_diff = t_mean - 13.0
    penalty_pct = max(0.0, 0.0127 * (temp_diff ** 2)) / 100.0
    return gdp_share * penalty_pct


def compute_hybrid_economic_loss(
    city_gdp: float,
    t_mean: float,
    tx5d: float,
    hw_days: float,
) -> float:
    """
    Resolves economic damages using a bipartite modeling approach:
    1. Baseline: Burke (2018) macro-economic function for standard operational days.
    2. Shocks: ILO Heat Stress damage limits for days reaching extreme physiological thresholds.
    """
    total_days = 365
    hw_days_capped = min(365.0, max(0.0, float(hw_days)))
    normal_days = total_days - hw_days_capped

    # 1. Baseline standard operation allocation
    normal_economy_share = (normal_days / total_days) * city_gdp
    baseline_loss = apply_burke_formula(normal_economy_share, t_mean)

    # 2. Extreme event operational allocation
    extreme_economy_share = (hw_days_capped / total_days) * city_gdp

    # ILO limits logic: Non-linear labor constraint past 34C
    if tx5d > 34.0:
        heat_penalty_pct = (tx5d - 34.0) * 0.015  # 1.5% economic shock per degree over physiological limit
        extreme_loss = extreme_economy_share * heat_penalty_pct
    else:
        extreme_loss = apply_burke_formula(extreme_economy_share, t_mean)

    return baseline_loss + extreme_loss
