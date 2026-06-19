"""
tests/test_koppen.py — Offline unit tests for the canonical Köppen-Geiger
classifier (climate_engine/api/physics/koppen.py).

Monthly normals below are drawn from published station/reanalysis climate
normals (Wikipedia climate boxes citing national met services). They test the
classification algorithm itself — no network access required. The live ERA5
classification is exercised separately in test_global_accuracy.py.
"""
from __future__ import annotations

import pytest

from climate_engine.api.physics.koppen import (
    classify_koppen,
    koppen_main_group,
    koppen_to_macro,
)

# (name, southern, monthly_tmean[12], monthly_precip[12], expected_code, expected_main)
CASES = [
    (
        "Lisbon",  # Csa — hot-summer Mediterranean (the known-buggy case)
        False,
        [11.6, 12.7, 14.5, 15.5, 17.6, 20.7, 22.8, 23.0, 21.9, 18.7, 14.7, 12.2],
        [100.9, 90.0, 51.5, 67.6, 53.6, 15.9, 4.2, 6.2, 32.9, 100.8, 116.5, 124.3],
        "Csa", "C",
    ),
    (
        "Singapore",  # Af — tropical rainforest
        False,
        [26.6, 27.2, 27.6, 28.0, 28.4, 28.5, 28.3, 28.3, 28.0, 27.7, 27.0, 26.6],
        [243.0, 159.0, 186.0, 179.0, 171.0, 162.0, 158.0, 176.0, 169.0, 194.0, 257.0, 288.0],
        "Af", "A",
    ),
    (
        "Cairo",  # BWh — hot desert
        False,
        [14.0, 15.5, 17.5, 21.0, 25.0, 27.5, 28.0, 28.0, 26.5, 24.0, 19.0, 15.5],
        [5.0, 4.0, 4.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 4.0, 6.0],
        "BWh", "B",
    ),
    (
        "Phoenix",  # BWh — hot desert
        False,
        [13.0, 15.0, 18.0, 22.0, 27.0, 32.0, 34.5, 33.5, 30.5, 23.5, 16.5, 12.0],
        [21.0, 22.0, 28.0, 6.0, 3.0, 1.0, 25.0, 26.0, 22.0, 17.0, 18.0, 24.0],
        "BWh", "B",
    ),
    (
        "London",  # Cfb — temperate oceanic
        False,
        [5.2, 5.3, 7.6, 9.9, 13.3, 16.1, 18.3, 18.0, 15.5, 11.9, 8.0, 5.5],
        [55.0, 40.0, 42.0, 44.0, 49.0, 45.0, 45.0, 50.0, 49.0, 69.0, 59.0, 55.0],
        "Cfb", "C",
    ),
    (
        "Moscow",  # Dfb — humid continental
        False,
        [-9.0, -8.0, -2.0, 6.0, 13.0, 17.0, 19.0, 17.0, 11.0, 5.0, -2.0, -7.0],
        [42.0, 36.0, 34.0, 44.0, 51.0, 75.0, 94.0, 77.0, 65.0, 59.0, 58.0, 51.0],
        "Dfb", "D",
    ),
    (
        "CapeTown",  # Csb — warm-summer Mediterranean (southern hemisphere)
        True,
        [21.5, 21.5, 20.5, 18.0, 15.5, 13.5, 13.0, 13.5, 15.0, 17.0, 18.5, 20.5],
        [15.0, 17.0, 20.0, 41.0, 69.0, 93.0, 82.0, 77.0, 40.0, 30.0, 14.0, 17.0],
        "Csb", "C",
    ),
    (
        "Yakutsk",  # Dfd — extreme continental, severe winter
        False,
        [-38.6, -33.3, -20.0, -4.5, 7.5, 16.0, 19.5, 15.0, 6.0, -7.5, -28.0, -37.5],
        [9.0, 7.0, 6.0, 14.0, 27.0, 37.0, 47.0, 41.0, 29.0, 24.0, 16.0, 13.0],
        "Dfd", "D",
    ),
]


@pytest.mark.parametrize("name,southern,t,p,expected_code,expected_main", CASES)
def test_koppen_exact_code(name, southern, t, p, expected_code, expected_main):
    code = classify_koppen(t, p, southern_hemisphere=southern)
    assert koppen_main_group(code) == expected_main, (
        f"{name}: main group {code[0]} != {expected_main} (full={code})"
    )
    assert code == expected_code, f"{name}: got {code}, expected {expected_code}"


def test_macro_mapping_lisbon_is_mediterranean():
    macro = koppen_to_macro("Csa")
    assert macro.koppen_class.value == "Csa"
    assert "Mediterranean" in macro.koppen_label


def test_macro_mapping_boreal_vs_continental():
    assert koppen_to_macro("Dfc").koppen_label.startswith("Subarctic")
    assert "Continental" in koppen_to_macro("Dfb").koppen_label


def test_requires_twelve_months():
    with pytest.raises(ValueError):
        classify_koppen([10.0] * 11, [50.0] * 12)
