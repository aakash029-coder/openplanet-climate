"""
tests/test_geocoding_ranking.py — Offline regression tests for the Photon
feature ranking and null-island rejection (the Lisbon-339 m root cause).
"""
from __future__ import annotations

from climate_engine.services.socioeconomic.geocoding import (
    _rank_photon_features,
    _photon_feature_rank,
    _is_null_island,
)

# Real Photon response shape for "Lisbon" (county boundary first, city second).
_LISBON_FEATURES = [
    {"properties": {"osm_key": "boundary", "osm_value": "administrative",
                    "name": "Lisbon", "countrycode": "PT"},
     "geometry": {"coordinates": [-9.144, 38.995]}},
    {"properties": {"osm_key": "place", "osm_value": "city",
                    "name": "Lisbon", "countrycode": "PT"},
     "geometry": {"coordinates": [-9.137, 38.708]}},
]


def test_populated_place_outranks_admin_boundary():
    ranked = _rank_photon_features(_LISBON_FEATURES)
    top = ranked[0]["properties"]
    assert top["osm_key"] == "place" and top["osm_value"] == "city"
    # The city point (38.708) wins over the district centroid (38.995).
    assert ranked[0]["geometry"]["coordinates"][1] == 38.708


def test_rank_ordering_place_types():
    assert _photon_feature_rank({"properties": {"osm_key": "place", "osm_value": "city"}}) < \
           _photon_feature_rank({"properties": {"osm_key": "place", "osm_value": "village"}})
    assert _photon_feature_rank({"properties": {"osm_key": "place", "osm_value": "village"}}) < \
           _photon_feature_rank({"properties": {"osm_key": "boundary", "osm_value": "administrative"}})


def test_null_island_detection():
    assert _is_null_island(0.0, 0.0)
    assert _is_null_island(0.005, -0.004)
    assert not _is_null_island(38.708, -9.137)
    assert not _is_null_island(51.5, 0.0)  # London is on the prime meridian, not null island
