"""
climate_engine/db/models.py — ORM Schema

Tables
──────
  1. H3Cell              — spatial registry (PostGIS + GiST)
  2. ClimateObservation  — per-cell climate readings
  3. MortalityResult     — per-cell mortality outputs + CHECK constraints
  4. ScenarioRun         — run audit + reproducibility metadata
  5. MortalityBaseline   — country/age-stratified baseline mortality rates
  6. LifeTable           — WHO life-table: life expectancy remaining by country/age

Requirements:
    pip install geoalchemy2
    CREATE EXTENSION IF NOT EXISTS postgis;
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from climate_engine.db.base import Base, created_at, intpk, updated_at


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RunStatus(str, enum.Enum):
    pending   = "pending"
    running   = "running"
    completed = "completed"
    failed    = "failed"


class ClimateScenario(str, enum.Enum):
    ssp126     = "SSP1-2.6"
    ssp245     = "SSP2-4.5"
    ssp370     = "SSP3-7.0"
    ssp585     = "SSP5-8.5"
    historical = "historical"


# ---------------------------------------------------------------------------
# 1. H3Cell
# ---------------------------------------------------------------------------

class H3Cell(Base):
    __tablename__ = "h3_cells"

    id:            Mapped[intpk]
    h3_index:      Mapped[str]             = mapped_column(String(20),  nullable=False, unique=True, index=True, comment="H3 cell index (e.g. 8928308280fffff)")
    h3_resolution: Mapped[int]             = mapped_column(Integer,     nullable=False, comment="H3 resolution 0–15")
    centroid_lat:  Mapped[float]           = mapped_column(Float,       nullable=False, comment="Centroid latitude WGS84")
    centroid_lon:  Mapped[float]           = mapped_column(Float,       nullable=False, comment="Centroid longitude WGS84")
    geometry:      Mapped[Optional[object]]= mapped_column(Geometry("POLYGON", srid=4326), nullable=True, comment="Cell polygon (PostGIS EPSG:4326)")
    country_iso2:  Mapped[Optional[str]]   = mapped_column(String(2),   nullable=True,  index=True, comment="ISO 3166-1 alpha-2")
    is_urban:      Mapped[Optional[bool]]  = mapped_column(Boolean,     nullable=True)
    is_tropical:   Mapped[bool]            = mapped_column(Boolean,     nullable=False, server_default=text("false"))
    elevation_m:   Mapped[Optional[float]] = mapped_column(Float,       nullable=True,  comment="Mean elevation metres")
    population:    Mapped[Optional[float]] = mapped_column(Float,       nullable=True)
    climate_zone:  Mapped[Optional[str]]   = mapped_column(String(8),   nullable=True,  comment="Köppen climate zone code e.g. Af, Cfa")
    created_at:    Mapped[created_at]
    updated_at:    Mapped[updated_at]

    climate_observations: Mapped[list["ClimateObservation"]] = relationship(
        back_populates="h3_cell", cascade="all, delete-orphan", passive_deletes=True
    )
    mortality_results: Mapped[list["MortalityResult"]] = relationship(
        back_populates="h3_cell", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index("ix_h3_cells_geometry_gist",       "geometry",    postgresql_using="gist"),
        Index("ix_h3_cells_country_resolution",  "country_iso2","h3_resolution"),
    )


# ---------------------------------------------------------------------------
# 2. ClimateObservation
# ---------------------------------------------------------------------------

class ClimateObservation(Base):
    __tablename__ = "climate_observations"

    id:               Mapped[intpk]
    h3_cell_id:       Mapped[int]                       = mapped_column(BigInteger, ForeignKey("h3_cells.id", ondelete="CASCADE"), nullable=False, index=True)
    observed_at:      Mapped[datetime]                  = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    temp_c:           Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Air temp 2m (°C)")
    temp_max_c:       Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Daily max (°C)")
    temp_min_c:       Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Daily min (°C)")
    wetbulb_c:        Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Wet-bulb (°C)")
    humidity_frac:    Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Relative humidity 0–1")
    wind_speed_ms:    Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Wind speed m/s")
    precipitation_mm: Mapped[Optional[float]]           = mapped_column(Float, nullable=True, comment="Precipitation mm")
    data_source:      Mapped[str]                       = mapped_column(String(64), nullable=False, index=True)
    scenario:         Mapped[Optional[ClimateScenario]] = mapped_column(SAEnum(ClimateScenario, name="climate_scenario_enum"), nullable=True)
    quality_flag:     Mapped[Optional[int]]             = mapped_column(Integer, nullable=True)
    created_at:       Mapped[created_at]

    h3_cell: Mapped["H3Cell"] = relationship(back_populates="climate_observations")

    __table_args__ = (
        UniqueConstraint("h3_cell_id", "observed_at", "data_source", name="uq_climate_obs_cell_time_source"),
        Index("ix_climate_obs_cell_time", "h3_cell_id", "observed_at"),
        Index("ix_climate_obs_time",      "observed_at"),
        Index("ix_climate_obs_scenario",  "scenario"),
    )


# ---------------------------------------------------------------------------
# 3. MortalityResult
# ---------------------------------------------------------------------------

class MortalityResult(Base):
    __tablename__ = "mortality_results"

    id:                  Mapped[intpk]
    h3_cell_id:          Mapped[int]            = mapped_column(BigInteger, ForeignKey("h3_cells.id",      ondelete="CASCADE"), nullable=False, index=True)
    scenario_run_id:     Mapped[int]            = mapped_column(BigInteger, ForeignKey("scenario_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start:        Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    period_end:          Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    rr:                  Mapped[Optional[float]]= mapped_column(Numeric(10, 6), nullable=True, comment="Relative risk")
    af:                  Mapped[Optional[float]]= mapped_column(Numeric(10, 6), nullable=True, comment="Attributable fraction")
    baseline_deaths:     Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    attributable_deaths: Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    ac_dampened_deaths:  Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    yll:                 Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True, comment="Years of Life Lost")
    deaths_ci_lower:     Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    deaths_ci_upper:     Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    deaths_std:          Mapped[Optional[float]]= mapped_column(Numeric(16, 4), nullable=True)
    beta_used:           Mapped[Optional[float]]= mapped_column(Float, nullable=True)
    kappa_used:          Mapped[Optional[float]]= mapped_column(Float, nullable=True)
    created_at:          Mapped[created_at]

    h3_cell:      Mapped["H3Cell"]      = relationship(back_populates="mortality_results")
    scenario_run: Mapped["ScenarioRun"] = relationship(back_populates="mortality_results")

    __table_args__ = (
        UniqueConstraint("h3_cell_id", "scenario_run_id", "period_start", name="uq_mortality_cell_run_period"),
        Index("ix_mortality_run_cell", "scenario_run_id", "h3_cell_id"),
        Index("ix_mortality_run",      "scenario_run_id"),
        Index("ix_mortality_period",   "period_start", "period_end"),
        CheckConstraint("rr >= 0",                 name="ck_rr_positive"),
        CheckConstraint("af >= 0 AND af <= 1",      name="ck_af_bounds"),
        CheckConstraint("attributable_deaths >= 0", name="ck_attr_deaths_positive"),
    )


# ---------------------------------------------------------------------------
# 4. ScenarioRun
# ---------------------------------------------------------------------------

class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id:                    Mapped[intpk]
    engine_version:        Mapped[str]                = mapped_column(String(32),  nullable=False)
    config_checksum:       Mapped[str]                = mapped_column(String(64),  nullable=False, index=True)
    monte_carlo_seed:      Mapped[int]                = mapped_column(BigInteger,  nullable=False)
    n_monte_carlo:         Mapped[int]                = mapped_column(Integer,     nullable=False, server_default=text("0"))
    scenario:              Mapped[ClimateScenario]    = mapped_column(SAEnum(ClimateScenario, name="climate_scenario_enum"), nullable=False, index=True)
    projection_start_year: Mapped[int]                = mapped_column(Integer,     nullable=False)
    projection_end_year:   Mapped[int]                = mapped_column(Integer,     nullable=False)
    is_projection:         Mapped[bool]               = mapped_column(Boolean,     nullable=False, server_default=text("false"))
    status:                Mapped[RunStatus]          = mapped_column(SAEnum(RunStatus, name="run_status_enum"), nullable=False, server_default=text("'pending'"), index=True)
    started_at:            Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at:          Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message:         Mapped[Optional[str]]      = mapped_column(Text,        nullable=True)
    run_metadata:          Mapped[Optional[dict]]     = mapped_column(JSONB,       nullable=True)
    triggered_by:          Mapped[Optional[str]]      = mapped_column(String(128), nullable=True)
    git_commit_hash:       Mapped[Optional[str]]      = mapped_column(String(40),  nullable=True)
    created_at:            Mapped[created_at]
    updated_at:            Mapped[updated_at]

    mortality_results: Mapped[list["MortalityResult"]] = relationship(
        back_populates="scenario_run", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint(
            "config_checksum", "monte_carlo_seed", "scenario",
            "projection_start_year", "projection_end_year",
            name="uq_scenario_run_reproducibility",
        ),
        Index("ix_scenario_runs_status_created", "status",   "created_at"),
        Index("ix_scenario_runs_scenario_year",  "scenario", "projection_start_year"),
        Index("ix_scenario_runs_metadata_gin",   "run_metadata", postgresql_using="gin"),
    )


# ---------------------------------------------------------------------------
# 5. MortalityBaseline — country/age-stratified baseline mortality rates
# ---------------------------------------------------------------------------

class MortalityBaseline(Base):
    """
    Country and age-stratified all-cause baseline mortality rates.

    Source: WHO Global Health Observatory / GBD study.
    One row = one country × one age group × one reference year.

    mortality_rate is the annual all-cause death rate for this stratum
    (deaths per person per year). Divide by 365 for daily rate.

    Used by engine_bridge._build_computation_df() to replace the
    hardcoded 0.008 / 365.0 placeholder.
    """
    __tablename__ = "mortality_baselines"

    id:             Mapped[intpk]
    country_iso2:   Mapped[str]   = mapped_column(String(2),  nullable=False, index=True, comment="ISO 3166-1 alpha-2")
    age_group_low:  Mapped[int]   = mapped_column(Integer,    nullable=False, comment="Age group lower bound (inclusive)")
    age_group_high: Mapped[int]   = mapped_column(Integer,    nullable=False, comment="Age group upper bound (exclusive)")
    reference_year: Mapped[int]   = mapped_column(Integer,    nullable=False, comment="Reference year for this rate")
    mortality_rate: Mapped[float] = mapped_column(Float,      nullable=False, comment="Annual all-cause mortality rate (deaths/person/year)")
    data_source:    Mapped[str]   = mapped_column(String(128),nullable=False, comment="Source dataset (e.g. WHO_GHO_2019)")
    created_at:     Mapped[created_at]

    __table_args__ = (
        UniqueConstraint(
            "country_iso2", "age_group_low", "age_group_high", "reference_year",
            name="uq_mortality_baseline_stratum",
        ),
        Index("ix_mortality_baseline_country_year", "country_iso2", "reference_year"),
        CheckConstraint("mortality_rate > 0",              name="ck_mortality_rate_positive"),
        CheckConstraint("age_group_low >= 0",              name="ck_age_low_nonneg"),
        CheckConstraint("age_group_low < age_group_high",  name="ck_age_bounds"),
    )


# ---------------------------------------------------------------------------
# 6. LifeTable — WHO life expectancy remaining by country and age
# ---------------------------------------------------------------------------

class LifeTable(Base):
    """
    WHO life-table: remaining life expectancy by country and age group.

    One row = one country × one age group × one reference year.
    life_expectancy_remaining is the expected years of life left
    for a person at the midpoint of the age group.

    Used by engine_bridge._build_computation_df() to replace the
    hardcoded 12.0 years placeholder.
    """
    __tablename__ = "life_tables"

    id:                      Mapped[intpk]
    country_iso2:            Mapped[str]   = mapped_column(String(2),  nullable=False, index=True)
    age_group_low:           Mapped[int]   = mapped_column(Integer,    nullable=False)
    age_group_high:          Mapped[int]   = mapped_column(Integer,    nullable=False)
    reference_year:          Mapped[int]   = mapped_column(Integer,    nullable=False)
    life_expectancy_remaining: Mapped[float] = mapped_column(Float,    nullable=False, comment="Expected years of life remaining at age group midpoint")
    data_source:             Mapped[str]   = mapped_column(String(128),nullable=False)
    created_at:              Mapped[created_at]

    __table_args__ = (
        UniqueConstraint(
            "country_iso2", "age_group_low", "age_group_high", "reference_year",
            name="uq_life_table_stratum",
        ),
        Index("ix_life_table_country_year", "country_iso2", "reference_year"),
        CheckConstraint("life_expectancy_remaining > 0", name="ck_lex_positive"),
        CheckConstraint("age_group_low >= 0",            name="ck_lt_age_low_nonneg"),
        CheckConstraint("age_group_low < age_group_high",name="ck_lt_age_bounds"),
    )