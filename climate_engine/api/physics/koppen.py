"""
climate_engine/api/physics/koppen.py — True Köppen-Geiger classification.

Implements the canonical Köppen-Geiger algorithm from 12 monthly mean
temperature (°C) and 12 monthly precipitation totals (mm). This is the same
formulation used by:

  [Peel2007]  Peel, Finlayson & McMahon (2007) Hydrol. Earth Syst. Sci. 11:1633
              DOI:10.5194/hess-11-1633-2007  (Table 1 — updated world map)
  [Beck2018]  Beck et al. (2018) Sci. Data 5:180214  DOI:10.1038/sdata.2018.214
              (1-km present-day map; uses the 0 °C C/D coldest-month boundary)

Unlike a latitude+humidity heuristic, this uses the precipitation seasonality
that *defines* the Köppen classes, so dry-summer Mediterranean cities (Lisbon,
Cape Town → Cs) are no longer mislabelled as oceanic/continental.

The monthly normals are sourced from ERA5 (Open-Meteo Archive API) over the
WMO 2011–2020 reference decade — the same climatology used for the temperature
baseline, so the classification is internally consistent with the rest of the
engine. The classifier itself is a pure function and fully unit-testable
offline.
"""
from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from .climate_intelligence import (
    KoppenMacro,
    ClimateIntelligence,
    classify_climate_intelligence,
    _TROPICAL_HUMID,
    _TROPICAL_SAVANNA,
    _ARID_HOT_DESERT,
    _ARID_HOT_STEPPE,
    _MEDITERRANEAN,
    _TEMPERATE_OCEANIC,
    _CONTINENTAL_HUMID,
    _BOREAL,
    _POLAR,
)

logger = logging.getLogger(__name__)


# ── Core algorithm ─────────────────────────────────────────────────────────────

def classify_koppen(
    monthly_tmean: List[float],
    monthly_precip: List[float],
    southern_hemisphere: bool = False,
) -> str:
    """
    Return the precise Köppen-Geiger class (e.g. 'Csa', 'BWh', 'Af', 'Dfc').

    Parameters
    ----------
    monthly_tmean : list[float]
        12 monthly mean temperatures in °C, index 0 = January.
    monthly_precip : list[float]
        12 monthly precipitation totals in mm, index 0 = January.
    southern_hemisphere : bool
        True if the location is south of the equator. Determines which half of
        the year counts as "summer" for the dry-season tests.

    Algorithm follows Peel et al. (2007) Table 1 with the Beck et al. (2018)
    0 °C coldest-month boundary between temperate (C) and continental (D).
    """
    if len(monthly_tmean) != 12 or len(monthly_precip) != 12:
        raise ValueError("Köppen classification requires exactly 12 monthly values.")

    t = [float(x) for x in monthly_tmean]
    p = [max(0.0, float(x)) for x in monthly_precip]

    mat = sum(t) / 12.0          # mean annual temperature
    mapr = sum(p)                # mean annual precipitation
    t_cold = min(t)              # coldest-month mean temperature
    t_hot = max(t)               # warmest-month mean temperature
    p_dry = min(p)               # driest-month precipitation
    n_above_10 = sum(1 for x in t if x >= 10.0)

    # Summer = warm half-year. Northern hemisphere: Apr–Sep; Southern: Oct–Mar.
    if not southern_hemisphere:
        summer_idx = [3, 4, 5, 6, 7, 8]      # Apr–Sep
        winter_idx = [9, 10, 11, 0, 1, 2]    # Oct–Mar
    else:
        summer_idx = [9, 10, 11, 0, 1, 2]
        winter_idx = [3, 4, 5, 6, 7, 8]

    p_summer = sum(p[i] for i in summer_idx)
    p_winter = sum(p[i] for i in winter_idx)
    ps_min = min(p[i] for i in summer_idx)
    ps_max = max(p[i] for i in summer_idx)
    pw_min = min(p[i] for i in winter_idx)
    pw_max = max(p[i] for i in winter_idx)

    # ── B (arid) — precipitation threshold (Peel 2007) ────────────────────────
    if mapr > 0 and p_winter >= 0.70 * mapr:
        p_threshold = 2.0 * mat
    elif mapr > 0 and p_summer >= 0.70 * mapr:
        p_threshold = 2.0 * mat + 28.0
    else:
        p_threshold = 2.0 * mat + 14.0

    if mapr < 10.0 * p_threshold:
        first = "B"
        second = "W" if mapr < 5.0 * p_threshold else "S"
        third = "h" if mat >= 18.0 else "k"
        return first + second + third

    # ── A (tropical) — coldest month ≥ 18 °C ──────────────────────────────────
    if t_cold >= 18.0:
        if p_dry >= 60.0:
            return "Af"
        if p_dry >= 100.0 - (mapr / 25.0):
            return "Am"
        # Dry season in summer → As, otherwise Aw (As is rare; convention favours Aw)
        return "As" if (ps_min < pw_min) else "Aw"

    # ── E (polar) — warmest month < 10 °C ─────────────────────────────────────
    if t_hot < 10.0:
        return "ET" if t_hot > 0.0 else "EF"

    # ── C / D — temperate vs continental by coldest-month 0 °C (Beck 2018) ────
    main = "C" if t_cold >= 0.0 else "D"

    # Second letter: precipitation seasonality
    dry_summer = ps_min < 40.0 and ps_min < (pw_max / 3.0)
    dry_winter = pw_min < (ps_max / 10.0)
    if dry_summer and dry_winter:
        # Both criteria met — assign to the genuinely drier half-year.
        if p_summer <= p_winter:
            dry_winter = False
        else:
            dry_summer = False
    if dry_summer:
        second = "s"
    elif dry_winter:
        second = "w"
    else:
        second = "f"

    # Third letter: warm-season character
    if t_hot >= 22.0:
        third = "a"
    elif n_above_10 >= 4:
        third = "b"
    else:
        third = "c"
    # 'd' subtype: continental with extreme winter cold
    if main == "D" and t_cold < -38.0:
        third = "d"

    return main + second + third


# ── Code → main group / macro narrative mapping ────────────────────────────────

def koppen_main_group(code: str) -> str:
    """Return the first-letter main group ('A','B','C','D','E')."""
    return code[0] if code else ""


_MACRO_BY_CODE = {
    # Tropical
    "Af": _TROPICAL_HUMID, "Am": _TROPICAL_HUMID,
    "Aw": _TROPICAL_SAVANNA, "As": _TROPICAL_SAVANNA,
    # Mediterranean (dry-summer C)
    "Csa": _MEDITERRANEAN, "Csb": _MEDITERRANEAN, "Csc": _MEDITERRANEAN,
}

# Macro zones for everything else are resolved by main group + subtype below.


def koppen_to_macro(code: str) -> ClimateIntelligence:
    """
    Map a precise Köppen code to one of the nine narrative macro zones in
    climate_intelligence.py. The precise code remains the authoritative class;
    this mapping only selects the regional risk narrative.
    """
    if not code:
        return _TEMPERATE_OCEANIC

    if code in _MACRO_BY_CODE:
        return _MACRO_BY_CODE[code]

    g = code[0]
    if g == "A":
        return _TROPICAL_SAVANNA
    if g == "B":
        # BW* hot/cold desert; BS* steppe. Hot desert narrative for W, steppe for S.
        return _ARID_HOT_DESERT if len(code) > 1 and code[1] == "W" else _ARID_HOT_STEPPE
    if g == "E":
        return _POLAR
    if g == "C":
        return _MEDITERRANEAN if len(code) > 1 and code[1] == "s" else _TEMPERATE_OCEANIC
    if g == "D":
        # Subarctic 'c'/'d' third letter → boreal; warmer 'a'/'b' → humid continental.
        return _BOREAL if (len(code) == 3 and code[2] in ("c", "d")) else _CONTINENTAL_HUMID

    return _TEMPERATE_OCEANIC


# ── Live classification from ERA5 monthly normals ──────────────────────────────

async def fetch_era5_monthly_normals(
    lat: float,
    lng: float,
    client=None,
) -> Tuple[List[float], List[float]]:
    """
    Fetch 12-month temperature + precipitation normals from ERA5 (Open-Meteo
    Archive) over the WMO 2011–2020 reference decade.

    Returns
    -------
    (monthly_tmean, monthly_precip) : tuple[list[float], list[float]]
        Each a 12-element list, index 0 = January. Temperature in °C (decadal
        mean of daily means per calendar month); precipitation in mm (decadal
        mean of monthly totals).

    Raises ValueError if ERA5 returns insufficient data.
    """
    # Read from the shared, disk-cached ERA5 bundle (single archive call per city)
    # so Köppen classification adds no extra Open-Meteo request — essential under
    # Hugging Face free-tier rate limits.
    from climate_engine.services.cmip6_service import fetch_era5_bundle

    daily = await fetch_era5_bundle(lat, lng)

    times = daily.get("time", [])
    tmean = daily.get("temperature_2m_mean", [])
    precip = daily.get("precipitation_sum", [])
    if not times or not tmean:
        raise ValueError(f"ERA5 monthly normals unavailable for ({lat:.2f}, {lng:.2f})")

    # Aggregate daily → per (year, month), then average across the decade.
    temp_by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    precip_year_month: dict[Tuple[int, int], float] = {}
    precip_have: dict[Tuple[int, int], bool] = {}

    for i, t in enumerate(times):
        if not t:
            continue
        year = int(t[0:4])
        month = int(t[5:7])
        if i < len(tmean) and tmean[i] is not None:
            temp_by_month[month].append(float(tmean[i]))
        if i < len(precip) and precip[i] is not None:
            key = (year, month)
            precip_year_month[key] = precip_year_month.get(key, 0.0) + float(precip[i])
            precip_have[key] = True

    monthly_tmean: List[float] = []
    monthly_precip: List[float] = []
    for m in range(1, 13):
        vals = temp_by_month[m]
        if not vals:
            raise ValueError(
                f"ERA5 monthly normals: no temperature for month {m} at ({lat:.2f},{lng:.2f})"
            )
        monthly_tmean.append(sum(vals) / len(vals))
        # mean of the per-year monthly totals for this calendar month
        totals = [v for (yr, mo), v in precip_year_month.items() if mo == m]
        monthly_precip.append(sum(totals) / len(totals) if totals else 0.0)

    return monthly_tmean, monthly_precip


async def classify_koppen_live(
    lat: float,
    lng: float,
    client=None,
    ann_mean_c: Optional[float] = None,
    rh_p95: Optional[float] = None,
    p95_temp_c: Optional[float] = None,
) -> dict:
    """
    Classify a location's true Köppen class from ERA5 monthly normals and return
    both the precise code and the narrative macro zone.

    On ERA5 failure, falls back to the latitude+humidity heuristic
    (classify_climate_intelligence) when the annual stats are supplied — so the
    site stays up — but flags the lower-confidence source.
    """
    try:
        tmean, precip = await fetch_era5_monthly_normals(lat, lng, client=client)
        code = classify_koppen(tmean, precip, southern_hemisphere=(lat < 0))
        macro = koppen_to_macro(code)
        logger.info(
            "[koppen] (%.3f, %.3f) → %s (%s)  MAT=%.1f°C MAP=%.0fmm",
            lat, lng, code, macro.koppen_label, sum(tmean) / 12.0, sum(precip),
        )
        return {
            "koppen_code": code,
            "main_group": koppen_main_group(code),
            "macro": macro,
            "source": "era5_monthly_normals",
            "confidence": "high",
        }
    except Exception as exc:
        logger.warning(
            "[koppen] ERA5 monthly classification failed for (%.3f, %.3f): %s — "
            "falling back to annual-stat heuristic.",
            lat, lng, exc,
        )
        if ann_mean_c is not None and rh_p95 is not None and p95_temp_c is not None:
            macro = classify_climate_intelligence(lat, ann_mean_c, rh_p95, p95_temp_c)
            return {
                "koppen_code": macro.koppen_class.value,
                "main_group": macro.koppen_class.value[0],
                "macro": macro,
                "source": "annual_heuristic_fallback",
                "confidence": "medium",
            }
        # Last resort — never raise: a coarse latitude-only macro so the request
        # always returns a (low-confidence) climate context for any point on Earth.
        macro = _latitude_only_macro(lat)
        return {
            "koppen_code": macro.koppen_class.value,
            "main_group": macro.koppen_class.value[0],
            "macro": macro,
            "source": "latitude_only_fallback",
            "confidence": "low",
        }


def _latitude_only_macro(lat: float) -> ClimateIntelligence:
    """Coarse latitude-band climate macro — the never-fail last resort."""
    a = abs(lat)
    if a >= 66:
        return _POLAR
    if a >= 55:
        return _BOREAL
    if a >= 40:
        return _CONTINENTAL_HUMID
    if a >= 30:
        return _MEDITERRANEAN
    if a >= 23:
        return _TEMPERATE_OCEANIC
    return _TROPICAL_SAVANNA
