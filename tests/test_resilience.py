"""
tests/test_resilience.py — Offline tests for the never-fail fallback tiers that
guarantee the engine serves every location on Earth (no network required).
"""
from __future__ import annotations

import pytest

from climate_engine.services.cmip6_service import _ipcc_deterministic_projection
from climate_engine.api.physics.koppen import _latitude_only_macro
from climate_engine.services.socioeconomic.population import validate_census_data


def test_census_cap_accepts_greater_tokyo():
    # Greater Tokyo (~37.7M) is the world's largest metro and must be accepted;
    # the previous 35M cap wrongly rejected it and defaulted to a tiny figure.
    assert validate_census_data(37_700_000, "Tokyo")
    assert validate_census_data(35_676_000, "Tokyo metro")
    assert not validate_census_data(41_000_000, "bad")   # implausibly large
    assert not validate_census_data(4_749, "tiny")        # below 10k floor

_BASELINE = {"tx5d_baseline_c": 33.0, "hw_days_baseline": 18.0, "annual_mean_c": 17.0}


@pytest.mark.parametrize("ssp", ["ssp126", "ssp245", "ssp370", "ssp585"])
def test_ipcc_fallback_projection_satisfies_invariants(ssp):
    p2030 = _ipcc_deterministic_projection(_BASELINE, ssp, 2030, 1.3, 0.0)
    p2050 = _ipcc_deterministic_projection(_BASELINE, ssp, 2050, 1.3, 0.0)
    base = _BASELINE["tx5d_baseline_c"]
    # Never below baseline, monotonic, within IPCC-plausible bounds.
    assert p2030["tx5d_c"] >= base
    assert p2050["tx5d_c"] >= p2030["tx5d_c"] >= base
    assert 0.0 <= (p2050["tx5d_c"] - base) <= 6.0
    assert p2050["hw_days"] >= p2030["hw_days"] >= _BASELINE["hw_days_baseline"]
    assert p2050["source"] == "ipcc_ar6_deterministic_fallback"


def test_ipcc_fallback_higher_emissions_warm_more():
    low = _ipcc_deterministic_projection(_BASELINE, "ssp126", 2050, 1.0, 0.0)["tx5d_c"]
    high = _ipcc_deterministic_projection(_BASELINE, "ssp585", 2050, 1.0, 0.0)["tx5d_c"]
    assert high > low


@pytest.mark.parametrize("lat,expected_group", [
    (78.0, "E"), (60.0, "D"), (45.0, "D"), (38.0, "C"), (25.0, "C"), (5.0, "A"),
])
def test_latitude_only_macro_never_fails(lat, expected_group):
    macro = _latitude_only_macro(lat)
    assert macro.koppen_class.value[0] == expected_group
