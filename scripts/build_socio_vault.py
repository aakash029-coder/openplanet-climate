"""
scripts/build_socio_vault.py
Fetch socioeconomic reference data from the World Bank API and write
climate_engine/data/socio_vault.json.

Run this script to refresh the vault when World Bank indicators are updated.
Requires: pip install wbgapi pandas

Usage:
    python scripts/build_socio_vault.py
"""

from __future__ import annotations

import json
import logging
import os

import pandas as pd
import wbgapi as wb

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INDICATORS: dict[str, str] = {
    "SP.DYN.CDRT.IN": "death_rate",
    "NY.GDP.PCAP.CD": "gdp_per_capita",          # nominal GDP per capita (current US$)
    "NY.GDP.MKTP.CD": "gdp_total_usd",           # national nominal GDP (current US$)
    "SP.POP.TOTL": "population_total",           # national population
    "SP.URB.TOTL.IN.ZS": "urban_share",
    "SP.DYN.LE00.IN": "life_expectancy",
    "SH.MED.PHYS.ZS": "physicians_per1000",
    "SP.POP.0014.TO.ZS": "pct_under15",
    "SP.POP.65UP.TO.ZS": "pct_over65",
}

OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "climate_engine", "data", "socio_vault.json"
)


def build_vault() -> None:
    vault_data: dict[str, dict[str, float | None]] = {}

    logger.info("Fetching %d World Bank indicators…", len(INDICATORS))

    for code, field_name in INDICATORS.items():
        logger.info("  %s → %s", code, field_name)
        try:
            df = wb.data.DataFrame(code, mrv=1, labels=False)
            for country_code, row in df.iterrows():
                country_code = str(country_code)
                if country_code not in vault_data:
                    vault_data[country_code] = {}
                value = row.iloc[0]
                vault_data[country_code][field_name] = (
                    round(float(value), 3) if pd.notna(value) else None
                )
        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", field_name, exc)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(vault_data, fh, indent=2, sort_keys=True)

    logger.info(
        "Vault written to %s (%d countries)", OUTPUT_PATH, len(vault_data)
    )


if __name__ == "__main__":
    build_vault()
