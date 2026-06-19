"""Pytest configuration for the OpenPlanet test suite."""
from __future__ import annotations


def pytest_addoption(parser):
    parser.addoption(
        "--run-live",
        action="store_true",
        default=False,
        help="Recompute the global-accuracy panel from live ERA5/CMIP6/World Bank/DEM "
             "APIs instead of the committed fixture.",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "live: marks tests that hit live external APIs (use with --run-live).",
    )
