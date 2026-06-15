"""
climate_engine/api/physics/hex_grid.py — H3 hex grid generation and UHI decay.
"""
from __future__ import annotations

import logging
import math
import asyncio
from typing import Optional
from dataclasses import dataclass

import httpx
import h3

from .utils import rate_limit_lock

logger = logging.getLogger(__name__)


# ── H3CoverageResult ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class H3CoverageResult:
    """H3 hexagon coverage result with methodology tracking."""

    hexagons: tuple[str, ...]
    coverage_method: str
    center_lat: float
    center_lng: float
    boundary_source: str
    coverage_area_km2: Optional[float] = None
    resolution_used: int = 9


# ── GeoJSON coordinate extraction ─────────────────────────────────────────────

def _extract_polygon_coords(geojson: dict) -> list[list[float]]:
    """Extract coordinates from GeoJSON Polygon or MultiPolygon."""
    geom_type = geojson.get("type", "")
    coords = geojson.get("coordinates", [])

    if geom_type == "Polygon":
        if coords and coords[0]:
            return coords[0]
    elif geom_type == "MultiPolygon":
        if coords:
            largest = max(coords, key=lambda poly: len(poly[0]) if poly else 0)
            if largest and largest[0]:
                return largest[0]

    raise ValueError(f"Unsupported geometry type: {geom_type}")


# ── Adaptive H3 Resolution ────────────────────────────────────────────────────

_H3_CELL_AREA_KM2: dict[int, float] = {
    9: 0.1053,
    8: 0.7373,
    7: 5.1609,
    6: 36.1290,
}
_HEX_OVERFLOW_THRESHOLD = 15_000
_HEX_HARD_CAP           = 8_000
_HEX_RESOLUTION_MIN     = 6


def _estimate_polygon_area_km2(coords: list[list[float]]) -> float:
    """
    Shoelace area over [lon, lat] GeoJSON pairs, projected to km² via centre-latitude.
    Fast O(n) estimate — no external dependencies.
    """
    n = len(coords)
    if n < 3:
        return 0.0
    area_deg2 = 0.0
    for i in range(n - 1):
        area_deg2 += coords[i][0] * coords[i + 1][1]
        area_deg2 -= coords[i + 1][0] * coords[i][1]
    area_deg2 = abs(area_deg2) / 2.0
    lat_c   = sum(c[1] for c in coords) / n
    lat_rad = math.radians(lat_c)
    return area_deg2 * 110.574 * (111.32 * math.cos(lat_rad))


def _adaptive_polyfill(
    geo_dict: dict,
    coords: list[list[float]],
    start_resolution: int = 9,
) -> tuple[set, int]:
    """
    Run h3.polyfill at the highest resolution whose estimated cell count stays
    within _HEX_OVERFLOW_THRESHOLD. Never executes an over-budget polyfill.

    Returns (hex_set, resolution_used).
    """
    area_km2   = _estimate_polygon_area_km2(coords)
    chosen_res = _HEX_RESOLUTION_MIN

    for res in range(start_resolution, _HEX_RESOLUTION_MIN - 1, -1):
        cell_area = _H3_CELL_AREA_KM2.get(res, _H3_CELL_AREA_KM2[9])
        estimated = int(area_km2 / cell_area) if cell_area > 0 else 0
        if estimated <= _HEX_OVERFLOW_THRESHOLD or res == _HEX_RESOLUTION_MIN:
            chosen_res = res
            break

    if chosen_res < start_resolution:
        logger.warning(
            "[hex_grid] Resolution %d overflow detected. "
            "Stepping down resolution to balance compute constraints. "
            "(polygon %.1f km² → using Resolution %d)",
            start_resolution, area_km2, chosen_res,
        )

    outer_latlng = [(c[1], c[0]) for c in coords]
    poly = h3.LatLngPoly(outer_latlng)
    hex_set = set(h3.h3shape_to_cells(poly, chosen_res))
    return hex_set, chosen_res


def _cap_hexagons(hexagons: list[str], cap: int = _HEX_HARD_CAP) -> list[str]:
    """
    Stride-subsample to at most `cap` cells for lightweight JSON payloads.
    Sorting first makes the subsample deterministic and spatially coherent.
    """
    if len(hexagons) <= cap:
        return hexagons
    hexagons.sort()
    stride = max(1, len(hexagons) // cap)
    return hexagons[::stride][:cap]


async def get_city_hexagons(
    city_name: str,
    resolution: int = 9,
) -> H3CoverageResult:
    """
    Generate H3 hexagons covering a city boundary.

    Three-tier live resolution cascade:
      1. Nominatim OSM polygon / bounding-box → _adaptive_polyfill
      2. Nominatim 429 / no result → Open-Meteo coordinate → h3.grid_disk
      3. All geocoders fail → ValueError propagated to caller
    """
    url = (
        f"https://nominatim.openstreetmap.org/search"
        f"?q={city_name}&format=json&polygon_geojson=1&limit=5"
        f"&featuretype=settlement&layer=address"
    )
    headers = {"User-Agent": "OpenPlanet-Climate-Engine/2.0"}

    max_attempts = 3
    results = None

    for attempt in range(1, max_attempts + 1):
        try:
            async with rate_limit_lock:
                async with httpx.AsyncClient(timeout=15.0, trust_env=False) as client:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    resp.raise_for_status()
                    results = resp.json()
            break
        except Exception as exc:
            if attempt < max_attempts:
                await asyncio.sleep(2 ** attempt)
                logger.warning("Nominatim attempt %d for '%s' failed: %s", attempt, city_name, exc)
            else:
                logger.error("Nominatim completely failed for '%s': %s", city_name, exc)

    if not results:
        logger.warning(
            "Nominatim returned no results for '%s' — shifting to Open-Meteo dynamic mesh router",
            city_name,
        )
        try:
            async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
                resp = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={
                        "name": city_name.split(",")[0].strip(),
                        "count": 1,
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                geo_results = resp.json().get("results", [])

            if not geo_results:
                raise ValueError(f"Open-Meteo: no geographic coordinate mesh for '{city_name}'")

            center_lat = float(geo_results[0]["latitude"])
            center_lng = float(geo_results[0]["longitude"])

            center_cell = h3.latlng_to_cell(center_lat, center_lng, resolution)
            radius_steps = 35
            hex_collection = _cap_hexagons(list(h3.grid_disk(center_cell, radius_steps)))

            logger.info(
                "[hex_grid] Dynamic mesh for '%s': %d hexagons (k=%d, res=%d) "
                "centred at (%.4f, %.4f)",
                city_name, len(hex_collection), radius_steps, resolution,
                center_lat, center_lng,
            )
            return H3CoverageResult(
                hexagons=tuple(hex_collection),
                coverage_method="dynamic_hex_mesh_generation",
                center_lat=center_lat,
                center_lng=center_lng,
                boundary_source="open_meteo_geocoder",
                resolution_used=resolution,
            )

        except Exception as geo_exc:
            logger.error("Open-Meteo dynamic mesh failed for '%s': %s", city_name, geo_exc)

        raise ValueError(
            f"Geographic coordinate mesh could not resolve for '{city_name}'. "
            "Please verify spelling or supply a major surrounding municipality."
        )

    best_result = None
    for res in results:
        if res.get("class") == "boundary" or res.get("type") == "administrative":
            geojson = res.get("geojson", {})
            if geojson.get("type") in ("Polygon", "MultiPolygon"):
                best_result = res
                break

    if not best_result:
        best_result = results[0]

    center_lat = float(best_result.get("lat", 0))
    center_lng = float(best_result.get("lon", 0))
    geojson = best_result.get("geojson")

    if geojson and geojson.get("type") in ("Polygon", "MultiPolygon"):
        try:
            coords = _extract_polygon_coords(geojson)
            if len(coords) >= 4:
                geo_dict  = {"type": "Polygon", "coordinates": [coords]}
                hex_set, res_used = _adaptive_polyfill(geo_dict, coords, resolution)
                hexagons  = _cap_hexagons(list(hex_set))
                if hexagons:
                    logger.info(
                        "H3 coverage for '%s': %d hexagons (res %d) from %s boundary",
                        city_name, len(hexagons), res_used, geojson["type"],
                    )
                    return H3CoverageResult(
                        hexagons=tuple(hexagons),
                        coverage_method=geojson["type"].lower(),
                        center_lat=center_lat,
                        center_lng=center_lng,
                        boundary_source="nominatim_polygon",
                        resolution_used=res_used,
                    )
        except Exception as exc:
            logger.warning("Polygon extraction failed for '%s': %s", city_name, exc)

    bbox = best_result.get("boundingbox")
    if bbox and len(bbox) == 4:
        lat_min, lat_max, lon_min, lon_max = map(float, bbox)
        bbox_coords = [
            [lon_min, lat_min],
            [lon_max, lat_min],
            [lon_max, lat_max],
            [lon_min, lat_max],
            [lon_min, lat_min],
        ]
        geo_dict = {"type": "Polygon", "coordinates": [bbox_coords]}
        hex_set, res_used = _adaptive_polyfill(geo_dict, bbox_coords, resolution)
        hexagons = _cap_hexagons(list(hex_set))

        lat_rad        = math.radians(abs(center_lat))
        lng_km_per_deg = 111.32 * math.cos(lat_rad)
        area_km2       = (abs(lat_max - lat_min) * 110.574) * (abs(lon_max - lon_min) * lng_km_per_deg)

        logger.info(
            "H3 coverage for '%s': %d hexagons (res %d) from bounding box (%.1f km²)",
            city_name, len(hexagons), res_used, area_km2,
        )
        return H3CoverageResult(
            hexagons=tuple(hexagons),
            coverage_method="official_bounding_box",
            center_lat=center_lat,
            center_lng=center_lng,
            boundary_source="nominatim_bbox",
            coverage_area_km2=round(area_km2, 2),
            resolution_used=res_used,
        )

    logger.info("No boundary data for '%s' — using exact pinpoint only", city_name)
    center_hex = h3.latlng_to_cell(center_lat, center_lng, resolution)
    return H3CoverageResult(
        hexagons=(center_hex,),
        coverage_method="exact_point_only",
        center_lat=center_lat,
        center_lng=center_lng,
        boundary_source="single_hex",
        resolution_used=resolution,
    )
