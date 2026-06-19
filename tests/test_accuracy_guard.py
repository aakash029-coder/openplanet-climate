"""
tests/test_accuracy_guard.py — Offline unit tests for the runtime accuracy guard
(climate_engine/api/physics/accuracy_guard.py).

These prove the guard that runs on EVERY live request (any location on Earth)
catches/corrects the same defect classes the global harness checks — without any
network access.
"""
from __future__ import annotations

import math

from climate_engine.api.physics.accuracy_guard import verify_prediction


def _good_metrics() -> dict:
    return {
        "lat": 38.72, "lng": -9.14, "elevation_m": 7.0, "koppen_main": "C",
        "baseline_annual_mean_c": 17.0, "baseline_tx5d_c": 32.85, "baseline_hw_days": 17.9,
        "tx5d_2030_c": 32.9, "tx5d_2050_c": 33.6, "hw_2030": 18.0, "hw_2050": 33.0,
        "wbt_proj_c": 24.8, "dry_bulb_2050_c": 33.6,
        "population": 2_800_000, "metro_gdp_usd": 103e9, "national_gdp_usd": 313e9,
    }


def test_clean_prediction_verified():
    m, r = verify_prediction(_good_metrics())
    rep = r.to_dict()
    assert rep["status"] == "verified"
    assert rep["checks_passed"] == rep["checks_total"]


def test_backwards_projection_is_corrected_not_shown():
    m = _good_metrics()
    m["tx5d_2050_c"] = 30.0  # below baseline 32.85 — the original Lisbon bug
    m["tx5d_2030_c"] = 31.0
    out, r = verify_prediction(m)
    assert out["tx5d_2050_c"] >= 32.85
    assert out["tx5d_2050_c"] >= out["tx5d_2030_c"]
    assert r.to_dict()["status"] == "corrected"


def test_wetbulb_above_drybulb_is_capped():
    m = _good_metrics()
    m["wbt_proj_c"] = 40.0  # impossible (above dry-bulb and 35°C)
    out, r = verify_prediction(m)
    assert out["wbt_proj_c"] <= out["dry_bulb_2050_c"]
    assert out["wbt_proj_c"] <= 35.0


def test_metro_gdp_capped_at_national():
    m = _good_metrics()
    m["metro_gdp_usd"] = 500e9  # exceeds national 313e9
    out, r = verify_prediction(m)
    assert out["metro_gdp_usd"] <= m["national_gdp_usd"] * 1.001


def test_null_island_degrades_and_withholds_location():
    m = _good_metrics()
    m["lat"], m["lng"] = 0.0, 0.0
    out, r = verify_prediction(m)
    rep = r.to_dict()
    assert rep["status"] == "degraded"
    assert "location" in rep["withheld"]


def test_nan_wetbulb_is_withheld_not_shown():
    m = _good_metrics()
    m["wbt_proj_c"] = float("nan")
    out, r = verify_prediction(m)
    assert out["wbt_proj_c"] is None
    assert "wet_bulb" in r.to_dict()["withheld"]


def test_implausible_elevation_withheld():
    m = _good_metrics()
    m["elevation_m"] = 9000.0  # above habitable max
    out, r = verify_prediction(m)
    assert out["elevation_m"] is None
    assert "elevation" in r.to_dict()["withheld"]


def test_excessive_warming_delta_withheld():
    m = _good_metrics()
    m["tx5d_2050_c"] = 45.0  # +12°C delta — physically implausible
    out, r = verify_prediction(m)
    rep = r.to_dict()
    assert rep["status"] == "degraded"
    assert "projection_2050" in rep["withheld"]


def test_high_altitude_temperature_flagged_not_withheld():
    # La Paz ~3640 m, ~9°C at low latitude — legitimately cool; advisory only.
    m = _good_metrics()
    m.update(lat=-16.5, lng=-68.15, elevation_m=3640.0, baseline_annual_mean_c=9.0)
    out, r = verify_prediction(m)
    rep = r.to_dict()
    assert rep["status"] in ("verified", "corrected")  # not degraded
    assert out["baseline_annual_mean_c"] == 9.0  # value preserved
