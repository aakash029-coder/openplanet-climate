import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_diagnostic():
    print("\n" + "="*50)
    print("🚀 INITIATING BACKEND DIAGNOSTIC SUITE")
    print("="*50 + "\n")

    # TEST 1: The Validation API
    print("Testing 1/3: /api/era5-threshold (Validation Module)")
    try:
        r1 = requests.post(f"{BASE_URL}/api/era5-threshold", json={"lat": 51.51, "lng": -0.13})
        print(f"Status: {r1.status_code}")
        print(f"Response: {json.dumps(r1.json(), indent=2)}\n")
    except Exception as e:
        print(f"❌ FAILED: {e}\n")

    # TEST 2: The Core Engine API
    print("Testing 2/3: /api/climate-risk (Research & Compare Modules)")
    try:
        r2 = requests.post(f"{BASE_URL}/api/climate-risk", json={
            "lat": 51.51, "lng": -0.13, "elevation": 11.0, 
            "ssp": "ssp245", "canopy_offset_pct": 5, "albedo_offset_pct": 15, 
            "location_hint": "London, UK"
        })
        print(f"Status: {r2.status_code}")
        # Only printing the first 300 chars so it doesn't flood your terminal
        print(f"Response: {json.dumps(r2.json(), indent=2)[:300]} ... [TRUNCATED]\n")
    except Exception as e:
        print(f"❌ FAILED: {e}\n")

    # TEST 3: The Map Prediction API
    print("Testing 3/3: /api/predict (Map Module & AI)")
    try:
        r3 = requests.post(f"{BASE_URL}/api/predict", json={
            "city": "London", "lat": 51.51, "lng": -0.13, 
            "ssp": "SSP2-4.5", "year": "2050", "canopy": 5, "coolRoof": 15
        })
        print(f"Status: {r3.status_code}")
        print(f"Response: {json.dumps(r3.json(), indent=2)[:300]} ... [TRUNCATED]\n")
    except Exception as e:
        print(f"❌ FAILED: {e}\n")

if __name__ == "__main__":
    run_diagnostic()