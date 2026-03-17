import requests
import json
import time

BASE_URL = "https://albus2903-openplanet-engine.hf.space"

def run_speed_test():
    print("\n" + "="*60)
    print("🌍 OPENPLANET BACKEND SPEED & HEALTH TEST")
    print("="*60)

    print("\n[1] Testing /api/climate-risk (Compare Module)...")
    risk_payload = {
        "lat": 22.57,
        "lng": 88.36,
        "elevation": 9.0,
        "ssp": "ssp245",
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": "Kolkata"
    }
    
    start_time = time.time()
    try:
        res = requests.post(f"{BASE_URL}/api/climate-risk", json=risk_payload, timeout=60)
        end_time = time.time()
        
        print(f"HTTP Status: {res.status_code}")
        print(f"Time Taken: {round(end_time - start_time, 2)} seconds ⚡")
        
        if res.status_code == 200:
            data = res.json()
            if "error" in data:
                print(f"❌ Logical Error: {data['error']}")
            else:
                print("\n✅ SUCCESS! Data snippet:")
                print(f"Baseline Temp: {data.get('baseline', {}).get('baseline_mean_c')}°C")
                print(f"Projections Count: {len(data.get('projections', []))}")
                print("First Projection Data:")
                if data.get('projections'):
                    print(json.dumps(data['projections'][0], indent=2))
        else:
            print(f"🔥 RAW ERROR: {res.text}")
            
    except Exception as e:
        print(f"Network Error: {e}")
        
    print("\n" + "="*60)

if __name__ == "__main__":
    run_speed_test()