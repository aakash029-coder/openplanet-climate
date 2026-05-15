"""Unit tests for location geocoding disambiguation."""

from climate_engine.services.socioeconomic_service import (
    _country_codes_from_hint,
    _prepare_geocoding_query,
    _select_nominatim_hit,
    _select_openmeteo_hit,
)


def test_prepare_geocoding_query_preserves_country():
    assert _prepare_geocoding_query("Athens, Greece") == "Athens, Greece"


def test_country_codes_from_hint_greece():
    assert "GR" in _country_codes_from_hint("Greece")


def test_openmeteo_prefers_country_hint_over_population():
    results = [
        {
            "name": "Athens",
            "country_code": "US",
            "population": 130_000,
            "latitude": 32.2,
            "longitude": -83.4,
        },
        {
            "name": "Athens",
            "country_code": "GR",
            "population": 664_000,
            "latitude": 37.98,
            "longitude": 23.73,
        },
    ]
    hit = _select_openmeteo_hit(results, "Athens, Greece")
    assert hit["country_code"] == "GR"


def test_nominatim_prefers_country_hint():
    results = [
        {
            "lat": "32.2048735",
            "lon": "-83.3776558",
            "address": {"country_code": "us"},
        },
        {
            "lat": "37.9839412",
            "lon": "23.7282712",
            "address": {"country_code": "gr"},
        },
    ]
    hit = _select_nominatim_hit(results, "Athens, Greece")
    assert hit["address"]["country_code"] == "gr"
