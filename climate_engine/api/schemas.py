"""
climate_engine/api/schemas.py — API Request & Response Contracts

Rules:
  - No pandas, no numpy, no ORM objects cross this boundary.
  - All inputs validated by Pydantic before any route logic runs.
  - Enums imported from models.py — single source of truth.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from climate_engine.db.models import ClimateScenario, RunStatus


def _validate_year_range(start: int, end: int) -> None:
    if start >= end:
        raise ValueError(
            f"start_year ({start}) must be strictly less than end_year ({end})."
        )
    if start < 1900 or end > 2200:
        raise ValueError(
            f"Year range [{start}, {end}] outside supported window [1900, 2200]."
        )


# ---------------------------------------------------------------------------
# ProjectionRequest
# ---------------------------------------------------------------------------

class ProjectionRequest(BaseModel):
    scenario:              ClimateScenario = Field(..., description="CMIP6 scenario", examples=["SSP2-4.5"])
    projection_start_year: int             = Field(..., ge=2000, le=2100)
    projection_end_year:   int             = Field(..., ge=2001, le=2200)
    delta_t_mean:          float           = Field(..., ge=-5.0, le=10.0,  description="Temperature anomaly (°C)")
    ac_rate:               float           = Field(..., ge=0.0,  le=1.0,   description="AC access rate [0, 1]")
    population_scaler:     float           = Field(default=1.0, ge=0.1, le=10.0)
    adapt_alpha:           float           = Field(default=0.0, ge=0.0, le=1.0,  description="Adaptation coefficient [0, 1]")
    ac_efficiency_phi:     float           = Field(default=0.5, ge=0.0, le=1.0,  description="AC dampening efficiency φ [0, 1]")
    monte_carlo_seed:      int             = Field(default=42,  ge=0)
    n_monte_carlo:         int             = Field(default=0,   ge=0, le=10_000)
    triggered_by:          Optional[str]   = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_years(self) -> "ProjectionRequest":
        _validate_year_range(self.projection_start_year, self.projection_end_year)
        return self

    model_config = {"use_enum_values": False}


# ---------------------------------------------------------------------------
# BaselineRequest
# ---------------------------------------------------------------------------

class BaselineRequest(BaseModel):
    baseline_start_year: int           = Field(..., ge=1900, le=2024)
    baseline_end_year:   int           = Field(..., ge=1901, le=2025)
    ac_rate:             float         = Field(..., ge=0.0,  le=1.0)
    ac_efficiency_phi:   float         = Field(default=0.5, ge=0.0, le=1.0)
    monte_carlo_seed:    int           = Field(default=42,  ge=0)
    n_monte_carlo:       int           = Field(default=0,   ge=0, le=10_000)
    triggered_by:        Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_years(self) -> "BaselineRequest":
        _validate_year_range(self.baseline_start_year, self.baseline_end_year)
        return self


# ---------------------------------------------------------------------------
# ProjectionResponse
# ---------------------------------------------------------------------------

class ProjectionResponse(BaseModel):
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
    git_commit_hash:      Optional[str]   = None
    started_at:           Optional[datetime] = None
    completed_at:         Optional[datetime] = None
    duration_seconds:     Optional[float] = None

    model_config = {"use_enum_values": False}


# ---------------------------------------------------------------------------
# Utility schemas
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    error:  str
    detail: str
    run_id: Optional[int] = None


class HealthResponse(BaseModel):
    status:       str = "ok"
    env_mode:     str
    db_reachable: bool


class VersionResponse(BaseModel):
    engine_version:  str
    api_version:     str
    git_commit_hash: Optional[str] = None