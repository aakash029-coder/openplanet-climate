import wbgapi as wb
import pandas as pd
import json
import os

print("🚀 Starting Data Ingestion from World Bank...")

# Indicators jo tere physics engine ko chahiye
indicators = {
    'SP.DYN.CDRT.IN': 'death_rate',
    'NY.GDP.PCAP.CD': 'gdp_per_capita',
    'SP.URB.TOTL.IN.ZS': 'urban_share',
    'SP.DYN.LE00.IN': 'life_expectancy',
    'SH.MED.PHYS.ZS': 'physicians_per1000',
    'SP.POP.0014.TO.ZS': 'pct_under15',
    'SP.POP.65UP.TO.ZS': 'pct_over65'
}

vault_data = {}
print("⏳ Fetching data (this takes 10-20 seconds)...")

for code, name in indicators.items():
    try:
        # mrv=1 means "Most Recent Value"
        df = wb.data.DataFrame(code, mrv=1, labels=False)
        for country_code, row in df.iterrows():
            if country_code not in vault_data:
                vault_data[country_code] = {}
            
            value = row.iloc[0]
            if pd.isna(value):
                vault_data[country_code][name] = None
            else:
                vault_data[country_code][name] = round(float(value), 3)
    except Exception as e:
        print(f"⚠️ Error fetching {name}: {e}")

file_path = "climate_engine/data/socio_vault.json"
with open(file_path, "w") as f:
    json.dump(vault_data, f, indent=4)

print(f"✅ BOOM! Vault Created Successfully at '{file_path}'")
print(f"🌍 Total Countries Data Fetched: {len(vault_data)}")
