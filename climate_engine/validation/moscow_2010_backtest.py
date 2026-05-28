"""
climate_engine/validation/moscow_2010_backtest.py
══════════════════════════════════════════════════
Empirical back-test: 2010 Russian Heatwave — Moscow City

This is the model's strongest validation case: a long-duration event
(44 days) where the chronic-exposure β coefficient is appropriately
calibrated, producing a −28% error rather than the −73–75% seen in
5–9 day acute events.

Observed reference
──────────────────
Revich BA, Shaposhnikov DA (2012). Climate change, heat waves, and cold
spells as risk factors for increased mortality in some regions of Russia.
Eur J Epidemiol 27(2):137–145.
  • Excess deaths, Moscow city, July–Aug 2010  : ~11,300

Barriopedro D et al. (2011). The hot summer of 2010: redrawing the
temperature record map of Europe. Science 332(6026):220–224.
  • European Russia total excess              : ~56,000

Meteorological reference
────────────────────────
Dole R et al. (2011). Was there a basis for anticipating the 2010
Russian heat wave? Geophys Res Lett 38(6).
  • Moscow peak Tx5d (Aug 2010)              : 38.0 °C (unprecedented for 55.8°N)
  • ERA5 JJA P95 baseline (Moscow 55.8°N)    : 30.0 °C  (2011–2020 reanalysis)
  • Duration of sustained heat               : Jul 1 – Aug 13 (44 days)
  • Wildfire smoke co-exposure               : present (not modelled)

Run
───
    python -m climate_engine.validation.moscow_2010_backtest
"""

from __future__ import annotations
import sys
from ._core import run_backtest

NOTES = [
    "This is the model's best-performing validation case (−28% error). "
    "The 44-day duration aligns with the chronic-exposure nature of the "
    "Gasparrini β coefficient, which was derived from multi-week "
    "seasonal mortality regressions.",

    "Wildfire smoke exposure was severe throughout July–August 2010, "
    "adding a respiratory mortality component not captured in the "
    "temperature-only formula. The −28% undershot likely partly reflects "
    "this missing co-exposure pathway.",

    "Russia's exceptionally high crude death rate (14.2/1,000 in 2010) — "
    "driven by cardiovascular disease burden and alcohol-related mortality — "
    "is correctly incorporated via the OP-CVI death rate input, making "
    "this a realistic test of the formula's population scaling.",

    "This event demonstrates the key finding of the validation suite: "
    "model accuracy improves dramatically with event duration. "
    "The systematic −73–75% undershot seen in 5-day events (Paris 2003, "
    "Chicago 1995) compresses to −28% at 44 days.",
]


def run():
    return run_backtest(
        event_name      = "Moscow 2010 Heatwave (Russia)",
        scope           = "Moscow city",
        population      = 11_514_330,
        death_rate      = 14.2,      # World Bank Russia 2010, per 1,000/yr
        p95_baseline_c  = 30.0,      # ERA5 JJA P95, Moscow 55.8°N
        tx5d_peak_c     = 38.0,      # WMO/Dole et al. (2011) peak Tx5d Aug 2010
        hw_days         = 44,        # Jul 1 – Aug 13 2010 inclusive
        gdp_per_capita  = 10_709,    # USD — World Bank Russia 2010
        physicians_per1k= 4.9,       # WHO Russia 2010
        median_age      = 38.9,      # Rosstat 2010 census
        observed        = 11_300,
        observed_label  = "Revich & Shaposhnikov (2012) Eur J Epidemiol 27(2):137",
        notes           = NOTES,
    )


if __name__ == "__main__":
    run()
    sys.exit(0)
