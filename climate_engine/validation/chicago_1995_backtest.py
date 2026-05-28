"""
climate_engine/validation/chicago_1995_backtest.py
═══════════════════════════════════════════════════
Empirical back-test: 1995 Chicago Heatwave — Cook County, Illinois

Observed reference
──────────────────
Whitman S et al. (1997). Mortality in Chicago attributed to the July 1995
heat wave. American Journal of Public Health 87(9):1515–1518.
  • Excess deaths, Cook County, July 12–16 : 739

Meteorological reference
────────────────────────
NOAA National Centers for Environmental Information (1995).
  • Peak Tx at Midway Airport (Jul 13)      : 40.6 °C  (105 °F)
  • Peak heat index                         : 52 °C+   (125 °F+, extreme humidity)
  • Tx5d maximum Jul 12–16                  : 37.5 °C  (5-day mean daily max)
  • ERA5 JJA P95 baseline (Chicago 41.9°N)  : 31.5 °C  (2011–2020 reanalysis)
  • Overnight Tmin never dropped below      : 26 °C    (no physiological recovery)

Run
───
    python -m climate_engine.validation.chicago_1995_backtest
"""

from __future__ import annotations
import sys
from ._core import run_backtest

NOTES = [
    "β = 0.0801 captures daily dry-bulb temperature exposure. "
    "Chicago 1995 was a combined heat-humidity event: dew points reached "
    "27–29 °C, pushing heat index above 52 °C. The Gasparrini formula "
    "does not include a relative-humidity or wet-bulb component for "
    "short-duration events.",

    "Consecutive nocturnal heat (Tmin > 26 °C for 5 nights) prevented "
    "physiological recovery. This mechanism — documented in Klinenberg (2002) "
    "'Heat Wave: A Social Autopsy of Disaster in Chicago' — substantially "
    "amplifies acute mortality above the chronic-exposure model prediction.",

    "Social isolation was a primary mortality driver: the highest death rates "
    "were in elderly, single-person households in South Side Chicago who "
    "could not access cooling centres. This structural factor is outside "
    "the model's demographic scope.",

    "This event and Paris 2003 show a consistent −73–75% undershot pattern "
    "for acute 5-day events with nocturnal heat. The model correctly "
    "identifies both cities as high-risk in future projections; it should "
    "not be used to predict acute event mortality without applying "
    "Gasparrini et al. (2017) Appendix S4 acute multipliers.",
]


def run():
    return run_backtest(
        event_name      = "Chicago 1995 Heatwave (USA)",
        scope           = "Cook County, Illinois",
        population      = 5_105_067,
        death_rate      = 8.9,       # CDC WONDER, Cook County 1995
        p95_baseline_c  = 31.5,      # ERA5 JJA P95, Chicago 41.9°N
        tx5d_peak_c     = 37.5,      # NOAA, 5-day mean Tx Jul 12-16 1995
        hw_days         = 5,         # Jul 12-16 acute crisis window
        gdp_per_capita  = 32_000,    # USD — Chicago metro 1995 BEA estimate
        physicians_per1k= 2.7,       # Illinois 1995, AMA physician data
        median_age      = 32.2,      # US Census Bureau 1995 Cook County
        observed        = 739,
        observed_label  = "Whitman et al. (1997) Am J Public Health 87(9):1515",
        notes           = NOTES,
    )


if __name__ == "__main__":
    run()
    sys.exit(0)
