"""
climate_engine/services/socioeconomic/worldbank.py — World Bank / UN API fetching and country indicators.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx
import pycountry

from .fallback import _OFFLINE_VAULT, COUNTRY_TO_TIER, DEFAULT_TIER, get_tier_for_country

logger = logging.getLogger(__name__)

WORLD_BANK_SEMAPHORE = asyncio.Semaphore(3)

# ── ISO code handling ──────────────────────────────────────────────────────────

ISO2_TO_ISO3_OVERRIDES: Dict[str, str] = {
    "XK": "XKX",  # Kosovo
    "TW": "TWN",
    "PS": "PSE",
    "AN": "ANT",
    "CS": "SCG",
}


def iso2_to_iso3(iso2: str) -> str:
    code = iso2.upper().strip()
    if code in ISO2_TO_ISO3_OVERRIDES:
        return ISO2_TO_ISO3_OVERRIDES[code]
    country = pycountry.countries.get(alpha_2=code)
    if country:
        return country.alpha_3
    logger.warning("ISO2 '%s' unresolvable, using WLD for World Bank queries", code)
    return "WLD"


# ── Thread-safe LRU cache with TTL ────────────────────────────────────────────

import time
from collections import OrderedDict
from dataclasses import dataclass, field

COUNTRY_CACHE_TTL = 86_400 * 30  # 30 days


@dataclass
class CacheEntry:
    data: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)

    def is_expired(self, ttl: float) -> bool:
        return (time.time() - self.timestamp) > ttl


class BoundedTTLCache:
    __slots__ = ("_cache", "_max_size", "_ttl", "_lock", "_hits", "_misses")

    def __init__(self, max_size: int, ttl_seconds: float):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None
        if entry.is_expired(self._ttl):
            async with self._lock:
                self._cache.pop(key, None)
            self._misses += 1
            return None
        self._cache.move_to_end(key)
        self._hits += 1
        return entry.data

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        async with self._lock:
            if key in self._cache:
                self._cache[key] = CacheEntry(data=value)
                self._cache.move_to_end(key)
                return
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
            self._cache[key] = CacheEntry(data=value)

    async def invalidate(self, key: str) -> bool:
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
        return False

    async def clear(self) -> int:
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._hits = 0
            self._misses = 0
        return count

    @property
    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / total if total > 0 else 0.0,
        }


_country_cache = BoundedTTLCache(max_size=300, ttl_seconds=COUNTRY_CACHE_TTL)


# ── Country indicators from vault ─────────────────────────────────────────────

async def fetch_un_death_rate(iso3: str, client: httpx.AsyncClient) -> Optional[float]:
    """
    Fetches Crude Death Rate (Indicator 59) directly from the UN Population Division API.
    """
    try:
        country = pycountry.countries.get(alpha_3=iso3.upper())
        if not country:
            return None
        un_code = country.numeric

        url = f"https://population.un.org/dataportalapi/api/v1/data/indicators/59/locations/{un_code}/start/2023/end/2024"

        async with WORLD_BANK_SEMAPHORE:
            resp = await client.get(url, headers={"Accept": "application/json"}, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()

            if data.get("data"):
                return float(data["data"][0]["value"])

    except Exception as exc:
        logger.warning("UN Population API request failed for death rate (%s): %s", iso3, exc)

    return None


async def fetch_country_indicators(
    iso3: str,
    iso2: str,
    client: httpx.AsyncClient,
) -> Dict[str, float]:
    """
    Resolves country indicators locally via vault mappings, providing resilient access.
    """
    cache_key = f"offline_socio_{iso3}"
    cached = await _country_cache.get(cache_key)
    if cached:
        return cached

    country_data = _OFFLINE_VAULT.get(iso3, {})
    tier = get_tier_for_country(iso2)

    final_data: Dict[str, Any] = {
        "gdp_per_capita": country_data.get("gdp_per_capita") or tier.gdp_per_capita,
        "gdp_total_usd": country_data.get("gdp_total_usd"),          # national nominal GDP (cap)
        "population_total": country_data.get("population_total"),    # national population
        "urban_share": country_data.get("urban_share") or tier.urban_share,
        "gni_per_capita": country_data.get("gdp_per_capita") or tier.gdp_per_capita,
        "life_expectancy": country_data.get("life_expectancy") or tier.life_expectancy,
        "physicians_per1000": country_data.get("physicians_per1000") or tier.physicians_per1000,
        "pct_under15": country_data.get("pct_under15") or tier.pct_under15,
        "pct_over65": country_data.get("pct_over65") or tier.pct_over65,
        "density_factor": tier.density_factor,
    }

    logger.info("Loaded socioeconomic indicators for %s from Local Vault", iso3)

    await _country_cache.set(cache_key, final_data)
    return final_data
