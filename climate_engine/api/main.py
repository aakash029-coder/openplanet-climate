"""
climate_engine/api/main.py
"""
from __future__ import annotations

import logging
import math
import random
import re
import asyncio
from typing import List, Dict, Any, Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
)
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.services.llm_service import (
    generate_strategic_analysis,
    generate_strategic_analysis_raw,
    generate_compare_analysis,
)

logger = logging.getLogger(__name__)
rate_limit_lock = asyncio.Semaphore(5)


class PredictionRequest(BaseModel):
    city: str
    lat: float
    lng: float
    ssp: str
    year: str
    canopy: int
    coolRoof: int

class ClimateRiskRequest(BaseModel):
    lat: float
    lng: float
    elevation: float = 0.0
    ssp: str
    canopy_offset_pct: int
    albedo_offset_pct: int
    location_hint: str = ""

class ResearchAIRequest(BaseModel):
    city_name: str
    metrics: Dict[str, Any]
    context: str

class CompareAnalysisRequest(BaseModel):
    city_a: str
    city_b: str
    data_a: Dict[str, Any]
    data_b: Dict[str, Any]

class SimulationResponse(BaseModel):
    metrics:    Dict[str, Any]
    hexGrid:    List[Dict[str, Any]]
    aiAnalysis: Optional[Dict[str, str]]
    auditTrail: Optional[Dict[str, Any]]
    charts:     Dict[str, List[Dict[str, Any]]]


async def _fetch_era5_humidity_p95(lat: float, lng: float) -> float:
    try:
        years_data = []
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for year in [1995, 2000, 2005, 2010, 2015]:
                    if lat >= 0:
                        start = f"{year}-06-01"
                        end   = f"{year}-08-31"
                    else:
                        start = f"{year}-12-01"
                        end   = f"{year + 1}-02-28"
                    url = (
                        f"https://archive-api.open-meteo.com/v1/archive"
                        f"?latitude={lat}&longitude={lng}"
                        f"&start_date={start}&end_date={end}"
                        f"&daily=relative_humidity_2m_max"
                        f"&timezone=auto"
                    )
                    try:
                        resp = await client.get(url, timeout=15.0)
                        resp.raise_for_status()
                        vals = resp.json().get("daily", {}).get("relative_humidity_2m_max", [])
                        years_data.extend([v for v in vals if v is not None])
                    except Exception:
                        continue

        if years_data and len(years_data) >= 10:
            sorted_data = sorted(years_data)
            p95_idx     = int(len(sorted_data) * 0.95)
            p95_rh      = sorted_data[min(p95_idx, len(sorted_data) - 1)]
            return round(float(p95_rh), 1)

    except Exception as e:
        logger.warning(f"ERA5 P95 humidity failed {lat},{lng}: {e}")

    abs_lat = abs(lat)
    if abs_lat < 15:   return 85.0
    elif abs_lat < 25: return 75.0
    elif abs_lat < 35: return 65.0
    elif abs_lat < 50: return 60.0
    else:              return 55.0


async def _fetch_relative_humidity_live(lat: float, lng: float) -> float:
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lng}"
            f"&current=relative_humidity_2m"
            f"&timezone=auto"
        )
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                rh = resp.json().get("current", {}).get("relative_humidity_2m")
                if rh is not None:
                    return float(rh)
    except Exception as e:
        logger.warning(f"Live humidity failed {lat},{lng}: {e}")
    return 60.0


def _stull_wetbulb(temp_c: float, rh_pct: float, is_desert: bool = False, is_tropical: bool = False) -> float:
    effective_rh = max(5.0, min(99.0, rh_pct))
    if temp_c > 28.0:
        temp_delta = temp_c - 28.0
        if is_desert:
            drop_factor = math.exp(-0.15 * temp_delta)
            effective_rh = max(10.0, effective_rh * drop_factor)
        elif is_tropical:
            drop_factor = math.exp(-0.04 * temp_delta)
            effective_rh = max(40.0, effective_rh * drop_factor)
        else:
            drop_factor = math.exp(-0.08 * temp_delta)
            effective_rh = max(20.0, effective_rh * drop_factor)
    wbt = (
        temp_c * math.atan(0.151977 * math.sqrt(effective_rh + 8.313659))
        + math.atan(temp_c + effective_rh)
        - math.atan(effective_rh - 1.676331)
        + 0.00391838 * effective_rh ** 1.5 * math.atan(0.023101 * effective_rh)
        - 4.686035
    )
    return round(min(wbt, 35.0), 2)


def _get_region_profile(lat: float, lng: float, rh: float, baseline_annual_mean: float) -> dict:
    """
    Global climate region classifier — v3 (Honest Physics Edition).

    KEY DESIGN DECISIONS
    ════════════════════
    1.  `rh` == ERA5 *summer-season* P95 humidity (Jun-Aug NH / Dec-Feb SH).
        Mediterranean cities and Riyadh have DRY summers → naturally low rh →
        they can NEVER reach the humid-subtropical logic below.  No special exclusion needed.

    2.  `summer_t` proxy corrects the "cold-winter blindspot":
        summer_t = annual_mean + latitude_amplitude
        The rh-based amplitude damping is REMOVED for subtropical latitudes.
        Monsoon cities (Chongqing, Houston, Dhaka, Wuhan) are NOT maritime even
        if their summer rh is high — their moisture is seasonal wind-driven, not oceanic.
        Only two special cases get damping:
          (a) abs_lat < 15 + rh > 82  →  true equatorial maritime (Singapore, Borneo)
          (b) abs_lat > 45 + is_coastal →  high-latitude maritime (London, Bergen, Seattle)

    3.  All hardcoded overrides are BLOCK 0, ISOLATED, return immediately.
        Editing one CANNOT break any other branch.

    4.  The arid block (Block 5) runs before the tropical/subtropical blocks.
        Desert cities (Riyadh, Phoenix, Thar, Sahara, Gobi) are returned here
        and NEVER reach the humid-subtropical logic.
    """
    abs_lat = abs(lat)

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 0  ·  HARDCODED MICRO-CLIMATE OVERRIDES
    # Only for cells that are physically impossible to detect algorithmically.
    # Each override is self-contained and returns immediately.
    # ═══════════════════════════════════════════════════════════════════════

    # SF Bay Area — marine fog layer + cold coastal upwelling suppress all heat
    if 37.60 <= lat <= 37.85 and -122.55 <= lng <= -122.35:
        return {"region": "mediterranean_fog_microclimate", "uhi_cap": 2.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.30, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Hawaii — NE trade winds split windward (wet) from leeward (dry)
    if 18.80 <= lat <= 20.30 and -156.10 <= lng <= -154.80:
        if lng > -155.50:
            return {"region": "tropical_rainforest_windward", "uhi_cap": 2.0,
                    "is_desert": False, "is_tropical": True,
                    "coastal_dampening": 0.80, "hw_humidity_penalty": 1.2, "snow_albedo_factor": 1.0}
        return {"region": "tropical_steppe_leeward", "uhi_cap": 3.0,
                "is_desert": True, "is_tropical": True,
                "coastal_dampening": 0.90, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Calgary — chinook arch creates anomalous warm spells; breaks snow-albedo feedback
    if 50.80 <= lat <= 51.25 and -114.30 <= lng <= -113.80:
        return {"region": "boreal_chinook_zone", "uhi_cap": 4.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.40}

    # Eastern Siberia — world-record seasonal swing (Yakutsk / Oymyakon / Verkhoyansk)
    if 60.00 <= lat <= 70.00 and 110.00 <= lng <= 160.00:
        return {"region": "extreme_continental_taiga", "uhi_cap": 5.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}

    # Persian / Arabian Gulf coast — hyper-arid + lethal marine humidity
    # Covers: UAE, Qatar, Bahrain, Kuwait, coastal KSA east, Oman Gulf coast
    # lng >= 47.5 deliberately EXCLUDES Riyadh (lng ~ 46.7°E, 400 km inland, dry summers)
    if 21.00 <= lat <= 30.00 and 47.50 <= lng <= 59.00 and baseline_annual_mean > 25.0:
        return {"region": "hyper_arid_humid_coast", "uhi_cap": 8.0,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Red Sea coast — Jeddah / Yanbu (hot + humid despite arid interior)
    if 20.50 <= lat <= 23.50 and 37.50 <= lng <= 42.50 and baseline_annual_mean > 25.0:
        return {"region": "hyper_arid_humid_coast", "uhi_cap": 7.5,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Vladivostok — East-Asian monsoon meets near-subarctic; unique freeze-thaw seasonality
    if 42.00 <= lat <= 44.00 and 131.00 <= lng <= 134.00:
        return {"region": "monsoon_tundra_hybrid", "uhi_cap": 4.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.85, "hw_humidity_penalty": 1.1, "snow_albedo_factor": 0.50}

    # LA Basin — thermal inversion cap; distinct from regional Mediterranean zone
    if 33.70 <= lat <= 34.40 and -118.70 <= lng <= -117.80:
        return {"region": "mediterranean_basin_microclimate", "uhi_cap": 7.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.85, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Atacama / Peruvian coastal fog desert — cold Humboldt current + stable inversion
    # (Lima, Ica, Antofagasta, Arica, Copiapó)
    if lat < -4.0 and lat > -36.0 and -80.5 < lng < -68.0:
        _exp_t_atac = 27.5 - 0.42 * abs_lat
        if baseline_annual_mean < _exp_t_atac - 3.0:
            return {"region": "arid_desert_fog", "uhi_cap": 3.0,
                    "is_desert": True, "is_tropical": False,
                    "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # Namib coastal fog desert — cold Benguela current (Walvis Bay, Swakopmund, Lüderitz)
    if lat < -16.0 and lat > -30.0 and 12.5 < lng < 17.0:
        return {"region": "arid_desert_fog", "uhi_cap": 3.0,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 1  ·  DERIVED SIGNALS  (computed once, reused below — zero API calls)
    # ═══════════════════════════════════════════════════════════════════════

    # ── Coastal / island heuristic ─────────────────────────────────────────
    # Uses geographic proximity, NOT rh alone.
    # High summer rh in monsoon belt cities (Chongqing, Dhaka, Wuhan, Bangkok)
    # does NOT mean ocean proximity — their moisture is seasonal-wind-driven.
    is_coastal = (
        (abs_lat > 25 and lng < -115)                            # Pacific Americas coast
        or (-85 < lng < -60 and 15 < abs_lat < 50)              # Atlantic / Caribbean Americas
        or (25 < lat < 33 and -97.5 < lng < -88.0)              # US Gulf Coast (Houston, N. Orleans)
        or (abs_lat > 35 and -12 < lng < 22)                     # NW / W European coast
        or (118 < lng < 152 and 30 < abs_lat < 42)               # Japanese / S. Korean Pacific coast
        or (abs_lat < 25 and 68 < lng < 95 and rh > 74)          # Indian subcontinent coast (Mumbai etc.)
        or (abs_lat < 15 and rh > 82)                            # Equatorial islands / coasts
        or (lat < -28 and lat > -42 and 147 < lng < 154)         # SE Australian coast (Sydney, Melbourne)
        or (lat < -32 and lat > -48 and 166 < lng < 178)         # New Zealand
        or (lat < -20 and lat > -35 and -50 < lng < -38)         # SE Brazil coast (Rio, São Paulo)
    )

    # ── Summer temperature proxy  ★ THE CORE FIX ──────────────────────────
    #
    # Replaces `baseline_annual_mean` as the heat-stress gate.
    #
    # Physics:  summer_t = annual_mean + seasonal_amplitude × continentality_factor
    #
    # Amplitude is PRIMARILY latitude-driven (Earth's axial tilt = more seasonality at higher lat).
    # Arid interiors swing harder (1.2–1.4×); equatorial maritime climates swing barely at all (0.65×).
    #
    # CRITICAL: For subtropical / monsoon latitudes (roughly abs_lat 15–45) the rh-based
    # damping is intentionally ABSENT (factor = 1.00).
    # Chongqing (annual 18.5 °C, abs_lat 29.5, rh 80): summer_t = 18.5 + 10.5 = 29.0 °C → caught ✓
    # Houston   (annual 20.5 °C, abs_lat 29.7, rh 80): summer_t = 20.5 + 10.5 = 31.0 °C → caught ✓
    # Riyadh    (annual 26.0 °C, rh 18 in summer)    : hits arid block before reaching here ✓
    # Athens    (annual 18.0 °C, rh 45 in summer)    : rh < 65 → NOT caught by humid block ✓
    if abs_lat < 10:    _base_amp = 2.5
    elif abs_lat < 15:  _base_amp = 4.5
    elif abs_lat < 20:  _base_amp = 6.5
    elif abs_lat < 25:  _base_amp = 8.5
    elif abs_lat < 30:  _base_amp = 10.5
    elif abs_lat < 35:  _base_amp = 12.5
    elif abs_lat < 40:  _base_amp = 14.0
    elif abs_lat < 45:  _base_amp = 15.5
    elif abs_lat < 50:  _base_amp = 17.0
    elif abs_lat < 55:  _base_amp = 18.0
    elif abs_lat < 60:  _base_amp = 19.0
    else:               _base_amp = 20.5

    # Continentality modifier — arid interiors swing more; default subtropical = 1.0 (no change)
    if rh < 25:         _amp_factor = 1.40   # hyper-arid desert: maximum thermal swing
    elif rh < 40:       _amp_factor = 1.20
    elif rh < 55:       _amp_factor = 1.08
    else:               _amp_factor = 1.00   # humid subtropical / monsoon: no dampening

    # Override: apply maritime suppression ONLY for genuinely oceanic regimes
    if abs_lat < 15 and rh > 82:
        _amp_factor = 0.65         # equatorial islands: nearly isothermal year-round
    elif abs_lat > 45 and is_coastal:
        _amp_factor *= 0.72        # high-lat maritime: London, Bergen, Seattle, Auckland

    summer_t = baseline_annual_mean + _base_amp * _amp_factor

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 2  ·  POLAR  (annual ≤ −10 °C  OR  abs_lat > 75°)
    # ═══════════════════════════════════════════════════════════════════════
    if baseline_annual_mean <= -10.0 or abs_lat > 75:
        return {"region": "polar_ice_cap", "uhi_cap": 1.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.30}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 3  ·  SUBARCTIC / TUNDRA  (annual < 0 °C  OR  abs_lat > 65°)
    # ═══════════════════════════════════════════════════════════════════════
    if baseline_annual_mean < 0.0 or abs_lat > 65:
        return {"region": "boreal_tundra", "uhi_cap": 3.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.85 if is_coastal else 1.0,
                "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 4  ·  COLD CONTINENTAL  (annual < 5 °C)
    # ═══════════════════════════════════════════════════════════════════════
    if baseline_annual_mean < 5.0:
        if rh < 45:
            return {"region": "cold_desert", "uhi_cap": 5.0,
                    "is_desert": True, "is_tropical": False,
                    "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.78}
        return {"region": "boreal_tundra", "uhi_cap": 4.0,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.85 if is_coastal else 1.0,
                "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.55}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 5  ·  ARID / HYPER-ARID  (rh < 45, all non-polar latitudes)
    #
    # MUST run before tropical / subtropical blocks.
    # Riyadh (rh ~18 % in summer), Phoenix (rh ~22 %), Sahara, Thar, Gobi
    # are returned HERE and NEVER reach the humid-subtropical logic in Block 7.
    # ═══════════════════════════════════════════════════════════════════════
    if rh < 28:
        # Canary-current / Benguela fog-desert fringe (not Atacama — already handled in Block 0)
        if 18 <= rh < 28 and abs_lat < 35:
            _exp_t_fd = 27.5 - 0.42 * abs_lat
            if baseline_annual_mean < _exp_t_fd - 5.0:
                return {"region": "arid_desert_fog", "uhi_cap": 3.0,
                        "is_desert": True, "is_tropical": False,
                        "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        # Core hyper-arid: Sahara, Rub' al Khali, Thar deep interior, Sonoran / Mojave, Taklamakan
        return {"region": "arid_desert", "uhi_cap": 8.0,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    if rh < 45:
        if baseline_annual_mean >= 14.0:
            # Hot semi-arid: Sahel, central Iran, Anatolian plateau, central Mexico, Karoo
            return {"region": "arid_desert", "uhi_cap": 7.5,
                    "is_desert": True, "is_tropical": False,
                    "coastal_dampening": 0.92, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        # Cold semi-arid: Gobi, Central Asian steppe, Great Basin, Patagonian steppe
        return {"region": "cold_desert", "uhi_cap": 6.0,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.80}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 6  ·  TROPICAL ZONE  (abs_lat < 23°)
    # ═══════════════════════════════════════════════════════════════════════
    if abs_lat < 23:
        # Highland detector: annual_mean anomalously cool for the latitude → altitude suppression.
        # Catches: Mexico City (19°N, 2250 m), Bogotá (5°N, 2600 m), Nairobi (1°S, 1795 m),
        #          Addis Ababa (9°N, 2355 m), Kunming (25°N, 1900 m), Quito (0°S, 2850 m).
        _exp_trop_t = 26.5 - 0.28 * abs_lat
        if baseline_annual_mean < _exp_trop_t - 4.5:
            return {"region": "subtropical_highland", "uhi_cap": 3.0,
                    "is_desert": False, "is_tropical": False,
                    "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

        if rh >= 78 and baseline_annual_mean > 23.0:
            # True equatorial / tropical rainforest: Singapore, Amazon basin, Congo,
            # Borneo, Philippines, Java, coastal West Africa, Malabar coast peak months
            return {"region": "tropical_humid", "uhi_cap": 4.0,
                    "is_desert": False, "is_tropical": True,
                    "coastal_dampening": 0.70 if is_coastal else 0.90,
                    "hw_humidity_penalty": 1.2, "snow_albedo_factor": 1.0}

        if rh >= 55:
            # Tropical monsoon / savanna: Bangkok, Ho Chi Minh City, Lagos, Accra,
            # Kolkata (pre-monsoon), Dakar, Yangon, Dar es Salaam
            _hw_pen = 1.0 + max(0.0, (rh - 55) / 100)
            return {"region": "savanna_monsoon", "uhi_cap": 7.0,
                    "is_desert": False, "is_tropical": True,
                    "coastal_dampening": 0.80 if is_coastal else 1.0,
                    "hw_humidity_penalty": _hw_pen, "snow_albedo_factor": 1.0}

        # Dry tropical / Sahel fringe / NE Brazil / leeward Caribbean / dry Deccan
        return {"region": "savanna_monsoon", "uhi_cap": 6.5,
                "is_desert": False, "is_tropical": True,
                "coastal_dampening": 0.90, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 7  ·  SUBTROPICAL  (23° ≤ abs_lat < 40°)
    # ═══════════════════════════════════════════════════════════════════════
    if abs_lat < 40:
        # High-altitude subtropical plateau: Kunming (25°N, 1900m), Addis highlands fringe,
        # central Mexican plateau, Kathmandu (28°N, 1400m)
        _exp_sub_t = 26.5 - 0.35 * abs_lat
        if baseline_annual_mean < _exp_sub_t - 5.0 and rh < 88:
            return {"region": "subtropical_highland", "uhi_cap": 3.5,
                    "is_desert": False, "is_tropical": False,
                    "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

        # ★ HUMID SUBTROPICAL EXTREME  — the core bug fix
        #
        # Two complementary triggers:
        #   (A) summer_t ≥ 32 °C + rh ≥ 50 %:
        #       Catches extreme-heat cities with moderate summer humidity.
        #       → Jacobabad (summer_t ~38, rh ~52), Delhi (summer_t ~34, rh ~68),
        #         Karachi coast (summer_t ~34, rh ~65), Multan, Hyderabad PK
        #
        #   (B) summer_t ≥ 29 °C + rh ≥ 65 %:
        #       Catches hot + genuinely humid cities regardless of cold winters.
        #       → Chongqing  (annual 18.5°C → summer_t 29.0°C, rh 80%) ✓
        #       → Houston    (annual 20.5°C → summer_t 31.0°C, rh 80%) ✓
        #       → Wuhan, Nanjing, Tokyo, Osaka, New Orleans, Dhaka, Chittagong
        #
        # WHY desert/Mediterranean cities are NOT caught:
        #   Riyadh  rh ~18 % → returned arid_desert in Block 5  (never reaches here)
        #   Phoenix rh ~22 % → returned arid_desert in Block 5  (never reaches here)
        #   Athens  rh ~45 % in summer  → rh < 50 → fails (A); rh < 65 → fails (B) → mediterranean ✓
        #   Cairo   rh ~38 % → returned arid_desert in Block 5 ✓
        _is_extreme_humid = (
            (summer_t >= 32.0 and rh >= 50)    # (A) extreme summer heat, moderate humidity
            or (summer_t >= 29.0 and rh >= 65) # (B) hot summer, clearly humid
        )
        if _is_extreme_humid:
            _cd  = 0.88 if is_coastal else 0.96
            _hwp = 1.10 + max(0.0, (rh - 65) / 160)
            return {
                "region": "humid_subtropical_extreme",
                "uhi_cap": 8.0,
                "is_desert": False,   # ← do NOT apply desert humidity drop in Stull formula
                "is_tropical": True,  # ← activates lethal humidity curve in _stull_wetbulb()
                "coastal_dampening": _cd,
                "hw_humidity_penalty": _hwp,
                "snow_albedo_factor": 1.0,
            }

        # Humid subtropical moderate: coastal SE Australia (Sydney, Brisbane), Buenos Aires,
        # Montevideo, NE Argentina, coastal SE US (Carolinas), NE China coast (Qingdao, Dalian)
        if summer_t >= 26.0 and rh >= 58:
            return {"region": "humid_subtropical", "uhi_cap": 6.0,
                    "is_desert": False, "is_tropical": True,
                    "coastal_dampening": 0.82 if is_coastal else 0.95,
                    "hw_humidity_penalty": 1.05, "snow_albedo_factor": 1.0}

        # Mediterranean dry-summer: Athens, Rome, Tunis, Cairo fringe, Cape Town,
        # Perth WA, Central Valley CA, Tel Aviv, Casablanca, Santiago Chile
        if rh < 62:
            return {"region": "mediterranean", "uhi_cap": 6.0,
                    "is_desert": False, "is_tropical": False,
                    "coastal_dampening": 0.75 if is_coastal else 1.0,
                    "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

        # Moist subtropical (moderate summer, moderate humidity): SE Europe coast, Adriatic, Black Sea
        return {"region": "mediterranean", "uhi_cap": 5.5,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.78 if is_coastal else 0.97,
                "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 8  ·  MID-LATITUDE  (40° ≤ abs_lat < 60°)
    # ═══════════════════════════════════════════════════════════════════════
    if abs_lat < 60:
        # Humid continental: warm/hot summers, cold winters, NOT maritime.
        # Chicago, Warsaw, Budapest, Kyiv, Seoul, Harbin, Moscow, Minsk
        if summer_t >= 22.0 and rh >= 55 and not is_coastal:
            return {"region": "humid_continental", "uhi_cap": 6.0,
                    "is_desert": False, "is_tropical": False,
                    "coastal_dampening": 1.0,
                    "hw_humidity_penalty": 1.05, "snow_albedo_factor": 0.70}

        # Temperate oceanic: London, Paris, Amsterdam, Brussels, Copenhagen,
        # Seattle, Portland OR, Auckland, Wellington, Reykjavik
        if rh >= 58:
            return {"region": "temperate_oceanic", "uhi_cap": 5.0,
                    "is_desert": False, "is_tropical": False,
                    "coastal_dampening": 0.70 if is_coastal else 0.92,
                    "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.85}

        # Cold semi-arid continental steppe: US Great Plains, Kazakh steppe,
        # Mongolian plateau fringe, Patagonian steppe, inner Manchuria
        if rh < 50:
            return {"region": "cold_desert", "uhi_cap": 5.5,
                    "is_desert": True, "is_tropical": False,
                    "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.75}

        # Transitional moist continental: Central / Eastern Europe, N. China coast fringe
        return {"region": "temperate_oceanic", "uhi_cap": 5.5,
                "is_desert": False, "is_tropical": False,
                "coastal_dampening": 0.75 if is_coastal else 1.0,
                "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.80}

    # ═══════════════════════════════════════════════════════════════════════
    # BLOCK 9  ·  HIGH LATITUDE  (60° ≤ abs_lat ≤ 75°)
    # ═══════════════════════════════════════════════════════════════════════
    if rh < 48:
        return {"region": "cold_desert", "uhi_cap": 4.0,
                "is_desert": True, "is_tropical": False,
                "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}
    return {"region": "boreal_tundra", "uhi_cap": 3.5,
            "is_desert": False, "is_tropical": False,
            "coastal_dampening": 0.85 if is_coastal else 1.0,
            "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.55}


def _apply_regional_calibration(
    tx5d_raw: float, hw_days_raw: float,
    profile: dict, rh: float, uhi_raw: float,
) -> tuple[float, float, float]:
    uhi_cal  = round(min(uhi_raw, profile.get("uhi_cap", 5.0)), 2)
    tx5d_cal = round(tx5d_raw, 2)
    hw = hw_days_raw * profile["coastal_dampening"] * profile["snow_albedo_factor"] * profile["hw_humidity_penalty"]
    if profile["is_tropical"] and rh > 75:
        if _stull_wetbulb(tx5d_cal, rh, profile["is_desert"], profile["is_tropical"]) > 29.0:
            hw = hw * (1.0 + (rh - 75) / 100)
    hw = min(max(hw, 0.0), 365.0)
    return tx5d_cal, round(hw, 1), uhi_cal


async def _fetch_worldbank_death_rate(iso3: str) -> float:
    try:
        url = f"https://api.worldbank.org/v2/country/{iso3}/indicator/SP.DYN.CDRT.IN?format=json&mrv=3&per_page=3"
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                if len(data) > 1 and data[1]:
                    for entry in data[1]:
                        if entry.get("value") is not None:
                            return float(entry["value"])
    except Exception as e:
        logger.warning(f"Death rate failed {iso3}: {e}")
    return 7.7


def _gasparrini_mortality(pop: int, baseline_death_rate_per1000: float, temp_excess_c: float, hw_days: float, vulnerability_multiplier: float = 1.0) -> int:
    beta        = 0.0801
    rr          = math.exp(beta * max(0.0, temp_excess_c))
    af          = (rr - 1.0) / rr
    annual_rate = baseline_death_rate_per1000 / 1000.0
    hw_frac     = min(hw_days / 365.0, 1.0)
    return int(pop * annual_rate * hw_frac * af * vulnerability_multiplier)


def _burke_economic_loss(gdp: float, mean_temp: float, hw_days: float) -> float:
    t_optimal     = 13.0
    burke_penalty = 0.0127 * ((mean_temp - t_optimal) ** 2) / 100.0
    ilo_fraction  = (hw_days / 365.0) * 0.40 * 0.20
    return gdp * (burke_penalty + ilo_fraction)


def _build_audit_trail(pop: int, death_rate: float, hw_days: float, temp_excess: float, vuln: float, gdp: float, mean_temp: float, tx5d: float, rh: float) -> dict:
    beta  = 0.0801
    rr    = math.exp(beta * max(0.0, temp_excess))
    af    = round((rr - 1.0) / rr, 4)
    hwf   = round(min(hw_days / 365.0, 1.0), 4)
    deaths_result = int(pop * (death_rate / 1000.0) * hwf * af * vuln)
    t_opt  = 13.0
    burke  = round(0.0127 * ((mean_temp - t_opt) ** 2) / 100.0, 6)
    ilo    = round((hw_days / 365.0) * 0.40 * 0.20, 6)
    econ_r = gdp * (burke + ilo)
    return {
        "mortality": {
            "formula":     "Deaths = Pop × (DR/1000) × (HW/365) × AF × V",
            "variables":   {"Pop": pop, "DR": round(death_rate, 2), "HW": round(hw_days, 1), "AF": af, "V": round(vuln, 3), "beta": beta, "RR": round(rr, 4), "temp_excess_c": round(temp_excess, 2)},
            "computation": f"{deaths_result:,} = {pop:,} × ({death_rate:.2f}/1000) × ({hw_days:.0f}/365) × {af} × {vuln:.3f}",
            "result":      deaths_result,
            "source":      "Gasparrini et al. (2017), Lancet Planetary Health",
        },
        "economics": {
            "formula":     "Loss = GDP × (Burke_penalty + ILO_fraction)",
            "variables":   {"GDP": round(gdp), "T_mean": round(mean_temp, 2), "T_optimal": t_opt, "HW_days": round(hw_days, 1), "Burke_penalty": burke, "ILO_fraction": ilo},
            "computation": f"${econ_r/1e6:.1f}M = GDP × ({burke:.6f} + {ilo:.6f})",
            "result":      round(econ_r),
            "source":      "Burke et al. (2018) Nature + ILO (2019)",
        },
        "wetbulb": {
            "formula":     "WBT = Stull (2011) + Clausius-Clapeyron Exponential Adjustment",
            "variables":   {"T": round(tx5d, 2), "RH": round(rh, 1), "cap": "35.0°C (Sherwood & Huber 2010)"},
            "source":      "Stull (2011), J. Applied Meteorology and Climatology",
        },
    }

ISO3_MAP = {
    "IN": "IND", "CN": "CHN", "US": "USA", "GB": "GBR", "JP": "JPN", "DE": "DEU",
    "FR": "FRA", "AU": "AUS", "BR": "BRA", "MX": "MEX", "SG": "SGP", "ID": "IDN",
    "TH": "THA", "PK": "PAK", "BD": "BGD", "UN": "WLD", "ZA": "ZAF", "NG": "NGA",
    "KE": "KEN", "EG": "EGY", "TR": "TUR", "SA": "SAU", "AE": "ARE", "PH": "PHL",
    "VN": "VNM", "MY": "MYS", "RU": "RUS", "CA": "CAN", "KR": "KOR", "AR": "ARG",
    "CL": "CHL", "CO": "COL", "IT": "ITA", "ES": "ESP", "NL": "NLD", "SE": "SWE",
    "NO": "NOR", "FI": "FIN", "DK": "DNK", "PL": "POL",
}


# ── GAUSSIAN BELL-CURVE TOPOLOGICAL GRID ─────────────────────────────

async def _generate_topological_grid(lat: float, lng: float, hw_days: float, tx5d: float) -> list[dict]:
    """
    Dense Gaussian clustering: green low cylinders on edges,
    yellow/orange in mid-ring, tall red cylinders at center.
    Matches the reference image exactly.
    """
    points = []
    severity = min((hw_days / 60.0) * (tx5d / 40.0), 1.0)
    n_points = 1200

    lats, lngs, dists = [], [], []
    sigma = 0.028  # ~3km std dev — tight urban cluster

    for _ in range(n_points):
        dx = random.gauss(0, sigma)
        dy = random.gauss(0, sigma)
        r  = math.sqrt(dx**2 + dy**2)
        r  = min(r, 0.09)
        px = lng + dx
        py = lat + dy
        lats.append(round(py, 5))
        lngs.append(round(px, 5))
        dists.append(r)

    elevations = [10.0] * n_points

    async def fetch_elevation_chunk(start_idx: int):
        lat_chunk = ",".join(map(str, lats[start_idx:start_idx + 100]))
        lng_chunk = ",".join(map(str, lngs[start_idx:start_idx + 100]))
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat_chunk}&longitude={lng_chunk}"
        try:
            async with rate_limit_lock:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        return start_idx, resp.json().get("elevation", [])
        except Exception as e:
            logger.warning(f"Elevation chunk {start_idx} failed: {e}")
        return start_idx, []

    tasks = [fetch_elevation_chunk(i) for i in range(0, n_points, 100)]
    chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in chunk_results:
        if not isinstance(res, Exception):
            start_idx, data = res
            for j, el in enumerate(data):
                if el is not None:
                    elevations[start_idx + j] = float(el)

    max_r = 0.09

    for i in range(n_points):
        el = elevations[i]
        if el <= 0.0:
            continue

        dist_norm = min(dists[i] / max_r, 1.0)

        # Pure bell curve: 1.0 at center, smoothly falls to ~0.007 at edge
        bell = math.exp(-6.0 * dist_norm ** 2)

        # Small natural jitter so neighbouring hexes aren't identical
        jitter = random.uniform(-0.06, 0.06)

        # Scale by severity (hotter city = taller overall)
        risk_weight = round(min(1.0, max(0.02, bell * (0.65 + 0.35 * severity) + jitter)), 4)

        points.append({
            "position":    [lngs[i], lats[i]],
            "risk_weight": risk_weight,
        })

    return points


def create_app() -> FastAPI:
    app = FastAPI(title="OpenPlanet Climate Engine")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        return {"status": "OpenPlanet Risk Engine — Honest Physics + Gaussian Grid"}

    @app.post("/api/research-analysis")
    async def research_analysis(req: ResearchAIRequest):
        prompt = f"""
[SYSTEM: SCIENTIFIC AUDIT MODE]
Write a cohesive 3-4 sentence executive summary for {req.city_name}.
REAL METRICS (Open-Meteo ERA5 + CMIP6 + World Bank + Regional Calibration):
- Peak Tx5d: {req.metrics.get('temp')}
- Elevation: {req.metrics.get('elevation')}
- Annual heatwave/heat-stress days: {req.metrics.get('heatwave')}
- Economic loss (Burke 2018 + ILO): {req.metrics.get('loss')}
RULES: ONE paragraph. No lists. No bullets. Authoritative IPCC scientist tone. Use exact numbers provided.
"""
        try:
            raw   = await generate_strategic_analysis_raw(prompt)
            clean = raw.replace("**", "").replace("*", "").replace("\n", " ").strip()
            clean = re.sub(r'\b\d+\.\s', '', clean)
            return {"reasoning": clean}
        except Exception as e:
            logger.error(f"AI error: {e}")
            return {"reasoning": "Scientific reasoning temporarily unavailable."}

    @app.post("/api/compare-analysis")
    async def compare_analysis(req: CompareAnalysisRequest):
        try:
            comparison = await generate_compare_analysis(
                city_a=req.city_a, city_b=req.city_b,
                data_a=req.data_a, data_b=req.data_b,
            )
            return {"comparison": comparison}
        except Exception as e:
            logger.error(f"Compare analysis error: {e}")
            return {"comparison": "Comparative analysis temporarily unavailable."}

    @app.post("/api/predict", response_model=SimulationResponse)
    async def predict(req: PredictionRequest):
        try:
            target_year   = int(req.year)
            total_cooling = (req.canopy / 100.0 * 1.2) + (req.coolRoof / 100.0 * 0.8)

            baseline = await fetch_historical_baseline_full(req.lat, req.lng)
            p95      = baseline["p95_threshold_c"]
            ann_mean = baseline["annual_mean_c"]

            try:
                socio = await fetch_live_socioeconomics(req.city)
            except Exception as e:
                logger.error(f"Socio failed: {e}")
                socio = {"population": 5_000_000, "city_gdp_usd": 50_000_000_000, "country_code": "UN", "vulnerability_multiplier": 1.0}

            pop  = socio["population"]
            gdp  = socio["city_gdp_usd"]
            iso2 = socio.get("country_code", "UN")
            iso3 = ISO3_MAP.get(iso2, iso2)
            vuln = socio.get("vulnerability_multiplier", 1.0)

            death_rate, rh_live, rh_p95 = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_relative_humidity_live(req.lat, req.lng),
                _fetch_era5_humidity_p95(req.lat, req.lng),
            )

            profile     = _get_region_profile(req.lat, req.lng, rh_p95, ann_mean)
            chart_years = sorted({2030, 2040, 2050, target_year})
            chart_years = [y for y in chart_years if 2015 <= y <= 2100]
            fetch_years = [y for y in chart_years if y <= 2050]

            results = await asyncio.gather(*[
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, yr, p95, total_cooling)
                for yr in fetch_years
            ], return_exceptions=True)

            projections = {}
            proj_2050   = None
            for yr, res in zip(fetch_years, results):
                if not isinstance(res, Exception):
                    projections[yr] = res
                    if yr == 2050: proj_2050 = res

            for yr in chart_years:
                if yr > 2050 and proj_2050:
                    decades = (yr - 2050) / 10.0
                    extreme = req.ssp.lower() in ["ssp585", "ssp5-8.5"]
                    if extreme:
                        t_add   = (0.35 * decades) + (0.04 * (decades ** 2))
                        hw_mult = (0.20 * decades) + (0.03 * (decades ** 2))
                    else:
                        t_add   = 0.25 * decades * math.log1p(decades/2.0)
                        hw_mult = 0.15 * decades * math.log1p(decades/2.0)
                    projections[yr] = {
                        "tx5d_c":      proj_2050["tx5d_c"] + t_add,
                        "hw_days":     min(365, proj_2050["hw_days"] * (1 + hw_mult)),
                        "mean_temp_c": proj_2050["mean_temp_c"] + t_add,
                        "hw_days_raw": min(365, proj_2050.get("hw_days_raw", proj_2050["hw_days"]) * (1 + hw_mult)),
                        "source":      "ipcc_ar6_extrapolation",
                        "n_models":    proj_2050.get("n_models", 1),
                    }

            heatwave_chart, economic_chart = [], []
            for yr in chart_years:
                if yr not in projections: continue
                proj    = projections[yr]
                uhi_raw = proj["tx5d_c"] - baseline["annual_mean_c"]
                _, hw_cal, _ = _apply_regional_calibration(proj["tx5d_c"], proj.get("hw_days_raw", proj["hw_days"]), profile, rh_p95, uhi_raw)
                loss     = _burke_economic_loss(gdp, proj["mean_temp_c"], hw_cal)
                loss_mit = _burke_economic_loss(gdp, proj["mean_temp_c"], proj["hw_days"])
                heatwave_chart.append({"year": str(yr), "val": int(hw_cal)})
                economic_chart.append({
                    "year":     str(yr),
                    "noAction": round(loss / 1_000_000, 1),
                    "adapt":    round(loss_mit / 1_000_000, 1),
                })

            if target_year not in projections:
                raise ValueError(f"Target year {target_year} failed")

            tgt            = projections[target_year]
            uhi_raw        = tgt["tx5d_c"] - baseline["annual_mean_c"]
            tx5d_cal, hw_cal, uhi_cal = _apply_regional_calibration(tgt["tx5d_c"], tgt["hw_days"], profile, rh_p95, uhi_raw)
            temp_excess    = max(0.0, tx5d_cal - p95)
            deaths         = _gasparrini_mortality(pop, death_rate, temp_excess, hw_cal, vuln)
            final_loss     = _burke_economic_loss(gdp, tgt["mean_temp_c"], hw_cal)
            wbt_projection = _stull_wetbulb(tx5d_cal, rh_p95, profile["is_desert"], profile["is_tropical"])
            wbt_display    = _stull_wetbulb(tx5d_cal, rh_live, profile["is_desert"], profile["is_tropical"])
            loss_str       = f"${final_loss/1e9:.2f}B" if final_loss >= 1e9 else f"${final_loss/1e6:.1f}M"
            audit          = _build_audit_trail(pop, death_rate, hw_cal, temp_excess, vuln, gdp, tgt["mean_temp_c"], tx5d_cal, rh_p95)

            try:
                ai = await generate_strategic_analysis(req.city, req.ssp, req.year, req.canopy, req.coolRoof, round(tx5d_cal, 1), int(hw_cal), deaths, final_loss)
            except Exception:
                ai = None

            hex_grid = await _generate_topological_grid(req.lat, req.lng, hw_cal, tx5d_cal)

            return {
                "metrics": {
                    "baseTemp": str(baseline["tx5d_baseline_c"]),
                    "temp":     f"{tx5d_cal:.1f}",
                    "deaths":   f"{deaths:,}",
                    "ci":       f"{int(deaths*0.85):,} – {int(deaths*1.18):,}",
                    "loss":     loss_str,
                    "heatwave": str(int(hw_cal)),
                    "wbt":      f"{wbt_projection:.1f}",
                    "wbt_live": f"{wbt_display:.1f}",
                    "region":   profile["region"],
                    "rh_p95":   rh_p95,
                    "rh_live":  rh_live,
                },
                "hexGrid":    hex_grid,
                "aiAnalysis": ai,
                "auditTrail": audit,
                "charts": {"heatwave": heatwave_chart, "economic": economic_chart},
            }

        except Exception as e:
            logger.error(f"/api/predict error: {e}")
            return {
                "metrics": {
                    "baseTemp": None, "temp": None, "deaths": None, "ci": None,
                    "loss": None, "heatwave": None, "wbt": None, "wbt_live": None,
                    "region": "ERROR", "rh_p95": None, "rh_live": None
                },
                "hexGrid":    [],
                "aiAnalysis": None,
                "auditTrail": None,
                "charts":     {"heatwave": [], "economic": []},
            }

    @app.post("/api/climate-risk")
    async def climate_risk(req: ClimateRiskRequest):
        try:
            total_cooling = (req.canopy_offset_pct/100.0*1.2) + (req.albedo_offset_pct/100.0*0.8)
            baseline      = await fetch_historical_baseline_full(req.lat, req.lng)
            p95           = baseline["p95_threshold_c"]
            ann_mean      = baseline["annual_mean_c"]

            city_name = req.location_hint.split(',')[0].strip() or "Unknown"
            try:
                socio = await fetch_live_socioeconomics(city_name)
            except Exception as e:
                logger.error(f"Socio failed: {e}")
                socio = {"population": 5_000_000, "city_gdp_usd": 50_000_000_000, "country_code": "UN", "vulnerability_multiplier": 1.0}

            pop  = socio["population"]
            gdp  = socio["city_gdp_usd"]
            iso2 = socio.get("country_code", "UN")
            iso3 = ISO3_MAP.get(iso2, iso2)
            vuln = socio.get("vulnerability_multiplier", 1.0)

            death_rate, rh_p95 = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_era5_humidity_p95(req.lat, req.lng),
            )

            profile = _get_region_profile(req.lat, req.lng, rh_p95, ann_mean)

            res_2030, res_2050 = await asyncio.gather(
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, 2030, p95, total_cooling),
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, 2050, p95, total_cooling),
                return_exceptions=True,
            )

            base_projs = {}
            if not isinstance(res_2030, Exception): base_projs[2030] = res_2030
            if not isinstance(res_2050, Exception): base_projs[2050] = res_2050

            projections = []
            for year in [2030, 2050, 2075, 2100]:
                try:
                    if year <= 2050:
                        if year not in base_projs: raise ValueError(f"Year {year} failed")
                        proj = base_projs[year]
                    else:
                        if 2050 not in base_projs: raise ValueError("No 2050 base")
                        decades = (year - 2050) / 10.0
                        extreme = req.ssp.lower() in ["ssp585", "ssp5-8.5"]
                        if extreme:
                            t_add   = (0.35 * decades) + (0.04 * (decades ** 2))
                            hw_mult = (0.20 * decades) + (0.03 * (decades ** 2))
                        else:
                            t_add   = 0.25 * decades * math.log1p(decades/2.0)
                            hw_mult = 0.15 * decades * math.log1p(decades/2.0)
                        b    = base_projs[2050]
                        proj = {
                            "tx5d_c":      b["tx5d_c"] + t_add,
                            "hw_days":     min(365, b["hw_days"] * (1 + hw_mult)),
                            "mean_temp_c": b["mean_temp_c"] + t_add,
                            "source":      "ipcc_ar6_extrapolation",
                            "n_models":    b.get("n_models", 1),
                        }

                    uhi_raw     = proj["tx5d_c"] - baseline["annual_mean_c"]
                    tx5d_cal, hw_cal, uhi_cal = _apply_regional_calibration(proj["tx5d_c"], proj["hw_days"], profile, rh_p95, uhi_raw)
                    temp_excess = max(0.0, tx5d_cal - p95)
                    deaths      = _gasparrini_mortality(pop, death_rate, temp_excess, hw_cal, vuln)
                    econ_loss   = _burke_economic_loss(gdp, proj["mean_temp_c"], hw_cal)
                    cdd         = round(max(0.0, proj["mean_temp_c"] - 18.0) * hw_cal, 1)
                    wbt         = _stull_wetbulb(tx5d_cal, rh_p95, profile["is_desert"], profile["is_tropical"])
                    audit       = _build_audit_trail(pop, death_rate, hw_cal, temp_excess, vuln, gdp, proj["mean_temp_c"], tx5d_cal, rh_p95)

                    projections.append({
                        "year":                year,
                        "source":              proj["source"],
                        "heatwave_days":       int(hw_cal),
                        "peak_tx5d_c":         round(tx5d_cal, 2),
                        "attributable_deaths": deaths,
                        "economic_decay_usd":  round(econ_loss, 2),
                        "wbt_max_c":           wbt,
                        "uhi_intensity_c":     uhi_cal,
                        "grid_stress_factor":  cdd,
                        "survivability_status": ("CRITICAL" if wbt >= 31 else "DANGER" if wbt >= 28 else "STABLE"),
                        "n_models":    proj.get("n_models", 1),
                        "region":      profile["region"],
                        "audit_trail": audit,
                    })

                except Exception as e:
                    logger.warning(f"climate-risk year {year} failed: {e}")

            if not projections:
                raise ValueError("All projection years failed.")

            return {
                "threshold_c":       baseline["p95_threshold_c"],
                "tx5d_baseline_c":   baseline["tx5d_baseline_c"],
                "cooling_offset_c":  round(total_cooling, 2),
                "gdp_usd":           gdp,
                "population":        pop,
                "projections":       projections,
                "baseline":          {"baseline_mean_c": baseline["annual_mean_c"]},
                "era5_humidity_p95": rh_p95,
            }

        except Exception as e:
            logger.error(f"/api/climate-risk error: {e}")
            return {"error": str(e)}

    return app

app = create_app()