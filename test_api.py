import requests
import json

BASE_URL = "http://localhost:7860"

print("🔄 Testing OpenPlanet Backend...\n")

# 1. Test Root
try:
    res = requests.get(f"{BASE_URL}/")
    print(f"✅ ROOT STATUS: {res.json().get('status', 'OK')}\n")
except Exception as e:
    print(f"❌ SERVER IS DOWN: Make sure FastAPI is running. Error: {e}")
    exit()

# 2. Test Climate Risk Payload
payload = {
    "lat": 28.2766,
    "lng": 68.4502,
    "elevation": 55.0,
    "ssp": "ssp245",
    "canopy_offset_pct": 0,
    "albedo_offset_pct": 0,
    "location_hint": "Jacobabad"
}

print("🌍 Fetching Climate Risk for Jacobabad...")
try:
    response = requests.post(f"{BASE_URL}/api/climate-risk", json=payload)
    response.raise_for_status()  # 🚨 Catch 500/422 errors immediately
    data = response.json()
    
    # Prettify and print specific parts to check if engine logic worked
    print("\n--- RESULTS ---")
    print(f"Baseline Mean Temp: {data.get('baseline', {}).get('baseline_mean_c')}°C")
    print(f"ERA5 P95 Humidity: {data.get('era5_humidity_p95')}%")
    
    # Check 2050 projection
    proj_2050 = next((p for p in data.get('projections', []) if p['year'] == 2050), None)
    if proj_2050:
        print(f"2050 Region Detected: {proj_2050.get('region')}")
        print(f"2050 WBT Max: {proj_2050.get('wbt_max_c')}°C")
        print(f"2050 Survivability: {proj_2050.get('survivability_status')}")
    else:
        print("❌ 2050 Projection missing!")
        
except Exception as e:
    print(f"❌ API CALL FAILED: {e}")