"""
scripts/enrich_socio_vault_rest.py

Enrich climate_engine/data/socio_vault.json with national totals needed to cap
metro GDP at the national level:

    gdp_total_usd     — NY.GDP.MKTP.CD  (national nominal GDP, current US$)
    population_total  — SP.POP.TOTL     (national population)

Uses the free World Bank REST API (no key, no wbgapi dependency), so the cap
data is reproducible by anyone. mrnev=1 returns the most-recent non-empty value
per country. Existing fields are preserved.

Usage:
    python scripts/enrich_socio_vault_rest.py
"""
from __future__ import annotations

import json
import os
import urllib.request

VAULT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "climate_engine", "data", "socio_vault.json"
)

INDICATORS = {
    "NY.GDP.MKTP.CD": "gdp_total_usd",
    "SP.POP.TOTL": "population_total",
}


def fetch_indicator(code: str) -> dict[str, float]:
    url = (
        f"https://api.worldbank.org/v2/country/all/indicator/{code}"
        f"?format=json&mrnev=1&per_page=400"
    )
    with urllib.request.urlopen(url, timeout=60) as resp:
        payload = json.load(resp)
    out: dict[str, float] = {}
    if len(payload) < 2 or not payload[1]:
        return out
    for row in payload[1]:
        iso3 = row.get("countryiso3code")
        val = row.get("value")
        if iso3 and val is not None:
            out[iso3] = float(val)
    return out


def main() -> None:
    with open(VAULT_PATH, encoding="utf-8") as fh:
        vault = json.load(fh)

    for code, field in INDICATORS.items():
        data = fetch_indicator(code)
        print(f"{code} → {field}: {len(data)} countries")
        for iso3, val in data.items():
            if iso3 in vault:
                vault[iso3][field] = round(val, 3)

    with open(VAULT_PATH, "w", encoding="utf-8") as fh:
        json.dump(vault, fh, indent=2, sort_keys=True)
    print(f"Enriched vault written: {VAULT_PATH} ({len(vault)} countries)")


if __name__ == "__main__":
    main()
