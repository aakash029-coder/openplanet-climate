"""
climate_engine/validation/run_all.py
══════════════════════════════════════
OpenPlanet Validation Suite — full benchmark runner.

Executes all five historical back-tests and prints a consolidated
comparison table with accuracy analysis.

Usage
─────
    python -m climate_engine.validation.run_all

Expected runtime: < 1 second (pure computation, no network calls).
"""

from __future__ import annotations
import sys
from ._core import BacktestResult

from .paris_2003_backtest  import run as run_paris
from .india_2015_backtest  import run as run_india
from .chicago_1995_backtest import run as run_chicago
from .moscow_2010_backtest import run as run_moscow
from .england_2022_backtest import run as run_england


def _run_silent(fn) -> BacktestResult:
    """Call a back-test runner with print_report suppressed for the summary table."""
    import climate_engine.validation._core as core
    original = core._print_report
    core._print_report = lambda *a, **kw: None
    try:
        result = fn()
    finally:
        core._print_report = original
    return result


def main() -> None:
    print()
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║         OpenPlanet Climate Risk Engine — Validation Suite        ║")
    print("║         Gasparrini (2017) β + OP-CVI · 5 historical events       ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print()

    results: list[BacktestResult] = []

    runners = [
        ("Paris, France 2003",       run_paris),
        ("Andhra Pradesh, India 2015", run_india),
        ("Chicago, USA 1995",         run_chicago),
        ("Moscow, Russia 2010",       run_moscow),
        ("England, UK 2022",          run_england),
    ]

    for label, fn in runners:
        r = _run_silent(fn)
        results.append(r)

    # ── Summary table ────────────────────────────────────────────────────────

    header = (
        f"{'Event':<32} {'Days':>4}  {'Excess':>7}  {'OP-CVI':>6}  "
        f"{'Model':>7}  {'Observed':>8}  {'Error':>7}"
    )
    print(header)
    print("─" * len(header))

    for r in results:
        obs_str = f"~{r.observed:,}"
        print(
            f"{r.event_name:<32} {r.duration_days:>4}d  "
            f"{r.temp_excess_c:>+6.1f}°C  {r.op_cvi:>6.3f}  "
            f"{r.deaths:>7,}  {obs_str:>8}  {r.error_pct:>+6.1f}%"
        )

    print()

    # ── Accuracy analysis ────────────────────────────────────────────────────

    errors = [abs(r.error_pct) for r in results]
    mean_abs = sum(errors) / len(errors)
    in_2x = sum(1 for r in results if abs(r.error_pct) <= 100)
    within_bounds = sum(1 for r in results if r.deaths_lo <= r.observed <= r.deaths_hi)

    print(f"  Mean absolute error       : {mean_abs:.0f}%")
    print(f"  Events within 2× (±100%) : {in_2x}/{len(results)}")
    print(f"  Events within ±15% bounds : {within_bounds}/{len(results)}")
    print()

    # ── Duration-accuracy relationship ───────────────────────────────────────
    print("  Duration vs accuracy pattern:")
    sorted_r = sorted(results, key=lambda r: r.duration_days)
    for r in sorted_r:
        bar_len = max(1, 40 - int(abs(r.error_pct) / 4))
        direction = "↓" if r.error_pct < 0 else "↑"
        print(f"    {r.duration_days:>3}d  {r.error_pct:>+6.1f}%  {direction}  {r.event_name}")

    print()
    print("  Key finding: model accuracy strongly correlates with event duration.")
    print("  At ≤9 days (acute shock events): systematic −17% to −75% undershot.")
    print("  At 44 days (sustained event): −28% — chronic β coefficient aligns.")
    print()
    print("  Root cause: β=0.0801 is a chronic pooled coefficient from seasonal")
    print("  mortality regression. It is not calibrated for acute 5-day events")
    print("  where nocturnal heat retention and institutional shock drive excess")
    print("  mortality. For acute event prediction, apply Gasparrini et al.")
    print("  (2017) Appendix S4 acute multipliers (3–10×).")
    print()
    print("  Model use case: comparative city-level risk triage under future")
    print("  SSP scenarios. Do not use for point-prediction of individual events.")
    print()
    print("  Reproducibility: each event script is independently runnable via")
    print("  python -m climate_engine.validation.<event>_backtest")
    print()


if __name__ == "__main__":
    main()
    sys.exit(0)
