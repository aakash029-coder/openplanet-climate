"""
climate_engine/services/scenario_runner.py — Scenario Run Orchestrator

Architectural role
──────────────────
This is the ONLY place where DB operations and engine calls are combined.

Routes:     validate request → call this service → return response.
This file:  idempotency check → ScenarioRun lifecycle → streaming H3 load
            → batched engine calls → bulk MortalityResult inserts → aggregation.
Engine:     pure science, no DB, no HTTP.

Global-tier rules enforced here
────────────────────────────────
- Idempotency: duplicate runs detected by checksum before any INSERT.
- Streaming:   H3Cell rows streamed, never full-table loaded into memory.
- Batching:    MortalityResult rows bulk-inserted in slices of BATCH_SIZE.
- No row-by-row inserts.
- No unbounded in-memory accumulation.
- Science layer called per batch, not per row.
- Every failure persisted to ScenarioRun.error_message before re-raise.

Timing guarantee
────────────────
VersionControl.stamp() is created AFTER ScenarioRun is flushed (run_id known)
and BEFORE _stream_and_process() is called. stamp.finish() is called
immediately after streaming completes. elapsed_s measures only actual
engine computation + DB insert time.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from climate_engine.config import ConfigManager, default_config
from climate_engine.db.models import (
    ClimateScenario,
    H3Cell,
    MortalityResult,
    RunStatus,
    ScenarioRun,
)
from climate_engine.version import ENGINE_VERSION, VersionControl

logger = logging.getLogger(__name__)

BATCH_SIZE = 2000


# ---------------------------------------------------------------------------
# RunParameters
# ---------------------------------------------------------------------------

@dataclass
class RunParameters:
    """
    Decoupled from HTTP schemas.
    Populated by route handlers from validated request schemas.
    """
    scenario:              ClimateScenario
    projection_start_year: int
    projection_end_year:   int
    is_projection:         bool
    monte_carlo_seed:      int
    n_monte_carlo:         int
    ac_rate:               float
    ac_efficiency_phi:     float
    delta_t_mean:          float        = 0.0
    population_scaler:     float        = 1.0
    adapt_alpha:           float        = 0.0
    triggered_by:          Optional[str]= None
    input_checksum:        str          = ""


# ---------------------------------------------------------------------------
# RunAggregates
# ---------------------------------------------------------------------------

@dataclass
class RunAggregates:
    total_attributable_deaths: float = 0.0
    total_ac_dampened_deaths:  float = 0.0
    total_yll:                 float = 0.0
    max_temperature:           float = float("-inf")
    mean_rr_sum:               float = 0.0
    n_cells:                   int   = 0

    def absorb(self, batch_aggregates: dict) -> None:
        self.total_attributable_deaths += batch_aggregates.get("attributable_deaths", 0.0)
        self.total_ac_dampened_deaths  += batch_aggregates.get("ac_dampened_deaths",  0.0)
        self.total_yll                 += batch_aggregates.get("yll",                 0.0)
        self.max_temperature            = max(
            self.max_temperature,
            batch_aggregates.get("max_temperature", float("-inf")),
        )
        self.mean_rr_sum += batch_aggregates.get("mean_rr_sum", 0.0)
        self.n_cells     += batch_aggregates.get("n_cells",     0)

    @property
    def mean_rr(self) -> float:
        return self.mean_rr_sum / self.n_cells if self.n_cells > 0 else 1.0


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def execute_scenario_run(
    params: RunParameters,
    db: AsyncSession,
    config: Optional[ConfigManager] = None,
) -> tuple[ScenarioRun, RunAggregates]:
    """
    Full scenario run lifecycle.

    Returns (scenario_run, aggregates) on success.
    On failure: ScenarioRun.status=failed is flushed before re-raising.

    Steps
    ─────
    1.  Build config + compute config_checksum via VersionControl.hash_config().
    2.  Idempotency check — return existing completed run if checksums match.
    3.  INSERT ScenarioRun (status=running), flush to get run_id.
    4.  Create VersionControl stamp — timing starts HERE.
    5.  Stream H3Cell rows in batches of BATCH_SIZE.
    6.  For each batch: call science engine, bulk INSERT MortalityResult.
    7.  Accumulate aggregates.
    8.  stamp.finish() — elapsed_s captures engine + insert time only.
    9.  UPDATE ScenarioRun (status=completed, run_metadata, completed_at).
    """

    if config is None:
        config = default_config()

    config_checksum = VersionControl.hash_config(config)
    git_commit_hash = os.environ.get("GIT_COMMIT_SHA")

    # ── STEP 1 — Idempotency check ───────────────────────────────────────────
    existing = await _find_existing_run(db, params, config_checksum)
    if existing is not None:
        logger.info(
            "scenario_runner: Duplicate run detected (checksum=%.12s...). "
            "Returning existing run_id=%d.",
            config_checksum, existing.id,
        )
        return existing, _aggregates_from_metadata(existing.run_metadata or {})

    # ── STEP 2 — INSERT ScenarioRun (status=running) ─────────────────────────
    started_at   = datetime.now(timezone.utc)
    scenario_run = ScenarioRun(
        engine_version=ENGINE_VERSION,
        config_checksum=config_checksum,
        monte_carlo_seed=params.monte_carlo_seed,
        n_monte_carlo=params.n_monte_carlo,
        scenario=params.scenario,
        projection_start_year=params.projection_start_year,
        projection_end_year=params.projection_end_year,
        is_projection=params.is_projection,
        status=RunStatus.running,
        started_at=started_at,
        triggered_by=params.triggered_by,
        git_commit_hash=git_commit_hash,
    )
    db.add(scenario_run)
    await db.flush()
    run_id = scenario_run.id
    logger.info(
        "scenario_runner: ScenarioRun id=%d created (scenario=%s, seed=%d).",
        run_id, params.scenario.value, params.monte_carlo_seed,
    )

    # ── STEP 3 — Create stamp (timing starts here, after flush) ──────────────
    stamp = VersionControl.stamp(
        config,
        seed=params.monte_carlo_seed,
        projection_mode=params.is_projection,
        n_monte_carlo=params.n_monte_carlo,
    )

    # ── STEP 4 — Stream + batch process ──────────────────────────────────────
    aggregates = RunAggregates()

    try:
        await _stream_and_process(
            db=db,
            scenario_run=scenario_run,
            params=params,
            config=config,
            aggregates=aggregates,
        )

        # ── STEP 5 — Finish stamp immediately after streaming ─────────────────
        stamp = stamp.finish()

        # ── STEP 6 — Mark completed ───────────────────────────────────────────
        completed_at = datetime.now(timezone.utc)

        scenario_run.status       = RunStatus.completed
        scenario_run.completed_at = completed_at
        scenario_run.run_metadata = stamp.to_metadata(extra={
            "input_checksum":            params.input_checksum,
            "delta_t_mean":              params.delta_t_mean,
            "ac_rate":                   params.ac_rate,
            "adapt_alpha":               params.adapt_alpha,
            "total_attributable_deaths": aggregates.total_attributable_deaths,
            "total_ac_dampened_deaths":  aggregates.total_ac_dampened_deaths,
            "total_yll":                 aggregates.total_yll,
            "max_temperature":           aggregates.max_temperature,
            "mean_rr":                   aggregates.mean_rr,
            "n_cells":                   aggregates.n_cells,
            "duration_seconds":          stamp.elapsed_s,
        })

        logger.info(
            "scenario_runner: run_id=%d completed in %.3fs — "
            "n_cells=%d, attributable_deaths=%.4f.",
            run_id,
            stamp.elapsed_s,
            aggregates.n_cells,
            aggregates.total_attributable_deaths,
        )

    except Exception as exc:
        # No silent failure — always persist error before re-raising
        completed_at = datetime.now(timezone.utc)
        scenario_run.status        = RunStatus.failed
        scenario_run.completed_at  = completed_at
        scenario_run.error_message = f"{type(exc).__name__}: {exc}"
        await db.flush()
        logger.exception(
            "scenario_runner: run_id=%d FAILED after %.3fs.",
            run_id,
            (completed_at - started_at).total_seconds(),
        )
        raise

    return scenario_run, aggregates


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _find_existing_run(
    db: AsyncSession,
    params: RunParameters,
    config_checksum: str,
) -> Optional[ScenarioRun]:
    """Return a completed ScenarioRun if an identical run already exists."""
    result = await db.execute(
        select(ScenarioRun).where(
            ScenarioRun.config_checksum       == config_checksum,
            ScenarioRun.monte_carlo_seed      == params.monte_carlo_seed,
            ScenarioRun.scenario              == params.scenario,
            ScenarioRun.projection_start_year == params.projection_start_year,
            ScenarioRun.projection_end_year   == params.projection_end_year,
            ScenarioRun.status                == RunStatus.completed,
        )
    )
    return result.scalar_one_or_none()


async def _stream_and_process(
    db: AsyncSession,
    scenario_run: ScenarioRun,
    params: RunParameters,
    config: ConfigManager,
    aggregates: RunAggregates,
) -> None:
    """
    Stream H3Cell rows and process in batches of BATCH_SIZE.

    Memory contract
    ───────────────
    At any point, at most BATCH_SIZE H3Cell rows + BATCH_SIZE result dicts
    are held in Python memory. The DB cursor holds the rest server-side.
    """
    from climate_engine.services.engine_bridge import run_engine_batch

    stream = await db.stream(
        select(H3Cell)
        .where(H3Cell.population.is_not(None))
        .execution_options(yield_per=BATCH_SIZE)
    )

    async for partition in stream.partitions(BATCH_SIZE):
        batch = list(partition)
        if not batch:
            continue

        # db passed explicitly — engine_bridge queries ClimateObservation,
        # MortalityBaseline, and LifeTable using the same session.
        mortality_rows, batch_agg = await run_engine_batch(
            cells=batch,
            scenario_run_id=scenario_run.id,
            params=params,
            config=config,
            db=db,
        )

        if mortality_rows:
            await db.execute(
                pg_insert(MortalityResult),
                mortality_rows,
            )

        aggregates.absorb(batch_agg)
        logger.debug(
            "scenario_runner: run_id=%d — batch %d cells inserted "
            "(running total: %d).",
            scenario_run.id, len(batch), aggregates.n_cells,
        )

    logger.info(
        "scenario_runner: run_id=%d — streaming complete, %d total cells.",
        scenario_run.id, aggregates.n_cells,
    )


def _aggregates_from_metadata(meta: dict) -> RunAggregates:
    """Reconstruct RunAggregates from stored run_metadata (idempotency fast-path)."""
    agg = RunAggregates()
    agg.total_attributable_deaths = meta.get("total_attributable_deaths", 0.0)
    agg.total_ac_dampened_deaths  = meta.get("total_ac_dampened_deaths",  0.0)
    agg.total_yll                 = meta.get("total_yll",                 0.0)
    agg.max_temperature           = meta.get("max_temperature",           0.0)
    agg.n_cells                   = meta.get("n_cells",                   0)
    agg.mean_rr_sum               = meta.get("mean_rr", 1.0) * agg.n_cells
    return agg