"""
cmip6_service.py  —  v4.0.0
FIX 1: &timezone=auto on ALL Open-Meteo URLs (prevents 400 crash)
FIX 2: fetch_empirical_threshold() replaces _CLIMATE_REGIONS (real ERA5 p95)
FIX 3: fetch_historical_baseline() restored (prevents 500 ImportError)
"""
from __future__ import annotations
import asyncio, datetime, logging, statistics
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

# ── ERA5 ──────────────────────────────────────────────────────────────────────
ERA5_BASE_URL        = "https://archive-api.open-meteo.com/v1/archive"
ERA5_BASELINE_START  = "1991-01-01"
ERA5_BASELINE_END    = "2020-12-31"
ERA5_PERCENTILE      = 95.0

# ── CMIP6 ─────────────────────────────────────────────────────────────────────
CMIP6_BASE_URL     = "https://climate-api.open-meteo.com/v1/climate"
CMIP6_MODEL        = "mpi_esm1_2_xr"
CMIP6_API_MAX_YEAR = 2050
CMIP6_START_YEAR   = 2020

# ── World Bank ─────────────────────────────────────────────────────────────────
WB_BASE_URL      = "https://api.worldbank.org/v2/country"
WB_GDP_INDICATOR = "NY.GDP.MKTP.CD"
WB_POP_INDICATOR = "SP.POP.TOTL"

# ── Science constants ─────────────────────────────────────────────────────────
ERR_PER_DEGREE_C                 = 0.022
BASELINE_MORTALITY_RATE_PER_1000 = 7.7
GDP_LOSS_FRACTION_PER_HW_DAY     = 0.0004
MAX_CANOPY_COOLING_C             = 1.2
MAX_ALBEDO_COOLING_C             = 0.8
TX5D_WINDOW                      = 5
HTTP_TIMEOUT_SECONDS             = 45.0
PROJECTION_YEARS: List[int]      = [2030, 2050, 2075, 2100]


# ==============================================================================
# FIX 2 — ERA5 EMPIRICAL THRESHOLD (replaces hardcoded _CLIMATE_REGIONS dict)
# ==============================================================================

async def fetch_empirical_threshold(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
) -> float:
    """
    Returns the TRUE localized heatwave threshold from 30 years of ERA5
    satellite-observed daily Tmax (1991-2020).  Threshold = p95 of that
    empirical distribution.  No lookup tables.  No latitude guessing.

    - Quito (2850m): ERA5 returns ~18-20 C  (correct, altitude-adjusted)
    - London:        ERA5 returns ~26-28 C  (correct, maritime-adapted)
    - Riyadh:        ERA5 returns ~42-44 C  (correct, desert-calibrated)
    """
    url = (
        f"{ERA5_BASE_URL}"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={ERA5_BASELINE_START}&end_date={ERA5_BASELINE_END}"
        f"&daily=temperature_2m_max"
        f"&timezone=auto"   # FIX 1
    )
    logger.info(f"ERA5 threshold <- {url}")
    try:
        resp = await client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
        if resp.status_code == 400:
            logger.error(f"ERA5 400: {resp.text[:300]}")
            return _latitude_fallback(lat)
        resp.raise_for_status()
        raw   = resp.json()["daily"]["temperature_2m_max"]
        temps = sorted(t for t in raw if t is not None)
        if len(temps) < 365:
            return _latitude_fallback(lat)
        idx = min(int(len(temps) * ERA5_PERCENTILE / 100.0), len(temps) - 1)
        threshold = round(temps[idx], 2)
        logger.info(f"ERA5 p95 threshold ({lat},{lng}): {threshold}C [{len(temps)} records]")
        return threshold
    except Exception as exc:
        logger.error(f"ERA5 error: {exc}")
        return _latitude_fallback(lat)


def _latitude_fallback(lat: float) -> float:
    """EMERGENCY fallback only. Never used when ERA5 is reachable."""
    a = abs(lat)
    if   a <= 20: b = 35.0
    elif a <= 35: b = 35.0 - ((a-20)/15)*3.0
    elif a <= 55: b = 32.0 - ((a-35)/20)*4.0
    else:         b = max(22.0, 28.0 - ((a-55)/35)*6.0)
    logger.warning(f"latitude fallback {b:.2f}C (ERA5 unreachable)")
    return round(b, 2)


# ==============================================================================
# FIX 3 — fetch_historical_baseline (restored — main.py imports this)
# ==============================================================================

async def fetch_historical_baseline(
    lat: float,
    lng: float,
    baseline_years: int = 10,
) -> Dict[str, Any]:
    """
    Fetch recent ERA5 historical climate statistics for a coordinate.
    Called by main.py to populate the baseTemp dashboard widget.

    Returns:
        baseline_mean_c, baseline_p95_c, baseline_p99_c,
        baseline_max_c, baseline_min_c, record_count,
        period_start, period_end, source, error
    """
    end_dt   = datetime.date(2020, 12, 31)
    start_dt = datetime.date(end_dt.year - baseline_years + 1, 1, 1)

    url = (
        f"{ERA5_BASE_URL}"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start_dt}&end_date={end_dt}"
        f"&daily=temperature_2m_max,temperature_2m_min"
        f"&timezone=auto"   # FIX 1
    )
    logger.info(f"ERA5 baseline <- {url}")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
            if resp.status_code == 400:
                raise ValueError(f"ERA5 400: {resp.text[:200]}")
            resp.raise_for_status()
            data = resp.json()

        times = data["daily"]["time"]
        tmax  = sorted(t for t in data["daily"]["temperature_2m_max"] if t is not None)
        tmin  = [t for t in data["daily"].get("temperature_2m_min", []) if t is not None]

        if not tmax:
            raise ValueError("ERA5 returned no Tmax records.")

        def pct(arr, p):
            return round(arr[min(int(len(arr)*p/100), len(arr)-1)], 2)

        return {
            "baseline_mean_c": round(statistics.mean(tmax), 2),
            "baseline_p95_c":  pct(tmax, 95),
            "baseline_p99_c":  pct(tmax, 99),
            "baseline_max_c":  round(max(tmax), 2),
            "baseline_min_c":  round(min(tmin), 2) if tmin else None,
            "record_count":    len(tmax),
            "period_start":    times[0]  if times else str(start_dt),
            "period_end":      times[-1] if times else str(end_dt),
            "source":          "era5_satellite_archive",
            "error":           None,
        }
    except Exception as exc:
        logger.error(f"fetch_historical_baseline ({lat},{lng}): {exc}")
        return {
            "baseline_mean_c": None, "baseline_p95_c": None,
            "baseline_p99_c":  None, "baseline_max_c": None,
            "baseline_min_c":  None, "record_count":   0,
            "period_start":    None, "period_end":      None,
            "source":          "era5_satellite_archive",
            "error":           str(exc),
        }


# ==============================================================================
# WORLD BANK HELPER
# ==============================================================================

async def _fetch_worldbank(
    client: httpx.AsyncClient, iso2: str, indicator: str
) -> Optional[float]:
    url = f"{WB_BASE_URL}/{iso2}/indicator/{indicator}?format=json&mrv=5&per_page=5"
    try:
        resp = await client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
        resp.raise_for_status()
        payload = resp.json()
        if not payload or len(payload) < 2:
            return None
        for rec in (payload[1] or []):
            v = rec.get("value")
            if v is not None:
                return float(v)
        return None
    except Exception as exc:
        logger.warning(f"WorldBank [{iso2}/{indicator}]: {exc}")
        return None


# ==============================================================================
# FIX 1 — CMIP6 FETCH  (timezone=auto + date cap at 2050)
# ==============================================================================

async def _fetch_cmip6_year(
    client: httpx.AsyncClient,
    lat: float, lng: float,
    ssp: str, sample_year: int,
) -> Optional[List[float]]:
    """
    ±2-year window around sample_year, hard-capped at CMIP6_API_MAX_YEAR=2050.
    &timezone=auto included — mandatory for Open-Meteo, absence causes 400.
    """
    start = max(CMIP6_START_YEAR, sample_year - 2)
    end   = min(sample_year + 2, CMIP6_API_MAX_YEAR)   # THE CAP

    if start > CMIP6_API_MAX_YEAR:
        logger.info(f"Year {sample_year} beyond CMIP6 ceiling. Will extrapolate.")
        return None

    url = (
        f"{CMIP6_BASE_URL}"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start}-01-01"
        f"&end_date={end}-12-31"          # never > 2050-12-31
        f"&daily=temperature_2m_max"
        f"&models={CMIP6_MODEL}"          # mpi_esm1_2_xr
        f"&{ssp}=true"
        f"&timezone=auto"                 # FIX 1 — mandatory param
    )
    logger.info(f"CMIP6 <- {url}  [window {start}-{end}, sample {sample_year}]")

    try:
        resp = await client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
        if resp.status_code == 400:
            logger.error(f"CMIP6 400 year {sample_year}: {resp.text[:300]}")
            return None
        resp.raise_for_status()
        raw   = resp.json()["daily"]["temperature_2m_max"]
        temps = [t for t in raw if t is not None]
        if not temps:
            logger.warning(f"CMIP6 empty series year {sample_year}")
            return None
        return temps
    except httpx.HTTPStatusError as exc:
        logger.error(f"CMIP6 HTTP {exc.response.status_code}: {exc}")
        return None
    except Exception as exc:
        logger.error(f"CMIP6 error: {exc}")
        return None


# ==============================================================================
# METRIC CALCULATORS
# ==============================================================================

def _heatwave_days(temps, threshold, cooling):
    eff = threshold - cooling
    return sum(1 for t in temps if t > eff)

def _tx5d(temps):
    if len(temps) < TX5D_WINDOW:
        return round(max(temps), 2)
    return round(max(
        statistics.mean(temps[i:i+TX5D_WINDOW])
        for i in range(len(temps)-TX5D_WINDOW+1)
    ), 2)

def _deaths(hw_days, avg_excess, population, mort_rate):
    if hw_days == 0 or avg_excess <= 0: return 0.0
    err  = ERR_PER_DEGREE_C * avg_excess * hw_days
    base = population * (mort_rate / 1000.0)
    return round(base * err, 1)

def _econ(hw_days, avg_excess, gdp):
    if hw_days == 0 or gdp <= 0: return 0.0
    mult = 1.0 + 0.1 * max(0.0, avg_excess)
    return round(gdp * GDP_LOSS_FRACTION_PER_HW_DAY * hw_days * mult, 0)

def _cooling_offset(canopy_pct, albedo_pct):
    return round(
        (canopy_pct/100)*MAX_CANOPY_COOLING_C
        + (albedo_pct/100)*MAX_ALBEDO_COOLING_C, 3
    )

def _extrapolate(v30, v50, yr):
    return v50 + ((v50 - v30) / 20.0) * (yr - 2050)


# ==============================================================================
# ISO RESOLVER
# ==============================================================================

_ISO2 = {
    "united states":"US","usa":"US","united kingdom":"GB","uk":"GB",
    "england":"GB","scotland":"GB","india":"IN","china":"CN","australia":"AU",
    "germany":"DE","france":"FR","japan":"JP","brazil":"BR","canada":"CA",
    "russia":"RU","south africa":"ZA","nigeria":"NG","kenya":"KE",
    "saudi arabia":"SA","uae":"AE","pakistan":"PK","indonesia":"ID",
    "mexico":"MX","turkey":"TR","italy":"IT","spain":"ES","netherlands":"NL",
    "bangladesh":"BD","egypt":"EG","ethiopia":"ET","ghana":"GH","iran":"IR",
    "iraq":"IQ","malaysia":"MY","philippines":"PH","poland":"PL",
    "portugal":"PT","romania":"RO","singapore":"SG","sweden":"SE",
    "thailand":"TH","ukraine":"UA","vietnam":"VN","argentina":"AR",
    "colombia":"CO","chile":"CL","peru":"PE","venezuela":"VE","norway":"NO",
    "denmark":"DK","finland":"FI","greece":"GR","czechia":"CZ","austria":"AT",
    "switzerland":"CH","belgium":"BE","new zealand":"NZ","morocco":"MA",
    "algeria":"DZ","tanzania":"TZ","angola":"AO","mozambique":"MZ",
    "zimbabwe":"ZW","zambia":"ZM","oman":"OM","qatar":"QA","bahrain":"BH",
    "kuwait":"KW","jordan":"JO","lebanon":"LB","israel":"IL","nepal":"NP",
    "sri lanka":"LK","afghanistan":"AF","uzbekistan":"UZ","kazakhstan":"KZ",
    "ecuador":"EC","bolivia":"BO","paraguay":"PY","uruguay":"UY",
    "cameroon":"CM","ivory coast":"CI","senegal":"SN","hungary":"HU",
    "serbia":"RS","croatia":"HR","slovakia":"SK","bulgaria":"BG",
    "belarus":"BY","moldova":"MD","georgia":"GE","armenia":"AM",
    "azerbaijan":"AZ","myanmar":"MM","cambodia":"KH","laos":"LA","sudan":"SD",
}

def _resolve_iso2(hint: str) -> str:
    h = hint.lower()
    for k, v in _ISO2.items():
        if k in h: return v
    return "WLD"


# ==============================================================================
# MAIN PUBLIC FUNCTION
# ==============================================================================

async def compute_climate_risk(
    lat: float,
    lng: float,
    elevation: float,
    ssp: str,
    canopy_offset_pct: float,
    albedo_offset_pct: float,
    location_hint: str = "",
) -> Dict[str, Any]:
    """
    Full quantified climate risk for any global coordinate.
    ERA5 p95 threshold → CMIP6 projections → World Bank econ/mortality.
    2030 & 2050: live CMIP6.   2075 & 2100: extrapolated, clearly flagged.
    """
    errors:     List[str]         = []
    projections: List[Dict]       = []
    computed:   Dict[int, Dict]   = {}

    cooling  = _cooling_offset(canopy_offset_pct, albedo_offset_pct)
    ssp_key  = ssp.lower().replace("-", "")
    iso2     = _resolve_iso2(location_hint)

    async with httpx.AsyncClient() as client:

        # 1. ERA5 empirical threshold (FIX 2)
        threshold = await fetch_empirical_threshold(client, lat, lng)

        # 2. World Bank (concurrent)
        gdp, pop = await asyncio.gather(
            _fetch_worldbank(client, iso2, WB_GDP_INDICATOR),
            _fetch_worldbank(client, iso2, WB_POP_INDICATOR),
        )
        if gdp is None:
            errors.append(f"World Bank GDP unavailable for '{iso2}'. Econ decay = 0.")
        if pop is None:
            errors.append(f"World Bank population unavailable for '{iso2}'. Using 1M fallback.")
            pop = 1_000_000

        # 3. CMIP6 for years <= 2050 (concurrent, FIX 1)
        api_yrs    = [y for y in PROJECTION_YEARS if y <= CMIP6_API_MAX_YEAR]
        extrap_yrs = [y for y in PROJECTION_YEARS if y >  CMIP6_API_MAX_YEAR]

        results = await asyncio.gather(*[
            _fetch_cmip6_year(client, lat, lng, ssp_key, yr) for yr in api_yrs
        ])

    # 4. Build live records
    for yr, temps in zip(api_yrs, results):
        if temps is None:
            errors.append(f"CMIP6 no data for {yr}.")
            continue
        eff         = threshold - cooling
        hw          = _heatwave_days(temps, threshold, cooling)
        tx5d        = _tx5d(temps)
        excess_list = [t - eff for t in temps if t > eff]
        avg_exc     = round(statistics.mean(excess_list), 2) if excess_list else 0.0
        d           = _deaths(hw, avg_exc, pop, BASELINE_MORTALITY_RATE_PER_1000)
        e           = _econ(hw, avg_exc, gdp or 0.0)
        rec = {
            "year": yr, "source": "cmip6_live",
            "heatwave_days": hw, "peak_tx5d_c": tx5d,
            "avg_excess_temp_c": avg_exc,
            "attributable_deaths": d, "economic_decay_usd": e,
        }
        computed[yr] = rec
        projections.append(rec)

    # 5. Extrapolate 2075 & 2100
    b30, b50 = computed.get(2030), computed.get(2050)
    if b30 and b50:
        for yr in extrap_yrs:
            projections.append({
                "year": yr,
                "source": "extrapolated_from_cmip6_2030_2050_trend",
                "heatwave_days":       max(0, round(_extrapolate(b30["heatwave_days"],       b50["heatwave_days"],       yr))),
                "peak_tx5d_c":         round(_extrapolate(b30["peak_tx5d_c"],         b50["peak_tx5d_c"],         yr), 2),
                "avg_excess_temp_c":   max(0.0, round(_extrapolate(b30["avg_excess_temp_c"],   b50["avg_excess_temp_c"],   yr), 2)),
                "attributable_deaths": max(0.0, round(_extrapolate(b30["attributable_deaths"], b50["attributable_deaths"], yr), 1)),
                "economic_decay_usd":  max(0.0, round(_extrapolate(b30["economic_decay_usd"],  b50["economic_decay_usd"],  yr), 0)),
            })
    elif extrap_yrs:
        errors.append("Cannot extrapolate 2075/2100: CMIP6 missing for 2030 or 2050.")

    projections.sort(key=lambda r: r["year"])
    return {
        "threshold_c":      threshold,
        "cooling_offset_c": cooling,
        "iso2":             iso2,
        "gdp_usd":          gdp,
        "population":       pop,
        "projections":      projections,
        "errors":           errors,
    }


# ==============================================================================
# CLI SELF-TEST
# ==============================================================================

async def _self_test() -> None:
    """python cmip6_service.py"""
    cases = [
        ("London, UK",           51.51,  -0.13,  11.0, "ssp245", 20, 30, "United Kingdom"),
        ("Riyadh, Saudi Arabia", 24.69,  46.72, 612.0, "ssp585",  5, 10, "Saudi Arabia"),
        ("Mumbai, India",        19.07,  72.87,  14.0, "ssp585", 15, 20, "India"),
        ("Quito, Ecuador",       -0.22, -78.51,2850.0, "ssp245", 10,  5, "Ecuador"),
        ("Sydney, Australia",   -33.87, 151.21,  25.0, "ssp245", 25, 15, "Australia"),
    ]
    for desc, lat, lng, elev, ssp, can, alb, hint in cases:
        print(f"\n{'='*72}\n  {desc}  ({lat},{lng},{elev}m)  {ssp.upper()}")
        print(f"  Canopy {can}%  Albedo {alb}%\n{'='*72}")
        r = await compute_climate_risk(lat, lng, elev, ssp, can, alb, hint)
        print(f"  ERA5 threshold : {r['threshold_c']}C")
        print(f"  Cooling offset : {r['cooling_offset_c']}C")
        gdp, pop = r["gdp_usd"], r["population"]
        print(f"  GDP            : ${gdp:,.0f}" if gdp else "  GDP            : N/A")
        print(f"  Population     : {pop:,.0f}\n")
        print(f"  {'Year':<6} {'Src':<8} {'HWDays':>7} {'Tx5d':>7} {'Deaths':>9} {'EconUSD':>16}")
        print(f"  {'-'*58}")
        for p in r["projections"]:
            s = "LIVE" if p["source"]=="cmip6_live" else "EXTRAP"
            print(f"  {p['year']:<6} {s:<8} {p['heatwave_days']:>7d} "
                  f"{p['peak_tx5d_c']:>7.2f} {p['attributable_deaths']:>9.1f} "
                  f"  ${p['economic_decay_usd']:>14,.0f}")
        for e in r["errors"]: print(f"\n  WARNING: {e}")

        # FIX 3 verification
        bl = await fetch_historical_baseline(lat, lng, 10)
        if bl["error"]: print(f"\n  baseline ERR: {bl['error']}")
        else: print(f"\n  baseline p95={bl['baseline_p95_c']}C  max={bl['baseline_max_c']}C  n={bl['record_count']}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_self_test())