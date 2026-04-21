import wbgapi as wb
import json
import time
import os

file_path = "climate_engine/data/socio_vault.json"

if not os.path.exists(file_path):
    print("❌ Error: socio_vault.json not found!")
    exit()

with open(file_path, "r") as f:
    vault_data = json.load(f)

# Sirf wahi indicators jo fail huye the
missing_indicators = {
    'SH.MED.PHYS.ZS': 'physicians_per1000',
    'SP.POP.0014.TO.ZS': 'pct_under15',
    'SP.POP.65UP.TO.ZS': 'pct_over65'
}

print("🩹 Patching missing indicators (Physicians & Age)...")

for code, name in missing_indicators.items():
    print(f"⏳ Fetching {name}... ", end="", flush=True)
    try:
        # Requesting data
        df = wb.data.DataFrame(code, mrv=1, labels=False)
        for country_code, row in df.iterrows():
            if country_code in vault_data:
                import pandas as pd
                val = row.iloc[0]
                vault_data[country_code][name] = round(float(val), 3) if pd.notna(val) else None
        print("✅ Success!")
        time.sleep(5) # 5 second ka gap taaki 502 na aaye wapas
    except Exception as e:
        print(f"❌ Failed again: {e}")

with open(file_path, "w") as f:
    json.dump(vault_data, f, indent=4)

print("\n🚀 VAULT FULLY PATCHED & READY!")
