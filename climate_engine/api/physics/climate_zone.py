"""
climate_engine/api/physics/climate_zone.py — Köppen-Geiger inspired climate zone detection.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from dataclasses import dataclass

# Forward-declared here so wetbulb.py can import without a circular dep.
# stull_wetbulb_simple is injected at call site via a lazy import inside
# detect_climate_archetype to break the cycle.


class ClimateZone(str, Enum):
    PERMAFROST = "PERMAFROST_ZONE"
    HYPER_ARID = "HYPER_ARID_DESERT"
    LETHAL_HUMID = "LETHAL_HUMID_ZONE"
    EXTREME_CONTINENTAL = "EXTREME_CONTINENTAL"
    STANDARD = "STANDARD_ZONE"


@dataclass(frozen=True)
class ZoneClassification:
    """Result of climate zone detection with diagnostic metadata."""

    zone: ClimateZone
    confidence: float
    diagnostic_flags: tuple[str, ...]
    lethal_risk_days: Optional[int] = None


def detect_climate_archetype(
    mean_temp: float,
    p95_rh: float,
    tx5d: float,
    true_wbt: Optional[float] = None,
) -> ZoneClassification:
    from .wetbulb import stull_wetbulb_simple  # lazy import avoids circular dep

    flags: list[str] = []
    seasonality_index = tx5d - mean_temp

    if true_wbt is None:
        true_wbt = stull_wetbulb_simple(tx5d, p95_rh)

    # Priority 1: Permafrost — only when summers are also cold (tx5d < 28°C).
    if mean_temp <= 2.0 and tx5d < 28.0:
        confidence = min(1.0, (2.0 - mean_temp) / 10.0 + 0.7)
        flags.append(f"Mean temp {mean_temp:.1f}°C below permafrost threshold with cold peak (TX5D {tx5d:.1f}°C)")
        return ZoneClassification(zone=ClimateZone.PERMAFROST, confidence=round(confidence, 2), diagnostic_flags=tuple(flags))

    # Priority 2: Lethal humid
    if true_wbt >= 31.0 and p95_rh >= 60.0:
        confidence = min(1.0, 0.75 + (true_wbt - 31.0) / 4.0)
        flags.append(f"Projected Wet-Bulb {true_wbt:.1f}°C exceeds critical physiological limits")
        return ZoneClassification(zone=ClimateZone.LETHAL_HUMID, confidence=round(confidence, 2), diagnostic_flags=tuple(flags), lethal_risk_days=15)

    # Priority 3: Hyper-arid
    if p95_rh <= 45.0 and tx5d >= 38.0:
        confidence = min(1.0, (45.0 - p95_rh) / 15.0 + 0.7)
        flags.append(f"Nighttime Max RH {p95_rh:.1f}% indicates daytime aridity")
        return ZoneClassification(zone=ClimateZone.HYPER_ARID, confidence=round(confidence, 2), diagnostic_flags=tuple(flags))

    # Priority 4: Extreme continental
    if seasonality_index >= 28.0 and mean_temp < 20.0:
        confidence = min(1.0, (seasonality_index - 28.0) / 10.0 + 0.75)
        flags.append(f"Extreme thermal amplitude: {seasonality_index:.1f}°C gap")
        return ZoneClassification(zone=ClimateZone.EXTREME_CONTINENTAL, confidence=round(confidence, 2), diagnostic_flags=tuple(flags))

    # Default: Standard
    flags.append("Standard temperate/maritime or moderate tropical baseline")
    return ZoneClassification(zone=ClimateZone.STANDARD, confidence=0.95, diagnostic_flags=tuple(flags))
