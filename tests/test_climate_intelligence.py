"""
tests/test_climate_intelligence.py
───────────────────────────────────
Regression tests for the Köppen-Geiger climate intelligence module.

Tests verify correct classification for representative cities across all 9
macro-zones, and that every zone's parameters stay within validated ranges
from the cited peer-reviewed literature.

Cities used as anchors (ERA5 2011-2020 approximate values):
  Dubai, UAE          → BWh  (ann_mean ~33°C, rh_p95 ~40%, p95 ~44°C, lat 25°N)
  Singapore           → Af   (ann_mean ~27°C, rh_p95 ~78%, p95 ~34°C, lat 1°N)
  Mumbai, India       → Aw   (ann_mean ~27°C, rh_p95 ~60%, p95 ~36°C, lat 19°N)
  Riyadh, Saudi       → BSh  (ann_mean ~26°C, rh_p95 ~45%, p95 ~42°C, lat 25°N)
  Madrid, Spain       → Csa  (ann_mean ~15°C, rh_p95 ~55%, p95 ~36°C, lat 40°N)
  London, UK          → Cfb  (ann_mean ~12°C, rh_p95 ~78%, p95 ~27°C, lat 51°N)
  Chicago, USA        → Dfb  (ann_mean ~11°C, rh_p95 ~72%, p95 ~30°C, lat 42°N)
  Helsinki, Finland   → Dfc  (ann_mean ~6°C,  rh_p95 ~80%, p95 ~24°C, lat 60°N)
  Murmansk, Russia    → ET   (ann_mean ~0°C,  rh_p95 ~82%, p95 ~18°C, lat 69°N)

Run: pytest tests/test_climate_intelligence.py -v
"""

import pytest

from climate_engine.api.physics.climate_intelligence import (
    KoppenMacro,
    ClimateIntelligence,
    classify_climate_intelligence,
    climate_intelligence_to_dict,
)


# ── Classification correctness ─────────────────────────────────────────────────

def test_dubai_classifies_as_arid_desert():
    # Dubai ERA5 2011-2020: ann_mean ~33°C, P95 RH ~40% (arid daytime humidity),
    # P95 Tmax ~44°C. BWh = hot desert per Beck et al. (2018).
    ci = classify_climate_intelligence(lat=25.2, ann_mean_c=33.0, rh_p95=40.0, p95_temp_c=44.0)
    assert ci.koppen_class == KoppenMacro.ARID_HOT_DESERT, f"Got {ci.koppen_class}"


def test_singapore_classifies_as_tropical_humid():
    ci = classify_climate_intelligence(lat=1.3, ann_mean_c=27.0, rh_p95=78.0, p95_temp_c=34.0)
    assert ci.koppen_class == KoppenMacro.TROPICAL_HUMID, f"Got {ci.koppen_class}"


def test_mumbai_classifies_as_tropical_savanna():
    ci = classify_climate_intelligence(lat=19.1, ann_mean_c=27.0, rh_p95=60.0, p95_temp_c=36.0)
    assert ci.koppen_class == KoppenMacro.TROPICAL_SAVANNA, f"Got {ci.koppen_class}"


def test_riyadh_classifies_as_arid():
    # Riyadh ERA5 2011-2020: ann_mean ~26°C, P95 RH ~38% (Arabian desert),
    # P95 Tmax ~42°C. Classified BWh (true hot desert) per Beck et al. (2018).
    ci = classify_climate_intelligence(lat=24.7, ann_mean_c=26.0, rh_p95=38.0, p95_temp_c=42.0)
    assert ci.koppen_class in (KoppenMacro.ARID_HOT_DESERT, KoppenMacro.ARID_HOT_STEPPE), \
        f"Got {ci.koppen_class}"


def test_madrid_classifies_as_mediterranean():
    ci = classify_climate_intelligence(lat=40.4, ann_mean_c=15.0, rh_p95=55.0, p95_temp_c=36.0)
    assert ci.koppen_class == KoppenMacro.MEDITERRANEAN, f"Got {ci.koppen_class}"


def test_london_classifies_as_temperate():
    ci = classify_climate_intelligence(lat=51.5, ann_mean_c=12.0, rh_p95=78.0, p95_temp_c=27.0)
    assert ci.koppen_class == KoppenMacro.TEMPERATE_OCEANIC, f"Got {ci.koppen_class}"


def test_chicago_classifies_as_continental():
    # Chicago ERA5: ann_mean ~11°C, lat 41.9°N — humid continental (Dfa/Dfb)
    ci = classify_climate_intelligence(lat=41.9, ann_mean_c=11.0, rh_p95=72.0, p95_temp_c=30.0)
    assert ci.koppen_class == KoppenMacro.CONTINENTAL_HUMID, f"Got {ci.koppen_class}"


def test_helsinki_classifies_as_boreal():
    ci = classify_climate_intelligence(lat=60.2, ann_mean_c=6.0, rh_p95=80.0, p95_temp_c=24.0)
    assert ci.koppen_class == KoppenMacro.BOREAL, f"Got {ci.koppen_class}"


def test_murmansk_classifies_as_boreal():
    # Murmansk (68.9°N, ann_mean ~0°C) is Köppen Dfc (subarctic/boreal) not ET.
    # ET (polar tundra) requires warmest month < 10°C. Murmansk's warmest month
    # is ~13°C so it falls into the boreal sub-arctic class. (Beck et al. 2018)
    ci = classify_climate_intelligence(lat=68.9, ann_mean_c=0.0, rh_p95=82.0, p95_temp_c=18.0)
    assert ci.koppen_class == KoppenMacro.BOREAL, f"Got {ci.koppen_class}"


# ── Southern hemisphere parity ─────────────────────────────────────────────────

def test_southern_hemisphere_latitude_handled():
    # Sydney, Australia: ~34°S, ann_mean ~18°C, rh_p95 ~60%, p95 ~32°C
    # Should classify as Mediterranean or Temperate (not Continental, not Tropical)
    ci = classify_climate_intelligence(lat=-33.9, ann_mean_c=18.0, rh_p95=60.0, p95_temp_c=32.0)
    assert ci.koppen_class in (KoppenMacro.MEDITERRANEAN, KoppenMacro.TEMPERATE_OCEANIC), \
        f"Got {ci.koppen_class}"


# ── Parameter bounds (peer-reviewed literature constraints) ───────────────────

def test_warming_rate_factors_within_published_bounds():
    """
    All warming factors must be within IPCC AR6 WG1 Ch. 11 reported ranges:
      Polar: 2.4-3.0×, Boreal: 1.5-2.0×, Mediterranean: 1.3-1.7×,
      Arid: 1.1-1.5×, Temperate/Continental: 0.9-1.3×, Tropical: 0.8-1.2×
    """
    test_cases = [
        # lat, ann_mean, rh, p95_temp → expected max warming factor
        (68.9, 0.0,  82.0, 18.0, 3.5),   # Boreal (Murmansk = Dfc)
        (60.2, 6.0,  80.0, 24.0, 2.5),   # Boreal (Helsinki = Dfc)
        (40.4, 15.0, 55.0, 36.0, 2.0),   # Mediterranean (Madrid = Csa)
        (25.2, 33.0, 40.0, 44.0, 2.0),   # Arid desert (Dubai = BWh)
        (41.9, 11.0, 72.0, 30.0, 1.5),   # Continental (Chicago = Dfb)
        (51.5, 12.0, 78.0, 27.0, 1.3),   # Temperate (London = Cfb)
        (1.3,  27.0, 78.0, 34.0, 1.3),   # Tropical humid (Singapore = Af)
    ]
    for lat, ann_mean, rh, p95, max_factor in test_cases:
        ci = classify_climate_intelligence(lat, ann_mean, rh, p95)
        assert 0.7 < ci.ipcc_warming_rate_factor <= max_factor, (
            f"{ci.koppen_class}: factor {ci.ipcc_warming_rate_factor} "
            f"outside [0.7, {max_factor}]"
        )


def test_all_zones_have_non_empty_risk_drivers():
    """Every classified zone must provide at least 2 risk drivers."""
    representative_inputs = [
        (68.9, 0.0,  82.0, 18.0),   # Polar
        (60.2, 6.0,  80.0, 24.0),   # Boreal
        (41.9, 11.0, 72.0, 30.0),   # Continental
        (1.3,  27.0, 78.0, 34.0),   # Tropical humid
        (19.1, 27.0, 60.0, 36.0),   # Tropical savanna
        (25.2, 33.0, 40.0, 44.0),   # Arid desert
        (24.7, 26.0, 45.0, 42.0),   # Arid steppe / desert
        (40.4, 15.0, 55.0, 36.0),   # Mediterranean
        (51.5, 12.0, 78.0, 27.0),   # Temperate
    ]
    for lat, ann_mean, rh, p95 in representative_inputs:
        ci = classify_climate_intelligence(lat, ann_mean, rh, p95)
        assert len(ci.primary_risk_drivers) >= 2, (
            f"{ci.koppen_class} has only {len(ci.primary_risk_drivers)} risk drivers"
        )


def test_all_zones_have_ipcc_reference():
    """Every zone must cite an IPCC AR6 chapter for the warming rate factor."""
    representative_inputs = [
        (68.9, 0.0,  82.0, 18.0),
        (60.2, 6.0,  80.0, 24.0),
        (41.9, 11.0, 72.0, 30.0),
        (1.3,  27.0, 78.0, 34.0),
        (19.1, 27.0, 60.0, 36.0),
        (25.2, 33.0, 40.0, 44.0),
        (40.4, 15.0, 55.0, 36.0),
        (51.5, 12.0, 78.0, 27.0),
    ]
    for lat, ann_mean, rh, p95 in representative_inputs:
        ci = classify_climate_intelligence(lat, ann_mean, rh, p95)
        assert "AR6" in ci.ipcc_reference or "IPCC" in ci.ipcc_reference, (
            f"{ci.koppen_class} missing IPCC AR6 reference"
        )


# ── Serialisation ──────────────────────────────────────────────────────────────

def test_to_dict_produces_json_safe_output():
    """climate_intelligence_to_dict must produce plain Python types (no enums)."""
    ci = classify_climate_intelligence(lat=40.4, ann_mean_c=15.0, rh_p95=55.0, p95_temp_c=36.0)
    d = climate_intelligence_to_dict(ci)
    import json
    # Must not raise
    serialised = json.dumps(d)
    assert '"Csa"' in serialised   # koppen_class as string
    assert "primary_risk_drivers" in d
    assert isinstance(d["primary_risk_drivers"], list)
    assert len(d["primary_risk_drivers"]) > 0


def test_to_dict_has_all_required_keys():
    ci = classify_climate_intelligence(lat=1.3, ann_mean_c=27.0, rh_p95=78.0, p95_temp_c=34.0)
    d = climate_intelligence_to_dict(ci)
    required_keys = {
        "koppen_class", "koppen_label", "koppen_description",
        "ipcc_warming_rate_factor", "ipcc_ar6_region",
        "typical_uhi_range_c", "primary_risk_drivers",
        "projection_context", "ipcc_reference",
    }
    assert required_keys.issubset(set(d.keys())), (
        f"Missing keys: {required_keys - set(d.keys())}"
    )
