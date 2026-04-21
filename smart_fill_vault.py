import json
import os

file_path = "climate_engine/data/socio_vault.json"

# Standard Tier Data
TIERS = {
    "NORTH_AMERICA_HIGH": {"physicians_per1000": 2.6, "pct_under15": 18.0, "pct_over65": 17.0},
    "EUROPE_HIGH": {"physicians_per1000": 3.8, "pct_under15": 15.0, "pct_over65": 20.0},
    "EAST_ASIA_HIGH": {"physicians_per1000": 2.5, "pct_under15": 12.0, "pct_over65": 28.0},
    "OCEANIA_HIGH": {"physicians_per1000": 3.7, "pct_under15": 19.0, "pct_over65": 16.0},
    "GULF_HIGH": {"physicians_per1000": 2.3, "pct_under15": 20.0, "pct_over65": 3.0},
    "EUROPE_UPPER_MID": {"physicians_per1000": 3.2, "pct_under15": 15.0, "pct_over65": 18.0},
    "LATAM_UPPER_MID": {"physicians_per1000": 2.1, "pct_under15": 23.0, "pct_over65": 9.0},
    "EAST_ASIA_UPPER_MID": {"physicians_per1000": 2.2, "pct_under15": 17.0, "pct_over65": 13.0},
    "SOUTH_ASIA_LOWER_MID": {"physicians_per1000": 0.8, "pct_under15": 26.0, "pct_over65": 7.0},
    "SOUTHEAST_ASIA_LOWER_MID": {"physicians_per1000": 0.9, "pct_under15": 24.0, "pct_over65": 8.0},
    "AFRICA_LOWER_MID": {"physicians_per1000": 0.3, "pct_under15": 40.0, "pct_over65": 4.0},
    "MENA_LOWER_MID": {"physicians_per1000": 1.2, "pct_under15": 30.0, "pct_over65": 6.0},
    "AFRICA_LOW": {"physicians_per1000": 0.1, "pct_under15": 44.0, "pct_over65": 3.0},
    "SOUTH_ASIA_FRAGILE": {"physicians_per1000": 0.3, "pct_under15": 42.0, "pct_over65": 4.0},
    "SMALL_ISLAND_DEVELOPING": {"physicians_per1000": 1.0, "pct_under15": 28.0, "pct_over65": 8.0},
}

# Country to Tier Mapping (Simplified list for imputation)
COUNTRY_MAP = {
    "USA": "NORTH_AMERICA_HIGH", "CAN": "NORTH_AMERICA_HIGH", "FRA": "EUROPE_HIGH", "ESP": "EUROPE_HIGH",
    "GBR": "EUROPE_HIGH", "DEU": "EUROPE_HIGH", "IND": "SOUTH_ASIA_LOWER_MID", "CHN": "EAST_ASIA_UPPER_MID",
    "BRA": "LATAM_UPPER_MID", "ZAF": "AFRICA_LOWER_MID", "NGA": "AFRICA_LOW", "JPN": "EAST_ASIA_HIGH",
    "AUS": "OCEANIA_HIGH", "MEX": "LATAM_UPPER_MID", "PAK": "SOUTH_ASIA_LOWER_MID", "BGD": "SOUTH_ASIA_LOWER_MID",
}

with open(file_path, "r") as f:
    vault_data = json.load(f)

print("🩹 Smart Filling Missing Data with Tier Averages...")

for country_code, data in vault_data.items():
    tier_name = COUNTRY_MAP.get(country_code, "AFRICA_LOWER_MID") # Default fallback
    tier_data = TIERS[tier_name]
    
    if data.get("physicians_per1000") is None:
        data["physicians_per1000"] = tier_data["physicians_per1000"]
    if data.get("pct_under15") is None:
        data["pct_under15"] = tier_data["pct_under15"]
    if data.get("pct_over65") is None:
        data["pct_over65"] = tier_data["pct_over65"]

with open(file_path, "w") as f:
    json.dump(vault_data, f, indent=4)

print("✅ VAULT IS NOW 100% COMPLETE AND INDEPENDENT OF APIS!")
