"""
climate_engine/api/_helpers.py — Shared helpers for the API layer.

Contains: vault loaders, SSP helpers, UHI spatial decay, H3 hex grid generation.
Not intended for import by external code — use the public API in main.py.
"""
from __future__ import annotations

import json
import logging
import math
import os
import re
from typing import Optional

import h3
import pycountry
from fastapi import HTTPException, status
from global_land_mask import globe

from climate_engine.api.physics import (
    ClimateZone,
    ZoneClassification,
    detect_climate_archetype,
    H3CoverageResult,
    get_city_hexagons,
    ISO3_MAP,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# City Coordinate Vault — local geocoding intercept (zero HTTP, zero 429 risk)
# ─────────────────────────────────────────────────────────────────────────────

try:
    _CITY_COORDS_PATH = os.path.join(
        os.path.dirname(__file__), "../data/city_coords.json"
    )
    with open(_CITY_COORDS_PATH, "r") as _f:
        _CITY_COORDS: dict = json.load(_f)
    logger.info("City Coords Vault loaded: %d entries", len(_CITY_COORDS))
except Exception as _e:
    logger.error("Failed to load city_coords.json: %s", _e)
    _CITY_COORDS = {}


def _coords_vault_key(city: str) -> Optional[str]:
    """Slug-match a raw city query string against the coordinate vault."""
    parts = [p.strip() for p in city.split(",")]

    def _slug(s: str) -> str:
        import unicodedata
        s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
        s = re.sub(r"[^a-z0-9 ]", "", s.lower())
        return re.sub(r"\s+", "_", s.strip())

    if len(parts) >= 2:
        slug = _slug(f"{parts[0]} {parts[-1]}")
        if slug in _CITY_COORDS:
            return slug
    city_slug = _slug(parts[0])
    for key in _CITY_COORDS:
        if key.startswith(city_slug):
            return key
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ISO2 → ISO3 helper
# ─────────────────────────────────────────────────────────────────────────────

def _iso2_to_iso3(iso2: str) -> str:
    if not iso2 or iso2 == "UN":
        return "WLD"
    try:
        country = pycountry.countries.get(alpha_2=iso2.upper())
        if country:
            return country.alpha_3
    except Exception:
        pass
    return ISO3_MAP.get(iso2, "WLD")


# ─────────────────────────────────────────────────────────────────────────────
# SSP Normalisation helpers
# ─────────────────────────────────────────────────────────────────────────────

_SSP_DISPLAY: dict[str, str] = {
    "ssp119": "SSP1-1.9",
    "ssp126": "SSP1-2.6",
    "ssp245": "SSP2-4.5",
    "ssp370": "SSP3-7.0",
    "ssp434": "SSP4-3.4",
    "ssp460": "SSP4-6.0",
    "ssp534": "SSP5-3.4",
    "ssp585": "SSP5-8.5",
}

_SSP_HIGH_EMISSION: frozenset[str] = frozenset({"ssp585", "ssp370"})


def _normalize_ssp(ssp: str) -> str:
    code = ssp.strip().lower().replace("-", "").replace(".", "")
    if code not in _SSP_DISPLAY:
        logger.warning(
            "[_normalize_ssp] Unrecognised SSP code '%s' (raw='%s'). "
            "Proceeding best-effort.",
            code,
            ssp,
        )
    return code


def _is_high_emission(ssp_code: str) -> bool:
    return ssp_code in _SSP_HIGH_EMISSION


# ─────────────────────────────────────────────────────────────────────────────
# Canonical error helpers
# ─────────────────────────────────────────────────────────────────────────────

def _data_unavailable(detail: str) -> HTTPException:
    logger.error("DATA UNAVAILABLE 404: %s", detail)
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Scientific Data Unavailable: {detail}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Köppen-Calibrated UHI Spatial Decay Parameters
# Sources:
#   Oke TR (1982) "The energetic basis of the urban heat island."
#     Q J R Meteorol Soc 108(455):1–24. Table 2 — UHI intensity by climate type.
#   Arnfield AJ (2003) "Two decades of urban climate research: a review of
#     turbulence, exchanges of energy and water, and the urban heat island."
#     Int J Climatol 23(1):1–26. §4.2 — lateral decay morphology.
#   Roth M (2007) "Review of atmospheric turbulence over cities."
#     Q J R Meteorol Soc 133(629):1551–1563. Fig. 3 — lateral decay profiles.
#
# Format: (core_warmth_offset, decay_per_km)
#   core_warmth_offset  — fractional risk addition at the urban centre
#   decay_per_km        — fractional reduction per km from centre
# ─────────────────────────────────────────────────────────────────────────────

_UHI_DECAY_PARAMS: dict[ClimateZone, tuple[float, float]] = {
    ClimateZone.HYPER_ARID:          (0.14, 0.018),
    ClimateZone.LETHAL_HUMID:        (0.06, 0.025),
    ClimateZone.EXTREME_CONTINENTAL: (0.10, 0.024),
    ClimateZone.PERMAFROST:          (0.04, 0.038),
    ClimateZone.STANDARD:            (0.08, 0.028),
}


# ─────────────────────────────────────────────────────────────────────────────
# H3 Hex Grid Generation Helper
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_hex_grid_data(
    city_name: str,
    city_wbt: float,
    city_temp: float,
    p95_rh: float = 65.0,
    ann_mean: float = 15.0,
    resolution: int = 9,
) -> tuple[list[dict], str]:
    """
    Generate H3 hex grid with Köppen-calibrated UHI distance-decay modelling.
    1. Filters out water using global_land_mask.
    2. Classifies climate archetype from ann_mean + p95_rh.
    3. Applies Oke (1982) / Arnfield (2003) zone-specific decay params.
    """
    try:
        hex_coverage: H3CoverageResult = await get_city_hexagons(city_name, resolution)
        center_lat = hex_coverage.center_lat
        center_lng = hex_coverage.center_lng

        zone_obj = detect_climate_archetype(mean_temp=ann_mean, p95_rh=p95_rh, tx5d=city_temp)
        uhi_core, uhi_slope = _UHI_DECAY_PARAMS[zone_obj.zone]

        base_intensity = min(0.85, max(0.1, (city_wbt - 15.0) / 20.0))

        hex_grid_data: list[dict] = []
        for hx in hex_coverage.hexagons:
            lat, lng = h3.cell_to_latlng(hx)

            if not globe.is_land(lat, lng):
                continue

            dy = lat - center_lat
            dx = (lng - center_lng) * math.cos(math.radians(center_lat))
            dist_km = math.sqrt(dx * dx + dy * dy) * 111.0

            uhi_decay_factor = max(-0.25, uhi_core - (dist_km * uhi_slope))
            final_risk = min(1.0, max(0.05, base_intensity + uhi_decay_factor))

            hex_grid_data.append({
                "position": [lng, lat],
                "risk_weight": round(final_risk, 3),
                "hex_id": hx,
            })

        logger.info(
            "[hex_grid] Generated %d modelled hexagons for '%s' (coverage=%s)",
            len(hex_grid_data),
            city_name,
            hex_coverage.coverage_method,
        )
        return hex_grid_data, hex_coverage.coverage_method

    except Exception as exc:
        logger.warning("[hex_grid] Failed for '%s': %s", city_name, exc)
        return [], "unavailable"
