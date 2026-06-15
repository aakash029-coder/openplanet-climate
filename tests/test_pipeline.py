"""
Offline tests for deterministic pipeline helpers (no network).

Replaces an obsolete test that imported a removed `ConfigManager`. These cover
the pure, side-effect-free parts of the physics pipeline: climate-zone
detection, H3 spatial helpers, and the country-code map.
"""

import h3

from climate_engine.api.physics import (
    ClimateZone,
    ISO3_MAP,
    _H3_CELL_AREA_KM2,
    _cap_hexagons,
    _estimate_polygon_area_km2,
    detect_climate_archetype,
)


# ── Climate-zone archetype detection ──────────────────────────────────────────

def test_permafrost_zone_detected():
    # Cold mean, cold summer peak → permafrost.
    z = detect_climate_archetype(mean_temp=-10.0, p95_rh=78.0, tx5d=20.0)
    assert z.zone == ClimateZone.PERMAFROST


def test_hyper_arid_zone_detected():
    # Dry air + very hot peak → hyper-arid desert.
    z = detect_climate_archetype(mean_temp=28.0, p95_rh=20.0, tx5d=46.0)
    assert z.zone == ClimateZone.HYPER_ARID


def test_lethal_humid_zone_detected():
    # Supply a high co-occurring wet-bulb directly to trigger the lethal branch.
    z = detect_climate_archetype(mean_temp=30.0, p95_rh=75.0, tx5d=38.0, true_wbt=32.0)
    assert z.zone == ClimateZone.LETHAL_HUMID
    assert z.lethal_risk_days is not None


def test_standard_zone_is_default():
    z = detect_climate_archetype(mean_temp=15.0, p95_rh=65.0, tx5d=26.0)
    assert z.zone == ClimateZone.STANDARD


def test_zone_confidence_in_range():
    z = detect_climate_archetype(mean_temp=15.0, p95_rh=65.0, tx5d=26.0)
    assert 0.0 <= z.confidence <= 1.0


# ── H3 spatial helpers ────────────────────────────────────────────────────────

def test_h3_res9_cell_area_matches_canonical_spec():
    # README quotes ≈ 0.1053 km² for H3 resolution 9.
    assert _H3_CELL_AREA_KM2[9] == 0.1053


def test_cap_hexagons_enforces_limit_deterministically():
    center = h3.latlng_to_cell(28.61, 77.21, 9)  # Delhi
    big = list(h3.grid_disk(center, 40))
    capped = _cap_hexagons(big, cap=500)
    assert len(capped) <= 500
    # Deterministic: same input → same output.
    assert capped == _cap_hexagons(list(h3.grid_disk(center, 40)), cap=500)


def test_cap_hexagons_noop_under_cap():
    small = ["a", "b", "c"]
    assert _cap_hexagons(small, cap=100) == small


def test_polygon_area_positive():
    # ~1° box near the equator should be on the order of 1e4 km².
    box = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
    area = _estimate_polygon_area_km2(box)
    assert area > 0


# ── Country-code map sanity ───────────────────────────────────────────────────

def test_iso3_map_known_entries():
    assert ISO3_MAP["IN"] == "IND"
    assert ISO3_MAP["US"] == "USA"
    assert ISO3_MAP["GB"] == "GBR"
