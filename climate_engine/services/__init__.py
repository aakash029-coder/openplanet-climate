"""
climate_engine/services — Stateless Service Layer
"""

from __future__ import annotations

from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
)
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.services.llm_service import (
    generate_strategic_analysis,
    generate_compare_analysis,
)

__all__ = [
    "fetch_historical_baseline_full",
    "fetch_cmip6_projection",
    "fetch_live_socioeconomics",
    "generate_strategic_analysis",
    "generate_compare_analysis",
]