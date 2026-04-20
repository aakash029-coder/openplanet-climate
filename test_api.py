#!/usr/bin/env python3
"""
test_api.py — OpenPlanet Climate Engine Comprehensive API Test Suite

This script performs end-to-end validation of all API endpoints with:
- Root health check
- Climate risk endpoint (multiple cities across climate zones)
- Prediction endpoint
- Research analysis endpoint
- Compare analysis endpoint
- Error handling validation
- Rate limiting behavior
- Edge cases (cold climates, extreme heat zones, ocean coordinates)

Usage:
    python test_api.py [--base-url URL] [--verbose] [--quick]

Requirements:
    pip install requests rich
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

try:
    import requests
    from requests.exceptions import RequestException, Timeout, ConnectionError
except ImportError:
    print("❌ Missing dependency: requests")
    print("   Run: pip install requests")
    sys.exit(1)

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("⚠️  Optional: Install 'rich' for prettier output: pip install rich")


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_BASE_URL = "http://localhost:7860"
REQUEST_TIMEOUT = 60  # seconds — CMIP6 queries can be slow
RETRY_ATTEMPTS = 2
RETRY_DELAY = 2  # seconds between retries


# ═══════════════════════════════════════════════════════════════════════════════
# TEST DATA — Global City Coverage
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TestCity:
    """Test city configuration with expected behavior hints."""
    name: str
    lat: float
    lng: float
    country: str
    climate_zone: str  # Expected zone type
    expect_high_risk: bool = False
    expect_cold: bool = False
    notes: str = ""


# Comprehensive global coverage — tests different climate archetypes
TEST_CITIES: List[TestCity] = [
    # ─── LETHAL HUMID ZONES (Should trigger high WBT warnings) ────────────────
    TestCity(
        name="Jacobabad",
        lat=28.2766,
        lng=68.4502,
        country="Pakistan",
        climate_zone="LETHAL_HUMID",
        expect_high_risk=True,
        notes="One of the hottest cities on Earth — WBT should approach danger threshold"
    ),
    TestCity(
        name="Dubai",
        lat=25.2048,
        lng=55.2708,
        country="UAE",
        climate_zone="HYPER_ARID",
        expect_high_risk=True,
        notes="Gulf region — extreme heat but low humidity"
    ),
    TestCity(
        name="Chennai",
        lat=13.0827,
        lng=80.2707,
        country="India",
        climate_zone="LETHAL_HUMID",
        expect_high_risk=True,
        notes="Tropical coastal — high heat + humidity combination"
    ),
    
    # ─── STANDARD TROPICAL / SUBTROPICAL ──────────────────────────────────────
    TestCity(
        name="Mumbai",
        lat=19.0760,
        lng=72.8777,
        country="India",
        climate_zone="STANDARD",
        expect_high_risk=True,
        notes="Monsoon climate — seasonal humidity variation"
    ),
    TestCity(
        name="Lagos",
        lat=6.5244,
        lng=3.3792,
        country="Nigeria",
        climate_zone="STANDARD",
        expect_high_risk=True,
        notes="West African tropical — growing megacity"
    ),
    TestCity(
        name="Bangkok",
        lat=13.7563,
        lng=100.5018,
        country="Thailand",
        climate_zone="STANDARD",
        expect_high_risk=True,
        notes="Southeast Asian tropical monsoon"
    ),
    
    # ─── EXTREME CONTINENTAL (Large seasonal variance) ────────────────────────
    TestCity(
        name="Beijing",
        lat=39.9042,
        lng=116.4074,
        country="China",
        climate_zone="EXTREME_CONTINENTAL",
        expect_high_risk=False,
        notes="Hot summers but cold winters — continental extreme"
    ),
    TestCity(
        name="Chicago",
        lat=41.8781,
        lng=-87.6298,
        country="USA",
        climate_zone="EXTREME_CONTINENTAL",
        expect_high_risk=False,
        notes="Midwest continental — large thermal amplitude"
    ),
    
    # ─── TEMPERATE (Moderate risk) ────────────────────────────────────────────
    TestCity(
        name="London",
        lat=51.5074,
        lng=-0.1278,
        country="UK",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Maritime temperate — historically low heat risk"
    ),
    TestCity(
        name="Paris",
        lat=48.8566,
        lng=2.3522,
        country="France",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Oceanic climate — 2003 heatwave memory"
    ),
    TestCity(
        name="Tokyo",
        lat=35.6762,
        lng=139.6503,
        country="Japan",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Humid subtropical — increasing heat events"
    ),
    
    # ─── COLD / PERMAFROST (Should suppress heat risk) ────────────────────────
    TestCity(
        name="Reykjavik",
        lat=64.1466,
        lng=-21.9426,
        country="Iceland",
        climate_zone="PERMAFROST",
        expect_high_risk=False,
        expect_cold=True,
        notes="Subarctic — heat risk should be minimal"
    ),
    TestCity(
        name="Moscow",
        lat=55.7558,
        lng=37.6173,
        country="Russia",
        climate_zone="EXTREME_CONTINENTAL",
        expect_high_risk=False,
        notes="Continental — cold baseline but hot summer peaks"
    ),
    
    # ─── HYPER-ARID DESERTS ───────────────────────────────────────────────────
    TestCity(
        name="Phoenix",
        lat=33.4484,
        lng=-112.0740,
        country="USA",
        climate_zone="HYPER_ARID",
        expect_high_risk=True,
        notes="Sonoran Desert — extreme dry heat"
    ),
    TestCity(
        name="Riyadh",
        lat=24.7136,
        lng=46.6753,
        country="Saudi Arabia",
        climate_zone="HYPER_ARID",
        expect_high_risk=True,
        notes="Arabian Peninsula interior — extreme aridity"
    ),
    
    # ─── SOUTHERN HEMISPHERE ──────────────────────────────────────────────────
    TestCity(
        name="Sydney",
        lat=-33.8688,
        lng=151.2093,
        country="Australia",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Southern hemisphere — tests hemisphere-aware logic"
    ),
    TestCity(
        name="Cape Town",
        lat=-33.9249,
        lng=18.4241,
        country="South Africa",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Mediterranean climate — southern hemisphere"
    ),
    TestCity(
        name="São Paulo",
        lat=-23.5505,
        lng=-46.6333,
        country="Brazil",
        climate_zone="STANDARD",
        expect_high_risk=False,
        notes="Subtropical highland — large population"
    ),
]

# Quick test subset for fast validation
QUICK_TEST_CITIES = ["Jacobabad", "London", "Tokyo", "Phoenix", "Reykjavik"]


# ═══════════════════════════════════════════════════════════════════════════════
# TEST RESULT TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TestResult:
    """Individual test result."""
    name: str
    passed: bool
    duration_ms: float
    details: str = ""
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class TestSuite:
    """Aggregated test results."""
    results: List[TestResult] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def add(self, result: TestResult) -> None:
        self.results.append(result)
    
    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)
    
    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.passed)
    
    @property
    def total(self) -> int:
        return len(self.results)
    
    @property
    def success_rate(self) -> float:
        return (self.passed / self.total * 100) if self.total > 0 else 0.0
    
    @property
    def total_duration_ms(self) -> float:
        return sum(r.duration_ms for r in self.results)


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP CLIENT WITH RETRY LOGIC
# ═══════════════════════════════════════════════════════════════════════════════

class APIClient:
    """HTTP client with retry logic and timing."""
    
    def __init__(self, base_url: str, verbose: bool = False):
        self.base_url = base_url.rstrip("/")
        self.verbose = verbose
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "OpenPlanet-TestSuite/1.0"
        })
    
    def _log(self, msg: str) -> None:
        if self.verbose:
            print(f"    [DEBUG] {msg}")
    
    def get(self, endpoint: str) -> Tuple[Optional[Dict], float, Optional[str]]:
        """GET request with timing. Returns (data, duration_ms, error)."""
        url = f"{self.base_url}{endpoint}"
        self._log(f"GET {url}")
        
        for attempt in range(RETRY_ATTEMPTS + 1):
            try:
                start = time.perf_counter()
                response = self.session.get(url, timeout=REQUEST_TIMEOUT)
                duration_ms = (time.perf_counter() - start) * 1000
                
                if response.status_code == 200:
                    return response.json(), duration_ms, None
                elif response.status_code == 429:
                    # Rate limited — wait and retry
                    self._log(f"Rate limited (429), waiting {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                else:
                    return None, duration_ms, f"HTTP {response.status_code}: {response.text[:200]}"
                    
            except Timeout:
                self._log(f"Timeout on attempt {attempt + 1}")
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY)
                    continue
                return None, REQUEST_TIMEOUT * 1000, "Request timed out"
            except ConnectionError as e:
                return None, 0, f"Connection failed: {e}"
            except Exception as e:
                return None, 0, f"Unexpected error: {e}"
        
        return None, 0, "Max retries exceeded"
    
    def post(self, endpoint: str, payload: Dict) -> Tuple[Optional[Dict], float, Optional[str]]:
        """POST request with timing. Returns (data, duration_ms, error)."""
        url = f"{self.base_url}{endpoint}"
        self._log(f"POST {url}")
        self._log(f"Payload: {json.dumps(payload, indent=2)[:500]}")
        
        for attempt in range(RETRY_ATTEMPTS + 1):
            try:
                start = time.perf_counter()
                response = self.session.post(
                    url, 
                    json=payload, 
                    timeout=REQUEST_TIMEOUT
                )
                duration_ms = (time.perf_counter() - start) * 1000
                
                if response.status_code == 200:
                    return response.json(), duration_ms, None
                elif response.status_code == 429:
                    self._log(f"Rate limited (429), waiting {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                elif response.status_code == 404:
                    # Data unavailable — this is expected for some edge cases
                    try:
                        error_detail = response.json().get("detail", response.text[:200])
                    except:
                        error_detail = response.text[:200]
                    return None, duration_ms, f"HTTP 404: {error_detail}"
                elif response.status_code == 422:
                    # Validation error
                    try:
                        error_detail = response.json()
                    except:
                        error_detail = response.text[:200]
                    return None, duration_ms, f"HTTP 422 Validation Error: {error_detail}"
                else:
                    return None, duration_ms, f"HTTP {response.status_code}: {response.text[:200]}"
                    
            except Timeout:
                self._log(f"Timeout on attempt {attempt + 1}")
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY)
                    continue
                return None, REQUEST_TIMEOUT * 1000, "Request timed out"
            except ConnectionError as e:
                return None, 0, f"Connection failed: {e}"
            except Exception as e:
                return None, 0, f"Unexpected error: {e}"
        
        return None, 0, "Max retries exceeded"


# ═══════════════════════════════════════════════════════════════════════════════
# TEST IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def test_root_health(client: APIClient) -> TestResult:
    """Test root endpoint health check."""
    data, duration_ms, error = client.get("/")
    
    if error:
        return TestResult(
            name="Root Health Check",
            passed=False,
            duration_ms=duration_ms,
            error=error
        )
    
    status = data.get("status", "")
    if "OpenPlanet" in status or "Engine" in status or status == "ok":
        return TestResult(
            name="Root Health Check",
            passed=True,
            duration_ms=duration_ms,
            details=f"Status: {status}",
            response_data=data
        )
    
    return TestResult(
        name="Root Health Check",
        passed=False,
        duration_ms=duration_ms,
        details=f"Unexpected status: {status}",
        response_data=data
    )


def test_climate_risk(client: APIClient, city: TestCity) -> TestResult:
    """Test /api/climate-risk endpoint for a specific city."""
    payload = {
        "lat": city.lat,
        "lng": city.lng,
        "elevation": 50.0,
        "ssp": "SSP2-4.5",
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": f"{city.name}, {city.country}"
    }
    
    data, duration_ms, error = client.post("/api/climate-risk", payload)
    
    if error:
        # Check if it's an expected 404 for data unavailability
        if "404" in error and "unavailable" in error.lower():
            return TestResult(
                name=f"Climate Risk: {city.name}",
                passed=False,  # Still a failure, but expected for some locations
                duration_ms=duration_ms,
                details=f"Data unavailable (expected for remote locations)",
                error=error
            )
        return TestResult(
            name=f"Climate Risk: {city.name}",
            passed=False,
            duration_ms=duration_ms,
            error=error
        )
    
    # Validate response structure
    validation_errors = []
    
    # Required top-level keys
    required_keys = ["threshold_c", "projections", "baseline"]
    for key in required_keys:
        if key not in data:
            validation_errors.append(f"Missing key: {key}")
    
    # Validate projections
    projections = data.get("projections", [])
    if not projections:
        validation_errors.append("Empty projections array")
    else:
        # Check for expected years
        years = {p.get("year") for p in projections}
        if 2050 not in years:
            validation_errors.append("Missing 2050 projection")
        
        # Validate projection structure
        for proj in projections:
            if proj.get("year") == 2050:
                required_proj_keys = [
                    "heatwave_days", "peak_tx5d_c", "attributable_deaths",
                    "economic_decay_usd", "wbt_max_c", "survivability_status"
                ]
                for key in required_proj_keys:
                    if key not in proj:
                        validation_errors.append(f"2050 projection missing: {key}")
                
                # Validate survivability status
                surv_status = proj.get("survivability_status", "")
                if surv_status not in ["STABLE", "DANGER", "CRITICAL"]:
                    validation_errors.append(f"Invalid survivability_status: {surv_status}")
                
                # Check climate zone detection
                if "climate_zone" in proj:
                    zone = proj["climate_zone"]
                    if zone not in [
                        "PERMAFROST_ZONE", "HYPER_ARID_DESERT", 
                        "LETHAL_HUMID_ZONE", "EXTREME_CONTINENTAL", "STANDARD_ZONE"
                    ]:
                        validation_errors.append(f"Invalid climate_zone: {zone}")
    
    # Validate baseline
    baseline = data.get("baseline", {})
    if "baseline_mean_c" not in baseline:
        validation_errors.append("Missing baseline_mean_c")
    
    # Check cold city logic
    if city.expect_cold:
        baseline_temp = baseline.get("baseline_mean_c", 30)
        if isinstance(baseline_temp, (int, float)) and baseline_temp > 20:
            validation_errors.append(
                f"Cold city {city.name} has high baseline temp: {baseline_temp}°C"
            )
    
    if validation_errors:
        return TestResult(
            name=f"Climate Risk: {city.name}",
            passed=False,
            duration_ms=duration_ms,
            details="; ".join(validation_errors),
            response_data=data
        )
    
    # Extract key metrics for details
    proj_2050 = next((p for p in projections if p.get("year") == 2050), {})
    details_parts = [
        f"P95={data.get('threshold_c', 'N/A')}°C",
        f"WBT={proj_2050.get('wbt_max_c', 'N/A')}°C",
        f"Status={proj_2050.get('survivability_status', 'N/A')}",
        f"Zone={proj_2050.get('climate_zone', 'N/A')}",
    ]
    
    return TestResult(
        name=f"Climate Risk: {city.name}",
        passed=True,
        duration_ms=duration_ms,
        details=" | ".join(details_parts),
        response_data=data
    )


def test_predict(client: APIClient, city: TestCity) -> TestResult:
    """Test /api/predict endpoint."""
    payload = {
        "city": city.name,
        "lat": city.lat,
        "lng": city.lng,
        "ssp": "SSP2-4.5",
        "year": "2050",
        "canopy": 10,
        "coolRoof": 10
    }
    
    data, duration_ms, error = client.post("/api/predict", payload)
    
    if error:
        return TestResult(
            name=f"Predict: {city.name}",
            passed=False,
            duration_ms=duration_ms,
            error=error
        )
    
    # Validate response structure
    validation_errors = []
    
    required_keys = ["metrics", "charts"]
    for key in required_keys:
        if key not in data:
            validation_errors.append(f"Missing key: {key}")
    
    metrics = data.get("metrics", {})
    required_metrics = ["temp", "deaths", "loss", "heatwave", "wbt"]
    for key in required_metrics:
        if key not in metrics:
            validation_errors.append(f"Missing metric: {key}")
    
    # Validate charts structure
    charts = data.get("charts", {})
    if "heatwave" not in charts:
        validation_errors.append("Missing heatwave chart")
    if "economic" not in charts:
        validation_errors.append("Missing economic chart")
    
    if validation_errors:
        return TestResult(
            name=f"Predict: {city.name}",
            passed=False,
            duration_ms=duration_ms,
            details="; ".join(validation_errors),
            response_data=data
        )
    
    details_parts = [
        f"Temp={metrics.get('temp', 'N/A')}°C",
        f"Deaths={metrics.get('deaths', 'N/A')}",
        f"Loss={metrics.get('loss', 'N/A')}",
        f"WBT={metrics.get('wbt', 'N/A')}°C",
    ]
    
    return TestResult(
        name=f"Predict: {city.name}",
        passed=True,
        duration_ms=duration_ms,
        details=" | ".join(details_parts),
        response_data=data
    )


def test_research_analysis(client: APIClient) -> TestResult:
    """Test /api/research-analysis endpoint."""
    payload = {
        "city_name": "Tokyo",
        "context": "Urban heat island analysis for infrastructure planning",
        "metrics": {
            "temp": "38.5",
            "elevation": "40m",
            "heatwave": "45 days",
            "loss": "$2.3B"
        }
    }
    
    data, duration_ms, error = client.post("/api/research-analysis", payload)
    
    if error:
        return TestResult(
            name="Research Analysis",
            passed=False,
            duration_ms=duration_ms,
            error=error
        )
    
    if "reasoning" not in data:
        return TestResult(
            name="Research Analysis",
            passed=False,
            duration_ms=duration_ms,
            details="Missing 'reasoning' in response",
            response_data=data
        )
    
    reasoning = data.get("reasoning", "")
    if len(reasoning) < 50:
        return TestResult(
            name="Research Analysis",
            passed=False,
            duration_ms=duration_ms,
            details=f"Reasoning too short ({len(reasoning)} chars)",
            response_data=data
        )
    
    return TestResult(
        name="Research Analysis",
        passed=True,
        duration_ms=duration_ms,
        details=f"Generated {len(reasoning)} char analysis",
        response_data=data
    )


def test_compare_analysis(client: APIClient) -> TestResult:
    """Test /api/compare-analysis endpoint."""
    payload = {
        "city_a": "Tokyo",
        "city_b": "Mumbai",
        "data_a": {
            "peak_tx5d_c": 36.5,
            "heatwave_days": 25,
            "attributable_deaths": 1200,
            "economic_decay_usd": 2_500_000_000,
            "wbt_max_c": 28.5,
            "region": "East Asia"
        },
        "data_b": {
            "peak_tx5d_c": 39.2,
            "heatwave_days": 55,
            "attributable_deaths": 4500,
            "economic_decay_usd": 8_200_000_000,
            "wbt_max_c": 32.1,
            "region": "South Asia"
        }
    }
    
    data, duration_ms, error = client.post("/api/compare-analysis", payload)
    
    if error:
        return TestResult(
            name="Compare Analysis",
            passed=False,
            duration_ms=duration_ms,
            error=error
        )
    
    if "comparison" not in data:
        return TestResult(
            name="Compare Analysis",
            passed=False,
            duration_ms=duration_ms,
            details="Missing 'comparison' in response",
            response_data=data
        )
    
    comparison = data.get("comparison", "")
    if len(comparison) < 50:
        return TestResult(
            name="Compare Analysis",
            passed=False,
            duration_ms=duration_ms,
            details=f"Comparison too short ({len(comparison)} chars)",
            response_data=data
        )
    
    return TestResult(
        name="Compare Analysis",
        passed=True,
        duration_ms=duration_ms,
        details=f"Generated {len(comparison)} char comparison",
        response_data=data
    )


def test_invalid_coordinates(client: APIClient) -> TestResult:
    """Test that invalid coordinates are rejected with 422."""
    payload = {
        "lat": 999.0,  # Invalid latitude
        "lng": 68.4502,
        "elevation": 50.0,
        "ssp": "SSP2-4.5",
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": "Invalid City"
    }
    
    data, duration_ms, error = client.post("/api/climate-risk", payload)
    
    # We EXPECT this to fail with 422
    if error and "422" in error:
        return TestResult(
            name="Validation: Invalid Coordinates",
            passed=True,
            duration_ms=duration_ms,
            details="Correctly rejected invalid latitude with 422"
        )
    
    return TestResult(
        name="Validation: Invalid Coordinates",
        passed=False,
        duration_ms=duration_ms,
        details=f"Expected 422 error, got: {error or 'success'}",
        response_data=data
    )


def test_invalid_ssp(client: APIClient) -> TestResult:
    """Test that invalid SSP scenario is rejected."""
    payload = {
        "lat": 35.6762,
        "lng": 139.6503,
        "elevation": 40.0,
        "ssp": "INVALID-SSP",  # Invalid SSP
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": "Tokyo"
    }
    
    data, duration_ms, error = client.post("/api/climate-risk", payload)
    
    # We EXPECT this to fail with 422
    if error and "422" in error:
        return TestResult(
            name="Validation: Invalid SSP",
            passed=True,
            duration_ms=duration_ms,
            details="Correctly rejected invalid SSP with 422"
        )
    
    # Some implementations might normalize invalid SSPs — check if it still works
    if data and "projections" in data:
        return TestResult(
            name="Validation: Invalid SSP",
            passed=True,  # Graceful handling is acceptable
            duration_ms=duration_ms,
            details="Gracefully handled invalid SSP with fallback"
        )
    
    return TestResult(
        name="Validation: Invalid SSP",
        passed=False,
        duration_ms=duration_ms,
        details=f"Unexpected response: {error or data}",
        response_data=data
    )


def test_ocean_coordinates(client: APIClient) -> TestResult:
    """Test coordinates in the middle of the ocean (should handle gracefully)."""
    payload = {
        "lat": 0.0,
        "lng": -160.0,  # Middle of Pacific Ocean
        "elevation": 0.0,
        "ssp": "SSP2-4.5",
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": "Pacific Ocean"
    }
    
    data, duration_ms, error = client.post("/api/climate-risk", payload)
    
    # Ocean coordinates should either:
    # 1. Return valid data (if land mask is not applied)
    # 2. Return 404 (if land mask filters ocean cells)
    # 3. Return data with empty/minimal hex grid
    
    if error and "404" in error:
        return TestResult(
            name="Edge Case: Ocean Coordinates",
            passed=True,
            duration_ms=duration_ms,
            details="Correctly identified as non-land location"
        )
    
    if data:
        hex_grid = data.get("hexGrid", [])
        return TestResult(
            name="Edge Case: Ocean Coordinates",
            passed=True,
            duration_ms=duration_ms,
            details=f"Handled gracefully with {len(hex_grid)} hex cells"
        )
    
    return TestResult(
        name="Edge Case: Ocean Coordinates",
        passed=False,
        duration_ms=duration_ms,
        error=error
    )


# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUT FORMATTERS
# ═══════════════════════════════════════════════════════════════════════════════

def print_result_simple(result: TestResult) -> None:
    """Simple text output for terminals without rich."""
    status = "✅" if result.passed else "❌"
    print(f"{status} {result.name} ({result.duration_ms:.0f}ms)")
    if result.details:
        print(f"   {result.details}")
    if result.error:
        print(f"   ERROR: {result.error}")


def print_result_rich(console: Console, result: TestResult) -> None:
    """Rich formatted output."""
    status = "[green]✅ PASS[/green]" if result.passed else "[red]❌ FAIL[/red]"
    console.print(f"{status} [bold]{result.name}[/bold] [dim]({result.duration_ms:.0f}ms)[/dim]")
    if result.details:
        console.print(f"   [dim]{result.details}[/dim]")
    if result.error:
        console.print(f"   [red]ERROR: {result.error}[/red]")


def print_summary_simple(suite: TestSuite) -> None:
    """Simple text summary."""
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests:  {suite.total}")
    print(f"Passed:       {suite.passed}")
    print(f"Failed:       {suite.failed}")
    print(f"Success Rate: {suite.success_rate:.1f}%")
    print(f"Total Time:   {suite.total_duration_ms / 1000:.1f}s")
    print("=" * 60)
    
    if suite.failed > 0:
        print("\nFAILED TESTS:")
        for r in suite.results:
            if not r.passed:
                print(f"  - {r.name}: {r.error or r.details}")


def print_summary_rich(console: Console, suite: TestSuite) -> None:
    """Rich formatted summary."""
    table = Table(title="Test Results Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green" if suite.failed == 0 else "yellow")
    
    table.add_row("Total Tests", str(suite.total))
    table.add_row("Passed", f"[green]{suite.passed}[/green]")
    table.add_row("Failed", f"[red]{suite.failed}[/red]" if suite.failed > 0 else "0")
    table.add_row("Success Rate", f"{suite.success_rate:.1f}%")
    table.add_row("Total Duration", f"{suite.total_duration_ms / 1000:.1f}s")
    
    console.print("\n")
    console.print(table)
    
    if suite.failed > 0:
        console.print("\n[bold red]Failed Tests:[/bold red]")
        for r in suite.results:
            if not r.passed:
                console.print(f"  [red]•[/red] {r.name}")
                if r.error:
                    console.print(f"    [dim]{r.error[:100]}...[/dim]")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def run_tests(
    base_url: str,
    verbose: bool = False,
    quick: bool = False
) -> TestSuite:
    """Run all tests and return results."""
    
    client = APIClient(base_url, verbose=verbose)
    suite = TestSuite()
    suite.start_time = datetime.now()
    
    # Determine which cities to test
    if quick:
        cities_to_test = [c for c in TEST_CITIES if c.name in QUICK_TEST_CITIES]
        print(f"🚀 Quick mode: Testing {len(cities_to_test)} cities\n")
    else:
        cities_to_test = TEST_CITIES
        print(f"🌍 Full mode: Testing {len(cities_to_test)} cities globally\n")
    
    # Console for rich output
    console = Console() if RICH_AVAILABLE else None
    
    def output_result(result: TestResult):
        if RICH_AVAILABLE:
            print_result_rich(console, result)
        else:
            print_result_simple(result)
    
    # ─── PHASE 1: Health Check ────────────────────────────────────────────────
    print("=" * 60)
    print("PHASE 1: Server Health Check")
    print("=" * 60)
    
    result = test_root_health(client)
    suite.add(result)
    output_result(result)
    
    if not result.passed:
        print("\n❌ SERVER IS DOWN. Aborting tests.")
        print(f"   Make sure the server is running at: {base_url}")
        suite.end_time = datetime.now()
        return suite
    
    print()
    
    # ─── PHASE 2: Climate Risk Tests ──────────────────────────────────────────
    print("=" * 60)
    print("PHASE 2: Climate Risk Endpoint (/api/climate-risk)")
    print("=" * 60)
    
    for city in cities_to_test:
        result = test_climate_risk(client, city)
        suite.add(result)
        output_result(result)
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    print()
    
    # ─── PHASE 3: Predict Tests ───────────────────────────────────────────────
    print("=" * 60)
    print("PHASE 3: Prediction Endpoint (/api/predict)")
    print("=" * 60)
    
    # Test a subset of cities for predict
    predict_cities = cities_to_test[:3] if quick else cities_to_test[:5]
    for city in predict_cities:
        result = test_predict(client, city)
        suite.add(result)
        output_result(result)
        time.sleep(0.5)
    
    print()
    
    # ─── PHASE 4: AI Analysis Tests ───────────────────────────────────────────
    print("=" * 60)
    print("PHASE 4: AI Analysis Endpoints")
    print("=" * 60)
    
    result = test_research_analysis(client)
    suite.add(result)
    output_result(result)
    
    result = test_compare_analysis(client)
    suite.add(result)
    output_result(result)
    
    print()
    
    # ─── PHASE 5: Validation & Edge Cases ─────────────────────────────────────
    print("=" * 60)
    print("PHASE 5: Validation & Edge Cases")
    print("=" * 60)
    
    result = test_invalid_coordinates(client)
    suite.add(result)
    output_result(result)
    
    result = test_invalid_ssp(client)
    suite.add(result)
    output_result(result)
    
    result = test_ocean_coordinates(client)
    suite.add(result)
    output_result(result)
    
    print()
    
    suite.end_time = datetime.now()
    return suite


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="OpenPlanet Climate Engine API Test Suite"
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"API base URL (default: {DEFAULT_BASE_URL})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose debug output"
    )
    parser.add_argument(
        "--quick", "-q",
        action="store_true",
        help="Run quick test with subset of cities"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🌍 OpenPlanet Climate Engine — API Test Suite")
    print("=" * 60)
    print(f"Target: {args.base_url}")
    print(f"Mode:   {'Quick' if args.quick else 'Full'}")
    print(f"Time:   {datetime.now().isoformat()}")
    print("=" * 60)
    print()
    
    suite = run_tests(
        base_url=args.base_url,
        verbose=args.verbose,
        quick=args.quick
    )
    
    # Print summary
    if RICH_AVAILABLE:
        console = Console()
        print_summary_rich(console, suite)
    else:
        print_summary_simple(suite)
    
    # Exit with appropriate code
    sys.exit(0 if suite.failed == 0 else 1)


if __name__ == "__main__":
    main()
