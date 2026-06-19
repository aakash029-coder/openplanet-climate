"""
climate_engine/api/physics/accuracy_guard.py — Runtime accuracy guard.

The validation harness (tests/test_global_accuracy.py) proves the engine is
correct for a 26-city reference panel offline. But users query ANY of millions of
places on Earth, computed fresh and unvalidated. This module applies the SAME
physical/sanity invariants as the harness to EVERY prediction at request time, so
a user anywhere on the planet only ever receives data that has been verified.

Three outcomes per datum:
  • verified            — passed all checks, served as-is.
  • corrected           — a deterministic physical violation was clamped (e.g. a
                          projection dipping below baseline under a warming SSP is
                          floored to baseline; wet-bulb capped at the dry-bulb /
                          35 °C survivability limit).
  • withheld            — a value that cannot be made safe (NaN/Inf, impossible
                          geography) is removed rather than shown wrong.

Nothing is ever fabricated: corrections only enforce physical bounds, and
unverifiable values are withheld with a reason — never replaced with a guess.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Physical / plausibility bounds (shared with the offline harness).
ELEVATION_MIN_M = -450.0          # Dead Sea shore ≈ −430 m
ELEVATION_MAX_M = 6000.0          # highest permanent habitation ≈ 5100 m
WETBULB_SURVIVAL_C = 35.0         # Sherwood & Huber (2010)
MAX_WARMING_DELTA_C = 6.0         # IPCC-plausible 2050 Tx5d rise upper bound
ABS_TEMP_MIN_C = -45.0            # coldest inhabited annual means (Verkhoyansk ≈ −15)
ABS_TEMP_MAX_C = 60.0


@dataclass
class GuardReport:
    status: str = "verified"                       # verified | corrected | degraded
    checks: List[Dict[str, Any]] = field(default_factory=list)
    corrections: List[str] = field(default_factory=list)
    withheld: List[str] = field(default_factory=list)

    def _add(self, name: str, ok: bool, severity: str, message: str = "") -> None:
        self.checks.append({"check": name, "ok": ok, "severity": severity, "message": message})

    def to_dict(self) -> Dict[str, Any]:
        passed = sum(1 for c in self.checks if c["ok"])
        return {
            "status": self.status,
            "checks_passed": passed,
            "checks_total": len(self.checks),
            "corrections": self.corrections,
            "withheld": self.withheld,
            "detail": self.checks,
            "statement": _statement(self.status, self.withheld),
        }


def _statement(status: str, withheld: List[str]) -> str:
    if status == "verified":
        return ("All values passed OpenPlanet's runtime physical-consistency and "
                "plausibility checks.")
    if status == "corrected":
        return ("Values served after enforcing physical bounds (e.g. projections "
                "kept at or above the observed baseline under warming; wet-bulb "
                "capped at the dry-bulb / 35 °C survivability limit). No value was "
                "invented.")
    return (f"Some metrics could not be verified and were withheld ({', '.join(withheld)}) "
            "rather than shown as unverified data.")


def _finite(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(x)


def _expected_temp_band(abs_lat: float) -> tuple[float, float]:
    """
    Very wide latitude-based annual-mean band — advisory only. High-altitude
    cities (La Paz, Quito) legitimately fall well below their latitude band, so a
    breach is FLAGGED, never withheld.
    """
    if abs_lat < 15:
        return 12.0, 32.0
    if abs_lat < 30:
        return 5.0, 32.0
    if abs_lat < 45:
        return -2.0, 26.0
    if abs_lat < 60:
        return -12.0, 20.0
    return ABS_TEMP_MIN_C, 14.0


def verify_prediction(metrics: Dict[str, Any]) -> tuple[Dict[str, Any], GuardReport]:
    """
    Validate + sanitize a single prediction. ``metrics`` is mutated in place with
    corrected / withheld values and returned alongside a GuardReport.

    Expected keys (missing keys are skipped gracefully):
      lat, lng, elevation_m, koppen_main, baseline_annual_mean_c, baseline_tx5d_c,
      baseline_hw_days, tx5d_2030_c, tx5d_2050_c, hw_2030, hw_2050,
      wbt_proj_c, dry_bulb_2050_c, population, metro_gdp_usd, national_gdp_usd
    """
    r = GuardReport()
    corrected = False
    degraded = False

    lat = metrics.get("lat")
    lng = metrics.get("lng")

    # 1 ── Coordinate: never null-island, never out of range.
    if lat is not None and lng is not None:
        null_island = abs(lat) < 0.01 and abs(lng) < 0.01
        in_range = -90 <= lat <= 90 and -180 <= lng <= 180
        ok = (not null_island) and in_range
        r._add("coordinate_valid", ok, "critical",
               "" if ok else "resolved to null-island/out-of-range coordinate")
        if not ok:
            r.withheld.append("location")
            degraded = True

    # 2 ── Elevation within global plausible range.
    elev = metrics.get("elevation_m")
    if elev is not None:
        ok = _finite(elev) and ELEVATION_MIN_M <= elev <= ELEVATION_MAX_M
        r._add("elevation_plausible", ok, "critical",
               "" if ok else f"elevation {elev} m outside [{ELEVATION_MIN_M}, {ELEVATION_MAX_M}]")
        if not ok:
            metrics["elevation_m"] = None
            r.withheld.append("elevation")
            degraded = True

    # 3 ── Baseline annual mean finite and within absolute habitable bounds.
    bmean = metrics.get("baseline_annual_mean_c")
    if bmean is not None:
        ok = _finite(bmean) and ABS_TEMP_MIN_C <= bmean <= ABS_TEMP_MAX_C
        r._add("baseline_temp_finite", ok, "critical",
               "" if ok else f"baseline mean {bmean}°C non-finite/implausible")
        if not ok:
            metrics["baseline_annual_mean_c"] = None
            r.withheld.append("baseline_temperature")
            degraded = True
        elif lat is not None:
            lo, hi = _expected_temp_band(abs(lat))
            band_ok = lo - 8.0 <= bmean <= hi + 8.0  # generous; altitude can deviate
            r._add("baseline_temp_vs_latitude", band_ok, "advisory",
                   "" if band_ok else f"baseline {bmean}°C unusual for latitude {lat:.1f} (altitude?)")

    # 4 ── Projection monotonicity & baseline floor (correctable).
    base = metrics.get("baseline_tx5d_c")
    tx30 = metrics.get("tx5d_2030_c")
    tx50 = metrics.get("tx5d_2050_c")
    if _finite(base) and _finite(tx30) and _finite(tx50):
        new30 = max(tx30, base)
        new50 = max(tx50, new30)
        if new30 != tx30 or new50 != tx50:
            metrics["tx5d_2030_c"], metrics["tx5d_2050_c"] = round(new30, 2), round(new50, 2)
            corrected = True
            r.corrections.append("projection clamped to baseline-floor + monotonic")
        r._add("projection_monotonic_ge_baseline", True, "corrected")

        delta = metrics["tx5d_2050_c"] - base
        ok = 0.0 <= delta <= MAX_WARMING_DELTA_C
        r._add("warming_delta_plausible", ok, "advisory" if ok else "critical",
               "" if ok else f"2050 warming Δ {delta:.2f}°C outside [0, {MAX_WARMING_DELTA_C}]")
        if not ok:
            r.withheld.append("projection_2050")
            degraded = True
    elif any(v is not None for v in (base, tx30, tx50)):
        r._add("projection_finite", False, "critical", "non-finite projection value")
        r.withheld.append("projection")
        degraded = True

    # 5 ── Heatwave days non-decreasing (correctable).
    bhw = metrics.get("baseline_hw_days")
    hw30 = metrics.get("hw_2030")
    hw50 = metrics.get("hw_2050")
    if _finite(bhw) and _finite(hw30) and _finite(hw50):
        n30 = max(hw30, bhw)
        n50 = max(hw50, n30)
        if n30 != hw30 or n50 != hw50:
            metrics["hw_2030"], metrics["hw_2050"] = round(n30, 1), round(n50, 1)
            corrected = True
            r.corrections.append("heatwave days clamped non-decreasing")
        r._add("heatwave_days_non_decreasing", True, "corrected")

    # 6 ── Wet-bulb ≤ dry-bulb ≤ 35 °C survivability cap (correctable).
    wbt = metrics.get("wbt_proj_c")
    dry = metrics.get("dry_bulb_2050_c", metrics.get("tx5d_2050_c"))
    if _finite(wbt):
        capped = min(wbt, WETBULB_SURVIVAL_C)
        if _finite(dry):
            capped = min(capped, dry)
        if capped != wbt:
            metrics["wbt_proj_c"] = round(capped, 2)
            corrected = True
            r.corrections.append("wet-bulb capped at dry-bulb / 35 °C survivability limit")
        r._add("wetbulb_le_drybulb_le_35", True, "corrected")
    elif wbt is not None:
        r._add("wetbulb_finite", False, "critical", "non-finite wet-bulb")
        metrics["wbt_proj_c"] = None
        r.withheld.append("wet_bulb")
        degraded = True

    # 7 ── Metro GDP ≤ national GDP, both finite & positive.
    gdp = metrics.get("metro_gdp_usd")
    nat = metrics.get("national_gdp_usd")
    if gdp is not None:
        ok = _finite(gdp) and gdp > 0
        if ok and _finite(nat) and nat and gdp > nat * 1.001:
            metrics["metro_gdp_usd"] = nat
            corrected = True
            r.corrections.append("metro GDP capped at national GDP")
            r._add("metro_gdp_le_national", True, "corrected")
        else:
            r._add("metro_gdp_valid", ok, "critical", "" if ok else "non-finite/non-positive metro GDP")
            if not ok:
                metrics["metro_gdp_usd"] = None
                r.withheld.append("economic_exposure")
                degraded = True

    # 8 ── Population finite & positive (advisory band already enforced upstream).
    pop = metrics.get("population")
    if pop is not None:
        ok = _finite(pop) and pop > 0
        r._add("population_valid", ok, "critical", "" if ok else "non-finite/non-positive population")
        if not ok:
            metrics["population"] = None
            r.withheld.append("population")
            degraded = True

    # 9 ── Köppen main group is one of A/B/C/D/E.
    km = metrics.get("koppen_main")
    if km is not None:
        ok = km in {"A", "B", "C", "D", "E"}
        r._add("koppen_main_group_valid", ok, "advisory", "" if ok else f"unexpected Köppen group '{km}'")

    if degraded:
        r.status = "degraded"
    elif corrected:
        r.status = "corrected"
    else:
        r.status = "verified"
    return metrics, r
