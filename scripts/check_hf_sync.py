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

But the physics, services and validation formulas that produce every published
number MUST be byte-identical in both trees, otherwise the live HF Space could
report different results than the audited repo. This script fails CI on any
such divergence.

Exit code 0 = in sync, 1 = drift detected.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files whose scientific output must never differ between the two trees.
SHARED_SCIENCE = [
    "climate_engine/api/physics.py",
    "climate_engine/api/schemas.py",
    "climate_engine/validation/_core.py",
    "climate_engine/validation/run_all.py",
    "climate_engine/validation/paris_2003_backtest.py",
    "climate_engine/validation/india_2015_backtest.py",
    "climate_engine/validation/chicago_1995_backtest.py",
    "climate_engine/validation/moscow_2010_backtest.py",
    "climate_engine/validation/england_2022_backtest.py",
    "climate_engine/services/cmip6_service.py",
    "climate_engine/services/socioeconomic_service.py",
    "climate_engine/services/historical_service.py",
    "climate_engine/data/socio_vault.json",
]


def main() -> int:
    drift: list[str] = []
    missing: list[str] = []

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

    print(f"✓ HF science-core in sync — {len(SHARED_SCIENCE)} files identical")
    return 0


if __name__ == "__main__":
    sys.exit(main())
