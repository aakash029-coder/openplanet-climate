"""
climate_engine/services/socioeconomic/fallback.py — Vault/fallback data loading and tier definitions.
"""
from __future__ import annotations

import logging
import json
import os
from dataclasses import dataclass
from typing import Dict

logger = logging.getLogger(__name__)

# ── Offline Vault Loaders ─────────────────────────────────────────────────────

try:
    _VAULT_PATH = os.path.join(os.path.dirname(__file__), '../../data/socio_vault.json')
    with open(_VAULT_PATH, 'r') as _f:
        _OFFLINE_VAULT = json.load(_f)
except Exception as e:
    logger.error("Failed to load offline vault in socio_service.py: %s", e)
    _OFFLINE_VAULT = {}

try:
    _CITY_VAULT_PATH = os.path.join(os.path.dirname(__file__), '../../data/city_vault.json')
    with open(_CITY_VAULT_PATH, 'r') as _f:
        _CITY_VAULT: dict = json.load(_f)
    logger.info("City Vault loaded: %d verified city entries", len(_CITY_VAULT))
except Exception as e:
    logger.error("Failed to load city vault: %s", e)
    _CITY_VAULT = {}

try:
    _METRO_VAULT_PATH = os.path.join(os.path.dirname(__file__), '../../data/world_metro_pop.json')
    with open(_METRO_VAULT_PATH, 'r') as _f:
        _mv = json.load(_f)
    _METRO_KEYED: dict = _mv.get("keyed", {})
    _METRO_BARE: dict = _mv.get("bare", {})
    logger.info("Metro Population Vault loaded: %d keyed cities", len(_METRO_KEYED))
except Exception as e:
    logger.error("Failed to load metro population vault: %s", e)
    _METRO_KEYED, _METRO_BARE = {}, {}


# ── Geo-Economic Tier Vault ───────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class GeoEconomicTier:
    gdp_per_capita: float
    urban_share: float
    life_expectancy: float
    physicians_per1000: float
    pct_under15: float
    pct_over65: float
    density_factor: float


GEO_TIERS: Dict[str, GeoEconomicTier] = {
    "NORTH_AMERICA_HIGH": GeoEconomicTier(
        gdp_per_capita=65000, urban_share=83, life_expectancy=79,
        physicians_per1000=2.6, pct_under15=18, pct_over65=17, density_factor=0.7,
    ),
    "EUROPE_HIGH": GeoEconomicTier(
        gdp_per_capita=48000, urban_share=75, life_expectancy=81,
        physicians_per1000=3.8, pct_under15=15, pct_over65=20, density_factor=1.1,
    ),
    "EAST_ASIA_HIGH": GeoEconomicTier(
        gdp_per_capita=42000, urban_share=82, life_expectancy=84,
        physicians_per1000=2.5, pct_under15=12, pct_over65=28, density_factor=1.4,
    ),
    "OCEANIA_HIGH": GeoEconomicTier(
        gdp_per_capita=55000, urban_share=86, life_expectancy=83,
        physicians_per1000=3.7, pct_under15=19, pct_over65=16, density_factor=0.5,
    ),
    "GULF_HIGH": GeoEconomicTier(
        gdp_per_capita=35000, urban_share=85, life_expectancy=78,
        physicians_per1000=2.3, pct_under15=20, pct_over65=3, density_factor=0.9,
    ),
    "EUROPE_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=18000, urban_share=70, life_expectancy=76,
        physicians_per1000=3.2, pct_under15=15, pct_over65=18, density_factor=1.0,
    ),
    "LATAM_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=12000, urban_share=81, life_expectancy=75,
        physicians_per1000=2.1, pct_under15=23, pct_over65=9, density_factor=1.2,
    ),
    "EAST_ASIA_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=12500, urban_share=62, life_expectancy=77,
        physicians_per1000=2.2, pct_under15=17, pct_over65=13, density_factor=1.5,
    ),
    "SOUTH_ASIA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=2500, urban_share=36, life_expectancy=70,
        physicians_per1000=0.8, pct_under15=26, pct_over65=7, density_factor=1.8,
    ),
    "SOUTHEAST_ASIA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=4500, urban_share=52, life_expectancy=72,
        physicians_per1000=0.9, pct_under15=24, pct_over65=8, density_factor=1.4,
    ),
    "AFRICA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=1800, urban_share=45, life_expectancy=65,
        physicians_per1000=0.3, pct_under15=40, pct_over65=4, density_factor=1.3,
    ),
    "MENA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=4000, urban_share=65, life_expectancy=73,
        physicians_per1000=1.2, pct_under15=30, pct_over65=6, density_factor=1.1,
    ),
    "AFRICA_LOW": GeoEconomicTier(
        gdp_per_capita=700, urban_share=32, life_expectancy=62,
        physicians_per1000=0.1, pct_under15=44, pct_over65=3, density_factor=1.2,
    ),
    "SOUTH_ASIA_FRAGILE": GeoEconomicTier(
        gdp_per_capita=550, urban_share=26, life_expectancy=65,
        physicians_per1000=0.3, pct_under15=42, pct_over65=4, density_factor=1.6,
    ),
    "SMALL_ISLAND_DEVELOPING": GeoEconomicTier(
        gdp_per_capita=8000, urban_share=55, life_expectancy=71,
        physicians_per1000=1.0, pct_under15=28, pct_over65=8, density_factor=1.3,
    ),
}

COUNTRY_TO_TIER: Dict[str, str] = {
    "US": "NORTH_AMERICA_HIGH", "CA": "NORTH_AMERICA_HIGH",
    "DE": "EUROPE_HIGH", "FR": "EUROPE_HIGH", "GB": "EUROPE_HIGH",
    "IT": "EUROPE_HIGH", "ES": "EUROPE_HIGH", "NL": "EUROPE_HIGH",
    "BE": "EUROPE_HIGH", "AT": "EUROPE_HIGH", "CH": "EUROPE_HIGH",
    "SE": "EUROPE_HIGH", "NO": "EUROPE_HIGH", "DK": "EUROPE_HIGH",
    "FI": "EUROPE_HIGH", "IE": "EUROPE_HIGH", "PT": "EUROPE_HIGH",
    "LU": "EUROPE_HIGH", "IS": "EUROPE_HIGH",
    "JP": "EAST_ASIA_HIGH", "KR": "EAST_ASIA_HIGH", "TW": "EAST_ASIA_HIGH",
    "SG": "EAST_ASIA_HIGH", "HK": "EAST_ASIA_HIGH",
    "AU": "OCEANIA_HIGH", "NZ": "OCEANIA_HIGH",
    "AE": "GULF_HIGH", "SA": "GULF_HIGH", "QA": "GULF_HIGH",
    "KW": "GULF_HIGH", "BH": "GULF_HIGH", "OM": "GULF_HIGH",
    "PL": "EUROPE_UPPER_MID", "CZ": "EUROPE_UPPER_MID", "HU": "EUROPE_UPPER_MID",
    "RO": "EUROPE_UPPER_MID", "BG": "EUROPE_UPPER_MID", "HR": "EUROPE_UPPER_MID",
    "SK": "EUROPE_UPPER_MID", "SI": "EUROPE_UPPER_MID", "LT": "EUROPE_UPPER_MID",
    "LV": "EUROPE_UPPER_MID", "EE": "EUROPE_UPPER_MID", "GR": "EUROPE_UPPER_MID",
    "RS": "EUROPE_UPPER_MID", "UA": "EUROPE_UPPER_MID", "BY": "EUROPE_UPPER_MID",
    "RU": "EUROPE_UPPER_MID", "TR": "EUROPE_UPPER_MID",
    "MX": "LATAM_UPPER_MID", "BR": "LATAM_UPPER_MID", "AR": "LATAM_UPPER_MID",
    "CL": "LATAM_UPPER_MID", "CO": "LATAM_UPPER_MID", "PE": "LATAM_UPPER_MID",
    "VE": "LATAM_UPPER_MID", "EC": "LATAM_UPPER_MID", "CR": "LATAM_UPPER_MID",
    "PA": "LATAM_UPPER_MID", "UY": "LATAM_UPPER_MID", "DO": "LATAM_UPPER_MID",
    "CN": "EAST_ASIA_UPPER_MID", "TH": "EAST_ASIA_UPPER_MID", "MY": "EAST_ASIA_UPPER_MID",
    "IN": "SOUTH_ASIA_LOWER_MID", "BD": "SOUTH_ASIA_LOWER_MID",
    "PK": "SOUTH_ASIA_LOWER_MID", "LK": "SOUTH_ASIA_LOWER_MID",
    "NP": "SOUTH_ASIA_LOWER_MID",
    "ID": "SOUTHEAST_ASIA_LOWER_MID", "PH": "SOUTHEAST_ASIA_LOWER_MID",
    "VN": "SOUTHEAST_ASIA_LOWER_MID", "MM": "SOUTHEAST_ASIA_LOWER_MID",
    "KH": "SOUTHEAST_ASIA_LOWER_MID", "LA": "SOUTHEAST_ASIA_LOWER_MID",
    "NG": "AFRICA_LOWER_MID", "GH": "AFRICA_LOWER_MID", "KE": "AFRICA_LOWER_MID",
    "CI": "AFRICA_LOWER_MID", "SN": "AFRICA_LOWER_MID", "CM": "AFRICA_LOWER_MID",
    "ZA": "AFRICA_LOWER_MID", "EG": "AFRICA_LOWER_MID", "MA": "AFRICA_LOWER_MID",
    "TN": "AFRICA_LOWER_MID", "DZ": "AFRICA_LOWER_MID",
    "IR": "MENA_LOWER_MID", "IQ": "MENA_LOWER_MID", "JO": "MENA_LOWER_MID",
    "LB": "MENA_LOWER_MID", "PS": "MENA_LOWER_MID",
    "ET": "AFRICA_LOW", "TZ": "AFRICA_LOW", "UG": "AFRICA_LOW",
    "RW": "AFRICA_LOW", "MW": "AFRICA_LOW", "MZ": "AFRICA_LOW",
    "ZM": "AFRICA_LOW", "ZW": "AFRICA_LOW", "SD": "AFRICA_LOW",
    "SS": "AFRICA_LOW", "CD": "AFRICA_LOW", "CF": "AFRICA_LOW",
    "TD": "AFRICA_LOW", "NE": "AFRICA_LOW", "ML": "AFRICA_LOW",
    "BF": "AFRICA_LOW", "SO": "AFRICA_LOW", "ER": "AFRICA_LOW",
    "MR": "AFRICA_LOW", "GM": "AFRICA_LOW", "GN": "AFRICA_LOW",
    "SL": "AFRICA_LOW", "LR": "AFRICA_LOW", "BI": "AFRICA_LOW",
    "AF": "SOUTH_ASIA_FRAGILE", "YE": "SOUTH_ASIA_FRAGILE",
    "SY": "SOUTH_ASIA_FRAGILE", "HT": "SOUTH_ASIA_FRAGILE",
    "FJ": "SMALL_ISLAND_DEVELOPING", "WS": "SMALL_ISLAND_DEVELOPING",
    "TO": "SMALL_ISLAND_DEVELOPING", "VU": "SMALL_ISLAND_DEVELOPING",
    "SB": "SMALL_ISLAND_DEVELOPING", "PG": "SMALL_ISLAND_DEVELOPING",
    "MV": "SMALL_ISLAND_DEVELOPING", "MU": "SMALL_ISLAND_DEVELOPING",
    "SC": "SMALL_ISLAND_DEVELOPING", "CV": "SMALL_ISLAND_DEVELOPING",
    "JM": "SMALL_ISLAND_DEVELOPING", "TT": "SMALL_ISLAND_DEVELOPING",
    "BB": "SMALL_ISLAND_DEVELOPING", "BS": "SMALL_ISLAND_DEVELOPING",
    "CU": "SMALL_ISLAND_DEVELOPING", "PR": "SMALL_ISLAND_DEVELOPING",
}

DEFAULT_TIER = "AFRICA_LOWER_MID"


def get_tier_for_country(iso2: str) -> GeoEconomicTier:
    tier_name = COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER)
    return GEO_TIERS[tier_name]
