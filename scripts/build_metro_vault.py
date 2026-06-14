#!/usr/bin/env python3
"""
build_metro_vault.py — Build a compact offline metropolitan-population vault.

Source: Natural Earth 10m populated places (public domain). The `pop_max` field
is the metropolitan-area population (not the administrative city core), which is
the correct exposure base for heat-mortality and economic-loss modelling.

Output: climate_engine/data/world_metro_pop.json
        { "<name_slug>|<ISO2>": <pop_max:int>, ... }  (also bare "<name_slug>")

Runtime is fully offline — no network, no rate limits, instant O(1) lookup.
Re-run this only to refresh the dataset.
"""
import json
import os
import re
import unicodedata

import httpx

NE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_10m_populated_places_simple.geojson"
)
OUT = os.path.join(os.path.dirname(__file__), "..", "climate_engine", "data", "world_metro_pop.json")


def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9 ]", "", s.lower())
    return re.sub(r"\s+", "_", s.strip())


def main() -> None:
    print("Fetching Natural Earth populated places…")
    r = httpx.get(NE_URL, timeout=90, follow_redirects=True)
    r.raise_for_status()
    feats = r.json()["features"]
    print(f"  {len(feats)} places")

    keyed: dict[str, int] = {}
    bare: dict[str, int] = {}

    for f in feats:
        p = f["properties"]
        iso2 = (p.get("iso_a2") or "").upper()
        pop = int(p.get("pop_max") or 0)
        if pop <= 0:
            continue
        names = {p.get("name"), p.get("nameascii"), p.get("ls_name")}
        for nm in names:
            if not nm:
                continue
            sl = slug(nm)
            if not sl:
                continue
            if iso2:
                k = f"{sl}|{iso2}"
                if pop > keyed.get(k, 0):
                    keyed[k] = pop
            # bare slug keeps the most-populous homonym as a last-resort match
            if pop > bare.get(sl, 0):
                bare[sl] = pop

    out = {"keyed": keyed, "bare": bare}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"Wrote {OUT}  ({len(keyed)} keyed, {len(bare)} bare, {size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
