"""
climate_engine/api/schemas.py — API Request & Response Contracts

Rules:
- No pandas, no numpy, no ORM objects cross this boundary.
- All inputs validated by Pydantic before any route logic runs.
- Enums defined internally — now 100% Stateless.
- Zero arbitrary defaults — all scientific parameters must be explicit.
- No silent fallback values for external-data fields.

Scientific Parameters:
- All temperature values in Celsius.
- All rates / fractions in [0, 1].
- All years within CMIP6 coverage (1850–2300).
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Enums (Moved here from deleted models.py to remain stateless)
# ---------------------------------------------------------------------------

class ClimateScenario(str, enum.Enum):
    historical = "historical"
    ssp119 = "SSP1-1.9"
    ssp126 = "SSP1-2.6"
    ssp245 = "SSP2-4.5"
    ssp370 = "SSP3-7.0"
    ssp434 = "SSP4-3.4"
    ssp460 = "SSP4-6.0"
    ssp534 = "SSP5-3.4"
    ssp585 = "SSP5-8.5"

class RunStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


def _validate_year_range(start: int, end: int) -> None:
    """
    Assert that a year range is scientifically valid.

    Raises:
        ValueError: If the range is invalid or outside the supported window.
    """
    if start >= end:
        raise ValueError(
            f"start_year ({start}) must be strictly less than end_year ({end})."
        )
    if start < 1900 or end > 2200:
        raise ValueError(
            f"Year range [{start}, {end}] is outside the supported window [1900, 2200]."
        )


# ---------------------------------------------------------------------------
# OpenPlanet Simulation Schemas (Frontend API)
# ---------------------------------------------------------------------------

class PredictionRequest(BaseModel):
    """Request schema for frontend climate risk prediction."""

    city:     str   = Field(..., min_length=2, max_length=100)
    lat:      float = Field(..., ge=-90.0,  le=90.0)
    lng:      float = Field(..., ge=-180.0, le=180.0)
    ssp:      str   = Field(..., pattern=r"^SSP[1-5]-[0-9.]+$")
    year:     str   = Field(..., pattern=r"^(20[0-9]{2}|2100)$")
    canopy:   int   = Field(..., ge=0, le=100)
    coolRoof: int   = Field(..., ge=0, le=100)

    @model_validator(mode="after")
    def city_not_blank(self) -> "PredictionRequest":
        if not self.city.strip():
            raise ValueError("city must not be blank or whitespace only.")
        return self


class ClimateRiskRequest(BaseModel):
    """Request schema for detailed climate risk analysis."""

    lat:               float = Field(..., ge=-90.0,  le=90.0)
    lng:               float = Field(..., ge=-180.0, le=180.0)
    elevation:         float = Field(default=0.0, ge=-500.0, le=9000.0)
    ssp:               str   = Field(..., pattern=r"^SSP[1-5]-[0-9.]+$")
    canopy_offset_pct: int   = Field(..., ge=0, le=100)
    albedo_offset_pct: int   = Field(..., ge=0, le=100)
    location_hint:     str   = Field(..., min_length=2, max_length=200,
                                     description="Must contain at least a city name.")

    @model_validator(mode="after")
    def location_hint_has_city(self) -> "ClimateRiskRequest":
        city_part = self.location_hint.split(",")[0].strip()
        if not city_part:
            raise ValueError(
                "location_hint must begin with a city name "
                "(e.g. 'Mumbai, India' or 'Lagos')."
            )
        return self


class ResearchAIRequest(BaseModel):
    """Request schema for AI analysis generation."""

    city_name: str              = Field(..., min_length=2, max_length=100)
    metrics:   Dict[str, Any]
    context:   str              = Field(..., min_length=10, max_length=5000)


class CompareAnalysisRequest(BaseModel):
    """Request schema for city comparison analysis."""

    city_a: str              = Field(..., min_length=2, max_length=100)
    city_b: str              = Field(..., min_length=2, max_length=100)
    data_a: Dict[str, Any]
    data_b: Dict[str, Any]

    @model_validator(mode="after")
    def cities_differ(self) -> "CompareAnalysisRequest":
        if self.city_a.strip().lower() == self.city_b.strip().lower():
            raise ValueError("city_a and city_b must be different cities.")
        return self


class SimulationResponse(BaseModel):
    """Response schema for frontend simulation results."""

    metrics:     Dict[str, Any]
    hexGrid:     List[Dict[str, Any]]  # Empty list — spatial rendering via PMTiles
    aiAnalysis:  Optional[Dict[str, str]]  = None
    auditTrail:  Optional[Dict[str, Any]]  = None
    charts:      Dict[str, List[Dict[str, Any]]]


# ---------------------------------------------------------------------------
# Projection & Baseline Engine Schemas
# ---------------------------------------------------------------------------

class ProjectionRequest(BaseModel):
    """Request schema for climate projection runs."""

    scenario:               ClimateScenario = Field(
        ...,
        description="CMIP6 scenario identifier",
    )
    projection_start_year:  int   = Field(..., ge=2000, le=2100)
    projection_end_year:    int   = Field(..., ge=2001, le=2200)
    delta_t_mean:           float = Field(
        ..., ge=-5.0, le=10.0,
        description="Temperature anomaly relative to 1850–1900 baseline (°C)",
    )
    ac_rate:                float = Field(..., ge=0.0, le=1.0,
                                          description="Air conditioning access rate [0, 1]")
    population_scaler:      float = Field(default=1.0, ge=0.1, le=10.0,
                                          description="Population projection multiplier")
    adapt_alpha:            float = Field(default=0.0, ge=0.0, le=1.0,
                                          description="Adaptation coefficient [0, 1]")
    ac_efficiency_phi:      float = Field(default=0.5, ge=0.0, le=1.0,
                                          description="AC dampening efficiency φ [0, 1]")
    monte_carlo_seed:       int   = Field(default=42, ge=0)
    n_monte_carlo:          int   = Field(
        default=0, ge=0, le=10_000,
        description="Monte Carlo iterations (0 = deterministic)",
    )
    triggered_by:           Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_years(self) -> "ProjectionRequest":
        _validate_year_range(self.projection_start_year, self.projection_end_year)
        return self

    model_config = {"use_enum_values": True}


class BaselineRequest(BaseModel):
    """Request schema for historical baseline runs."""

    baseline_start_year: int   = Field(..., ge=1900, le=2024)
    baseline_end_year:   int   = Field(..., ge=1901, le=2025)
    ac_rate:             float = Field(..., ge=0.0, le=1.0,
                                       description="Historical AC access rate [0, 1]")
    ac_efficiency_phi:   float = Field(default=0.5, ge=0.0, le=1.0,
                                       description="AC dampening efficiency φ [0, 1]")
    monte_carlo_seed:    int   = Field(default=42, ge=0)
    n_monte_carlo:       int   = Field(default=0, ge=0, le=10_000)
    triggered_by:        Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_years(self) -> "BaselineRequest":
        _validate_year_range(self.baseline_start_year, self.baseline_end_year)
        return self


class ProjectionResponse(BaseModel):
    """Response schema for projection run results."""

    run_id:               int
    status:               RunStatus
    scenario:             ClimateScenario
    attributable_deaths:  float
    ac_dampened_deaths:   float
    yll:                  float
    max_temperature:      float
    mean_rr:              float
    n_cells:              int
    deaths_ci_lower:      Optional[float] = None
    deaths_ci_upper:      Optional[float] = None
    config_checksum:      str
    input_checksum:       str
    git_commit_hash:      Optional[str]      = None
    started_at:           Optional[datetime] = None
    completed_at:         Optional[datetime] = None
    duration_seconds:     Optional[float]    = None

    model_config = {"use_enum_values": True}


# ---------------------------------------------------------------------------
# Utility Schemas
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    """Standard error response."""
    error:  str
    detail: str
    run_id: Optional[int] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status:       str  = "ok"
    env_mode:     str
    db_reachable: bool


class VersionResponse(BaseModel):
    """Version information response."""
    engine_version:  str
    api_version:     str
    git_commit_hash: Optional[str] = None