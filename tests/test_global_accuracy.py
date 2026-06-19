"""
tests/test_global_accuracy.py — Global accuracy harness (§6).

Validates the OpenPlanet engine for a reference panel of cities spanning every
climate extreme, comparing each output field to a cited reputable reference
within a stated tolerance, and asserting structural invariants that catch the
known defect classes (backwards projection, null-island, inflated GDP,
non-coincident wet-bulb, mis-classified Köppen).

Run modes
---------
Default (fast, offline, deterministic):
    pytest tests/test_global_accuracy.py
  Asserts the committed fixture (tests/fixtures/engine_outputs.json) — recorded
  from live ERA5/CMIP6/World Bank/DEM APIs — against the references. This is the
  CI gate; it never touches the network, so the build cannot flake on upstream
  rate limits.

Live (re-validate against live APIs):
    pytest tests/test_global_accuracy.py -m live --run-live
  Recomputes each city from live APIs and asserts the same references/invariants.

Regenerate the fixture with:  python tests/generate_fixtures.py
"""
from __future__ import annotations

import asyncio
import json
import math
import os

import pytest

HERE = os.path.dirname(__file__)
REF_PATH = os.path.join(HERE, "reference_cities.json")
FIXTURE_PATH = os.path.join(HERE, "fixtures", "engine_outputs.json")

with open(REF_PATH, encoding="utf-8") as _fh:
    _REF = json.load(_fh)
CITIES = _REF["cities"]
TOL = _REF["_meta"]["tolerances"]

# Per-field tolerances (documented in reference_cities.json _meta.tolerances).
COORD_TOL_DEG = 0.75
TEMP_TOL_C = 2.6
ELEV_ABS_M = 60.0
ELEV_PCT = 0.12
POP_BAND = (0.5, 1.8)
# Primate/capital metros in unequal economies legitimately run well above national
# nominal GDP/capita (Delhi, Cairo, London ≈ 1.3–1.7×); the hard metro ≤ national
# cap still bounds the top. Lower bound guards against gross under-scaling.
GDP_PC_BAND = (0.5, 2.0)


# ── Fixture / live data access ─────────────────────────────────────────────────

def _load_fixture() -> dict:
    if not os.path.exists(FIXTURE_PATH):
        pytest.skip(
            "Fixture missing — run `python tests/generate_fixtures.py` to record "
            "engine outputs from live APIs."
        )
    with open(FIXTURE_PATH, encoding="utf-8") as fh:
        return json.load(fh)


_FIXTURE = _load_fixture() if os.path.exists(FIXTURE_PATH) else {}


def _engine_output(request, city: dict) -> dict:
    """Return engine output for a city — from fixture (default) or live."""
    name = city["name"]
    if request.config.getoption("--run-live"):
        from tests._engine_probe import compute_city
        return asyncio.run(compute_city(city["query"]))
    data = _FIXTURE.get(name)
    if not data:
        pytest.skip(f"No fixture entry for {name}; regenerate the fixture.")
    if not data.get("_ok", False):
        pytest.fail(f"Engine failed to compute {name}: {data.get('_error')}")
    return data


def _ids(cities):
    return [c["name"] for c in cities]


# ── Per-field accuracy vs references ───────────────────────────────────────────

@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_coordinate_not_null_island_and_near_reference(request, city):
    out = _engine_output(request, city)
    lat, lng = out["lat"], out["lng"]
    assert not (abs(lat) < 0.01 and abs(lng) < 0.01), f"{city['name']}: null-island (0,0) leak"
    dlat = abs(lat - city["ref_lat"])
    # Longitude wrap tolerance near the antimeridian (e.g. Funafuti ~179.2E).
    dlng = abs(lng - city["ref_lon"])
    dlng = min(dlng, 360.0 - dlng)
    assert dlat <= COORD_TOL_DEG and dlng <= COORD_TOL_DEG, (
        f"{city['name']}: resolved ({lat:.3f},{lng:.3f}) is "
        f"{dlat:.2f}°/{dlng:.2f}° from reference centre ({city['ref_lat']},{city['ref_lon']})"
    )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_elevation_within_tolerance(request, city):
    out = _engine_output(request, city)
    elev = out["elevation_m"]
    assert elev is not None and math.isfinite(elev)
    assert -450.0 <= elev <= 6000.0, f"{city['name']}: elevation {elev} m outside plausible global range"
    ref = city["ref_elevation_m"]
    tol = max(ELEV_ABS_M, ELEV_PCT * abs(ref))
    assert abs(elev - ref) <= tol, (
        f"{city['name']}: elevation {elev} m vs reference {ref} m (±{tol:.0f} m) "
        f"[source: {out.get('elevation_source')}]"
    )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_baseline_annual_mean_temp(request, city):
    out = _engine_output(request, city)
    t = out["baseline_annual_mean_c"]
    ref = city["ref_annual_mean_c"]
    tol = city.get("temp_tol_c", TEMP_TOL_C)  # per-city override for documented Arctic-amplification cases
    assert abs(t - ref) <= tol, (
        f"{city['name']}: baseline annual mean {t}°C vs reference {ref}°C (±{tol}°C)"
    )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_koppen_main_group(request, city):
    out = _engine_output(request, city)
    main = out["koppen_main"]
    accepted = set(city.get("koppen_alt_main", [city["koppen_main"]]))
    accepted.add(city["koppen_main"])
    assert main in accepted, (
        f"{city['name']}: Köppen {out['koppen_code']} (main '{main}') "
        f"not in accepted {sorted(accepted)} (anchor {city['koppen_anchor']})"
    )


@pytest.mark.parametrize("city", [c for c in CITIES if c.get("assert_population", True)],
                         ids=_ids([c for c in CITIES if c.get("assert_population", True)]))
def test_metro_population_band(request, city):
    out = _engine_output(request, city)
    pop = out["population"]
    ref = city["ref_metro_pop"]
    lo, hi = POP_BAND[0] * ref, POP_BAND[1] * ref
    assert lo <= pop <= hi, (
        f"{city['name']}: metro population {pop:,} outside [{lo:,.0f}, {hi:,.0f}] "
        f"(reference {ref:,})"
    )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_metro_gdp_scaling_and_national_cap(request, city):
    out = _engine_output(request, city)
    metro_gdp = out["metro_gdp_usd"]
    national = out["national_gdp_usd"]
    pop = out["population"]

    assert metro_gdp > 0 and math.isfinite(metro_gdp)
    # Hard invariant: metro GDP can never exceed national GDP.
    if national:
        assert metro_gdp <= national * 1.001, (
            f"{city['name']}: metro GDP ${metro_gdp/1e9:.1f}B exceeds national ${national/1e9:.1f}B"
        )
    # Implied metro GDP per capita within the documented band of national WDI —
    # only where the metro population itself is reliable (skip tiny places whose
    # census falls below the engine's 10k floor and defaults to a national figure).
    if city.get("assert_population", True):
        nat_pc = city["ref_national_gdp_pc_usd"]
        implied_pc = metro_gdp / pop if pop else 0.0
        lo, hi = GDP_PC_BAND[0] * nat_pc, GDP_PC_BAND[1] * nat_pc
        assert lo <= implied_pc <= hi, (
            f"{city['name']}: implied metro GDP/capita ${implied_pc:,.0f} outside "
            f"[${lo:,.0f}, ${hi:,.0f}] of national WDI ${nat_pc:,}"
        )


# ── Structural invariants (catch the defect classes without external data) ─────

@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_projection_monotonic_and_above_baseline(request, city):
    out = _engine_output(request, city)
    base = out["baseline_tx5d_c"]
    tx_2030 = out["projections"]["2030"]["tx5d_c"]
    tx_2050 = out["projections"]["2050"]["tx5d_c"]
    assert tx_2050 >= base, f"{city['name']}: Tx5d_2050 {tx_2050} < baseline {base} (backwards projection)"
    assert tx_2030 >= base, f"{city['name']}: Tx5d_2030 {tx_2030} < baseline {base}"
    assert tx_2050 >= tx_2030, f"{city['name']}: Tx5d_2050 {tx_2050} < Tx5d_2030 {tx_2030}"


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_heatwave_days_non_decreasing(request, city):
    out = _engine_output(request, city)
    base = out["baseline_hw_days"]
    hw_2030 = out["projections"]["2030"]["hw_days"]
    hw_2050 = out["projections"]["2050"]["hw_days"]
    assert hw_2030 >= base - 1e-6, f"{city['name']}: heatwave days 2030 {hw_2030} < baseline {base}"
    assert hw_2050 >= hw_2030 - 1e-6, f"{city['name']}: heatwave days 2050 {hw_2050} < 2030 {hw_2030}"


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_warming_delta_within_ipcc_plausible_bounds(request, city):
    out = _engine_output(request, city)
    delta = out["projections"]["2050"]["tx5d_c"] - out["baseline_tx5d_c"]
    assert 0.0 <= delta <= 6.0, (
        f"{city['name']}: 2050 warming delta {delta:.2f}°C outside IPCC-plausible [0, 6]°C"
    )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_wetbulb_below_drybulb_and_survivability(request, city):
    out = _engine_output(request, city)
    wbt = out["wbt_proj_c"]
    dry = out["projections"]["2050"]["tx5d_c"]
    assert wbt <= dry + 1e-6, f"{city['name']}: wet-bulb {wbt} > dry-bulb {dry}"
    assert wbt <= 35.0 + 1e-6, f"{city['name']}: wet-bulb {wbt} exceeds 35°C survivability cap"


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_no_nan_or_none_in_outputs(request, city):
    out = _engine_output(request, city)
    numeric_fields = [
        out["lat"], out["lng"], out["elevation_m"],
        out["baseline_annual_mean_c"], out["baseline_p95_c"], out["baseline_tx5d_c"],
        out["baseline_hw_days"], out["wbt_proj_c"], out["population"], out["metro_gdp_usd"],
        out["projections"]["2030"]["tx5d_c"], out["projections"]["2050"]["tx5d_c"],
        out["projections"]["2030"]["hw_days"], out["projections"]["2050"]["hw_days"],
    ]
    for v in numeric_fields:
        assert v is not None and isinstance(v, (int, float)) and math.isfinite(v), (
            f"{city['name']}: non-finite/None value in outputs: {v}"
        )


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_runtime_guard_does_not_degrade(request, city):
    """The runtime accuracy guard must verify (or only correct) every real city —
    never withhold data for a legitimate location on the reference panel."""
    from climate_engine.api.physics.accuracy_guard import verify_prediction
    out = _engine_output(request, city)
    _, report = verify_prediction({
        "lat": out["lat"], "lng": out["lng"], "elevation_m": out["elevation_m"],
        "koppen_main": out["koppen_main"],
        "baseline_annual_mean_c": out["baseline_annual_mean_c"],
        "baseline_tx5d_c": out["baseline_tx5d_c"],
        "baseline_hw_days": out["baseline_hw_days"],
        "tx5d_2030_c": out["projections"]["2030"]["tx5d_c"],
        "tx5d_2050_c": out["projections"]["2050"]["tx5d_c"],
        "hw_2030": out["projections"]["2030"]["hw_days"],
        "hw_2050": out["projections"]["2050"]["hw_days"],
        "wbt_proj_c": out["wbt_proj_c"], "dry_bulb_2050_c": out["projections"]["2050"]["tx5d_c"],
        "population": out["population"], "metro_gdp_usd": out["metro_gdp_usd"],
        "national_gdp_usd": out["national_gdp_usd"],
    })
    rep = report.to_dict()
    assert rep["status"] != "degraded", f"{city['name']}: guard withheld {rep['withheld']}"


@pytest.mark.parametrize("city", CITIES, ids=_ids(CITIES))
def test_koppen_classification_source_is_authoritative(request, city):
    """Köppen must come from ERA5 monthly normals, not the heuristic fallback."""
    out = _engine_output(request, city)
    assert out["koppen_source"] == "era5_monthly_normals", (
        f"{city['name']}: Köppen fell back to {out['koppen_source']} (expected era5_monthly_normals)"
    )
