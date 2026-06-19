"""
tests/generate_fixtures.py — Populate tests/fixtures/engine_outputs.json by
running the real engine (live APIs) for every city in reference_cities.json.

Run this to (re)record the fixture that test_global_accuracy.py uses for fast,
deterministic, offline CI:

    python tests/generate_fixtures.py            # all cities
    python tests/generate_fixtures.py Lisbon Phoenix   # subset by name

The fixture is committed so CI does not depend on live network. A separate
`-m live` test run re-validates the live APIs against the same references.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time

HERE = os.path.dirname(__file__)
REF_PATH = os.path.join(HERE, "reference_cities.json")
FIXTURE_DIR = os.path.join(HERE, "fixtures")
FIXTURE_PATH = os.path.join(FIXTURE_DIR, "engine_outputs.json")

# Import after sys.path is correct (run from repo root).
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))
from tests._engine_probe import compute_city  # noqa: E402


async def main(only: list[str] | None = None) -> None:
    with open(REF_PATH, encoding="utf-8") as fh:
        cities = json.load(fh)["cities"]

    os.makedirs(FIXTURE_DIR, exist_ok=True)
    existing: dict = {}
    if os.path.exists(FIXTURE_PATH):
        with open(FIXTURE_PATH, encoding="utf-8") as fh:
            existing = json.load(fh)

    for c in cities:
        name = c["name"]
        if only and name not in only:
            continue
        # Up to 3 attempts per city, backing off on rate-limit failures.
        out = None
        for attempt in range(1, 4):
            t0 = time.time()
            try:
                out = await compute_city(c["query"])
                out["_ok"] = True
                existing[name] = out
                print(f"[ok]   {name:14s} {time.time()-t0:5.1f}s  "
                      f"koppen={out['koppen_code']:4s} elev={out['elevation_m']}m "
                      f"tx5d_base={out['baseline_tx5d_c']} 2050={out['projections']['2050']['tx5d_c']} "
                      f"gdp=${out['metro_gdp_usd']/1e9:.0f}B", flush=True)
                break
            except Exception as exc:
                print(f"[retry {attempt}/3] {name:14s} {time.time()-t0:5.1f}s  {str(exc)[:90]}", flush=True)
                if attempt < 3:
                    await asyncio.sleep(20 * attempt)  # cooldown for rate limits
                else:
                    existing.setdefault(name, {})["_ok"] = False
                    existing[name]["_error"] = str(exc)
        # Persist after each city so a mid-run failure keeps progress.
        with open(FIXTURE_PATH, "w", encoding="utf-8") as fh:
            json.dump(existing, fh, indent=2, sort_keys=True)
        await asyncio.sleep(3.0)  # be gentle with the free APIs

    print(f"\nFixture written: {FIXTURE_PATH} ({len(existing)} cities)")


if __name__ == "__main__":
    only = sys.argv[1:] or None
    asyncio.run(main(only))
