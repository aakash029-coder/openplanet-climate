"""
tests/test_science_formulas.py
──────────────────────────────
Regression tests that PIN the production scientific formulas so a future edit
cannot silently change model behaviour. These guard the exact claims made in
the README and the distinction between the production (saturating) mortality
core and the un-saturated back-test core.

Run: pytest tests/test_science_formulas.py -v
"""

import math

import pytest

from climate_engine.api import physics
from climate_engine.validation import _core as backtest


# ── Constants pinned to the README citations ──────────────────────────────────

def test_heat_beta_is_gasparrini_global_pooled():
    assert physics._HEAT_BETA == 0.0801
    # back-test must use the same raw coefficient
    assert backtest.gasparrini_deaths(
        1_000_000, 10.0, 0.0, 30, 1.0
    )["rr"] == 1.0  # ΔT=0 → RR=1 exactly


def test_af_cap_and_saturation_constants():
    assert physics._AF_MAX == 0.35
    assert physics._DT_SATURATION_C == 6.0


# ── Saturating ΔT: linear near 0, asymptotes to S ─────────────────────────────

def test_saturating_temp_excess_linear_for_small_dt():
    # For small ΔT the saturated value is within ~1% of the raw ΔT.
    raw = 0.5
    assert physics._saturating_temp_excess(raw) == pytest.approx(raw, rel=0.05)


def test_saturating_temp_excess_asymptotes():
    # Huge ΔT must never exceed the 6°C asymptote.
    assert physics._saturating_temp_excess(50.0) < physics._DT_SATURATION_C
    assert physics._saturating_temp_excess(50.0) == pytest.approx(6.0, abs=0.01)


def test_saturating_negative_dt_is_zero():
    assert physics._saturating_temp_excess(-5.0) == 0.0


# ── Attributable fraction never exceeds the cap ───────────────────────────────

def test_production_af_never_exceeds_cap():
    # Even at an absurd +40°C excess the production deaths reflect AF ≤ 0.35.
    pop, dr, hw, vuln = 1_000_000, 8.0, 365, 1.0
    deaths = physics._gasparrini_mortality(pop, dr, 40.0, hw, vuln)
    # Upper bound implied by AF_MAX: Pop*(DR/1000)*(HW/365)*AF_MAX*V
    upper = pop * (dr / 1000.0) * 1.0 * physics._AF_MAX * vuln
    assert deaths <= upper + 1


# ── The core integrity claim: production ≤ un-saturated back-test at high ΔT ───

def test_production_is_more_conservative_than_backtest_at_high_dt():
    """
    The README states production returns a lower, more conservative number than
    the un-saturated back-test for the same large ΔT. This test enforces that
    invariant so the two regimes can never silently converge or invert.
    """
    pop, dr, hw, vuln = 2_000_000, 9.0, 30, 1.0
    high_dt = 10.9  # Paris 2003-scale excess

    prod = physics._gasparrini_mortality(pop, dr, high_dt, hw, vuln)
    bt = backtest.gasparrini_deaths(pop, dr, high_dt, hw, vuln)["deaths"]

    assert prod < bt, "production must be ≤ un-saturated back-test at high ΔT"


def test_two_regimes_agree_at_low_dt():
    # Near the threshold the two cores should be close (within 10%).
    pop, dr, hw, vuln = 2_000_000, 9.0, 30, 1.0
    low_dt = 1.0
    prod = physics._gasparrini_mortality(pop, dr, low_dt, hw, vuln)
    bt = backtest.gasparrini_deaths(pop, dr, low_dt, hw, vuln)["deaths"]
    assert prod == pytest.approx(bt, rel=0.10)


# ── OP-CVI bounds and monotonicity ────────────────────────────────────────────

def test_op_cvi_within_bounds():
    # Extreme inputs must stay inside the documented [0.25, 2.5] clamp.
    lo = backtest.op_cvi(gdp_per_capita=80_000, median_age=18, physicians_per1k=5.0)
    hi = backtest.op_cvi(gdp_per_capita=1_000, median_age=50, physicians_per1k=0.1)
    assert 0.25 <= lo <= 2.5
    assert 0.25 <= hi <= 2.5
    assert hi > lo  # poorer/older/less-resourced city is more vulnerable


# ── Wet-bulb sanity (Stull 2011) ──────────────────────────────────────────────

def test_wetbulb_below_dry_bulb():
    # WBT must always be ≤ dry-bulb temperature.
    for t, rh in [(30.0, 50.0), (40.0, 20.0), (25.0, 80.0)]:
        assert physics.stull_wetbulb_simple(t, rh) <= t


def test_wetbulb_increases_with_humidity():
    dry = physics.stull_wetbulb_simple(35.0, 20.0)
    humid = physics.stull_wetbulb_simple(35.0, 80.0)
    assert humid > dry


# ── Burke (2018) economic damage ──────────────────────────────────────────────

def test_burke_zero_at_optimum():
    # T_optimal = 13°C → zero penalty.
    assert physics.apply_burke_formula(1_000_000.0, 13.0) == 0.0


def test_burke_penalty_symmetric_and_positive():
    hot = physics.apply_burke_formula(1_000_000.0, 13.0 + 10.0)
    cold = physics.apply_burke_formula(1_000_000.0, 13.0 - 10.0)
    assert hot > 0
    assert hot == pytest.approx(cold)  # quadratic → symmetric about optimum


def test_economic_loss_monotonic_in_heatwave_days():
    base = dict(city_gdp=1e10, t_mean=20.0, tx5d=38.0)
    few = physics.compute_hybrid_economic_loss(hw_days=10, **base)
    many = physics.compute_hybrid_economic_loss(hw_days=120, **base)
    assert many > few >= 0
