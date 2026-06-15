"""
climate_engine/api/physics — Physics engine package.

Re-exports every public symbol so that existing importers using
    from climate_engine.api.physics import X
continue to work unchanged after the module was split.
"""

# ISO3 map (kept from original physics.py — used in main.py)
ISO3_MAP = {
    "IN": "IND", "CN": "CHN", "US": "USA", "GB": "GBR", "JP": "JPN",
    "DE": "DEU", "FR": "FRA", "AU": "AUS", "BR": "BRA", "MX": "MEX",
    "SG": "SGP", "ID": "IDN", "TH": "THA", "PK": "PAK", "BD": "BGD",
    "UN": "WLD", "ZA": "ZAF", "NG": "NGA", "KE": "KEN", "EG": "EGY",
    "TR": "TUR", "SA": "SAU", "AE": "ARE", "PH": "PHL", "VN": "VNM",
    "MY": "MYS", "RU": "RUS", "CA": "CAN", "KR": "KOR", "AR": "ARG",
    "CL": "CHL", "CO": "COL", "IT": "ITA", "ES": "ESP", "NL": "NLD",
    "SE": "SWE", "NO": "NOR", "FI": "FIN", "DK": "DNK", "PL": "POL",
}

from .climate_zone import ClimateZone, ZoneClassification, detect_climate_archetype
from .wetbulb import (
    WetBulbResult,
    _stull_wetbulb,
    stull_wetbulb_simple,
    _fetch_era5_humidity_p95,
    _fetch_relative_humidity_live,
)
from .mortality import (
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    mortality_confidence_level,
)
from .economics import apply_burke_formula, compute_hybrid_economic_loss
from .hex_grid import H3CoverageResult, get_city_hexagons
from .audit import _build_audit_trail

__all__ = [
    "ISO3_MAP",
    "ClimateZone",
    "ZoneClassification",
    "detect_climate_archetype",
    "WetBulbResult",
    "_stull_wetbulb",
    "stull_wetbulb_simple",
    "_fetch_era5_humidity_p95",
    "_fetch_relative_humidity_live",
    "_fetch_worldbank_death_rate",
    "_gasparrini_mortality",
    "mortality_confidence_level",
    "apply_burke_formula",
    "compute_hybrid_economic_loss",
    "H3CoverageResult",
    "get_city_hexagons",
    "_build_audit_trail",
]
