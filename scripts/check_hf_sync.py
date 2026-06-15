#!/usr/bin/env python3
"""
scripts/check_hf_sync.py
────────────────────────
Guards against silent drift of the SHARED SCIENTIFIC CORE between the canonical
package (`climate_engine/`) and the Hugging Face deployment mirror
(`hf_space/climate_engine/`).

`hf_space` is intentionally a *superset* of the root package — it adds the
Agentverse/uAgents integration (asi_agent.py, asi_logic.py, thermo_utils.py)
and a deployment-specific llm_service. Those files are allowed to differ.

Architecture note: the root package refactored `climate_engine/api/physics.py`
into a physics/ sub-package and `climate_engine/services/socioeconomic_service.py`
into a socioeconomic/ sub-package. The hf_space still uses the pre-refactor
monolithic layout. Files that changed structure are excluded from byte-identity
checks and are instead checked for existence only.

The validation backtests and shared services that produce every published
number MUST be byte-identical in both trees. This script fails CI on any
such divergence.

Exit code 0 = in sync, 1 = drift detected.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files that must be byte-identical in root and hf_space.
# Excludes files whose structure changed between the two layouts:
#   - climate_engine/api/physics.py   → refactored to physics/ package in root
#   - climate_engine/services/socioeconomic_service.py → re-export shim in root
SHARED_SCIENCE = [
    "climate_engine/api/schemas.py",
    "climate_engine/validation/_core.py",
    "climate_engine/validation/run_all.py",
    "climate_engine/validation/paris_2003_backtest.py",
    "climate_engine/validation/india_2015_backtest.py",
    "climate_engine/validation/chicago_1995_backtest.py",
    "climate_engine/validation/moscow_2010_backtest.py",
    "climate_engine/validation/england_2022_backtest.py",
    "climate_engine/services/cmip6_service.py",
    "climate_engine/services/historical_service.py",
]

# Files that must exist in the root physics package (guards against accidental
# deletion of a module after a future refactor).
PHYSICS_PACKAGE_MODULES = [
    "climate_engine/api/physics/__init__.py",
    "climate_engine/api/physics/mortality.py",
    "climate_engine/api/physics/economics.py",
    "climate_engine/api/physics/wetbulb.py",
    "climate_engine/api/physics/hex_grid.py",
    "climate_engine/api/physics/climate_zone.py",
    "climate_engine/api/physics/audit.py",
    "climate_engine/api/physics/utils.py",
]


def main() -> int:
    drift: list[str] = []
    missing: list[str] = []

    # ── Byte-identity check for shared files ─────────────────────────────────
    for rel in SHARED_SCIENCE:
        root_file = ROOT / rel
        hf_file = ROOT / "hf_space" / rel

        if not root_file.exists():
            missing.append(f"{rel} (missing in root)")
            continue
        if not hf_file.exists():
            missing.append(f"hf_space/{rel} (missing in mirror)")
            continue

        if root_file.read_bytes() != hf_file.read_bytes():
            drift.append(rel)

    # ── Existence check for physics package modules ───────────────────────────
    for rel in PHYSICS_PACKAGE_MODULES:
        if not (ROOT / rel).exists():
            missing.append(f"{rel} (missing in root — physics package incomplete)")

    if drift or missing:
        print("✗ HF science-core sync check FAILED\n")
        for m in missing:
            print(f"  MISSING  {m}")
        for d in drift:
            print(f"  DRIFT    {d}")
        print(
            "\nThe shared scientific core diverged between climate_engine/ and "
            "hf_space/climate_engine/.\nSync them (e.g. `cp climate_engine/<file> "
            "hf_space/climate_engine/<file>`) so the live HF Space and the audited "
            "repo report identical numbers."
        )
        return 1

    print(
        f"✓ HF science-core in sync — {len(SHARED_SCIENCE)} shared files identical, "
        f"{len(PHYSICS_PACKAGE_MODULES)} physics package modules present"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
