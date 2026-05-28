"""
climate_engine/validation/_core.py
────────────────────────────────────
Shared formula layer for all back-test scripts.
Exact mirrors of the production functions in socioeconomic_service.py
and physics.py — never modified to fit observed data.
"""

from __future__ import annotations
import math
from dataclasses import dataclass


@dataclass
class BacktestResult:
    event_name:     str
    scope:          str
    duration_days:  int
    temp_excess_c:  float
    op_cvi:         float
    rr:             float
    af:             float
    deaths:         int
    deaths_lo:      int   # −15% sensitivity bound
    deaths_hi:      int   # +15% sensitivity bound
    observed:       int
    observed_label: str
    error_pct:      float


def op_cvi(gdp_per_capita: float, median_age: float, physicians_per1k: float) -> float:
    """
    OpenPlanet Composite Vulnerability Index.
    Exact replica of socioeconomic_service.compute_vulnerability_multiplier().
    """
    if gdp_per_capita > 40_000:      ac = 0.35
    elif gdp_per_capita > 20_000:    ac = 0.55
    elif gdp_per_capita > 8_000:     ac = 0.75
    elif gdp_per_capita > 3_000:     ac = 1.10
    else:                            ac = 1.50

    if median_age > 45:              age = 1.60
    elif median_age > 38:            age = 1.25
    elif median_age > 28:            age = 1.00
    elif median_age > 20:            age = 0.85
    else:                            age = 0.70

    if physicians_per1k > 4.0:       health = 0.70
    elif physicians_per1k > 2.5:     health = 0.85
    elif physicians_per1k > 1.0:     health = 1.00
    elif physicians_per1k > 0.3:     health = 1.25
    else:                            health = 1.50

    return round(max(0.25, min(2.5, (ac * age * health) ** (1 / 3))), 3)


def gasparrini_deaths(
    population:  int,
    death_rate:  float,   # per 1,000 / year
    temp_excess: float,   # °C above P95 threshold
    hw_days:     int,
    vuln:        float,
) -> dict:
    """
    Gasparrini et al. (2017) heat-attributable mortality formula.
    Exact replica of physics._gasparrini_mortality().
    β = 0.0801 (global pooled meta-analysis coefficient).
    """
    beta = 0.0801
    rr   = math.exp(beta * max(0.0, temp_excess))
    af   = (rr - 1) / rr
    hwf  = hw_days / 365.0
    d    = population * (death_rate / 1_000) * hwf * af * vuln
    return {
        "deaths": round(d),
        "rr":     round(rr, 4),
        "af":     round(af, 4),
        "lo":     round(d * 0.85),
        "hi":     round(d * 1.15),
    }


def run_backtest(
    event_name:     str,
    scope:          str,
    population:     int,
    death_rate:     float,
    p95_baseline_c: float,
    tx5d_peak_c:    float,
    hw_days:        int,
    gdp_per_capita: float,
    physicians_per1k: float,
    median_age:     float,
    observed:       int,
    observed_label: str,
    notes:          list[str] | None = None,
    print_report:   bool = True,
) -> BacktestResult:
    temp_excess = tx5d_peak_c - p95_baseline_c
    vuln        = op_cvi(gdp_per_capita, median_age, physicians_per1k)
    r           = gasparrini_deaths(population, death_rate, temp_excess, hw_days, vuln)
    error_pct   = (r["deaths"] / observed - 1) * 100

    result = BacktestResult(
        event_name     = event_name,
        scope          = scope,
        duration_days  = hw_days,
        temp_excess_c  = round(temp_excess, 1),
        op_cvi         = vuln,
        rr             = r["rr"],
        af             = r["af"],
        deaths         = r["deaths"],
        deaths_lo      = r["lo"],
        deaths_hi      = r["hi"],
        observed       = observed,
        observed_label = observed_label,
        error_pct      = round(error_pct, 1),
    )

    if print_report:
        _print_report(result, p95_baseline_c, tx5d_peak_c, notes or [])

    return result


def _print_report(r: BacktestResult, p95: float, tx5d: float, notes: list[str]) -> None:
    w = 62
    print("=" * w)
    print(f"OpenPlanet Back-Test — {r.event_name}")
    print("=" * w)
    print(f"  Scope               : {r.scope}")
    print(f"  Temperature excess  : +{r.temp_excess_c} °C  ({p95} → {tx5d} °C Tx5d)")
    print(f"  Duration            : {r.duration_days} days")
    print(f"  OP-CVI              : {r.op_cvi}")
    print(f"  RR (β=0.0801)       : {r.rr}")
    print(f"  Attributable frac.  : {r.af}")
    print()
    print(f"  ── Model output {'─'*26}")
    print(f"  Point estimate      : {r.deaths:,}")
    print(f"  Sensitivity (±15%)  : {r.deaths_lo:,} – {r.deaths_hi:,}")
    print()
    print(f"  ── Observed {'─'*30}")
    print(f"  Deaths              : ~{r.observed:,}")
    print(f"  Source              : {r.observed_label}")
    print()
    print(f"  ── Assessment {'─'*28}")
    direction = "undershoots" if r.error_pct < 0 else "overshoots"
    print(f"  Model error         : {r.error_pct:+.1f}%  ({direction})")
    in_range = r.deaths_lo <= r.observed <= r.deaths_hi
    print(f"  Obs within ±15%     : {'YES' if in_range else 'NO'}")
    if notes:
        print()
        print("  Limiting factors:")
        for i, n in enumerate(notes, 1):
            print(f"  {i}. {n}")
    print("=" * w)
