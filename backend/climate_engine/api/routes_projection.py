"""
climate_engine/api/routes_projection.py — Projection Run Endpoint

Route responsibilities (only):
  1. Validate request schema.
  2. Compute input checksum.
  3. Build RunParameters.
  4. Call scenario_runner.execute_scenario_run().
  5. Return ProjectionResponse.

Zero science. Zero DB batching. Zero business logic.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from climate_engine.api.schemas import ErrorResponse, ProjectionRequest, ProjectionResponse
from climate_engine.audit.input_hashing import compute_checksum
from climate_engine.config import default_config
from climate_engine.db.models import RunStatus, ScenarioRun
from climate_engine.db.session import get_async_session
from climate_engine.services.scenario_runner import RunParameters, execute_scenario_run

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projection", tags=["Projection"])


@router.post(
    "/run",
    response_model=ProjectionResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Run a future climate mortality projection",
)
async def run_projection(
    payload: ProjectionRequest,
    db: AsyncSession = Depends(get_async_session),
) -> ProjectionResponse:

    input_checksum = compute_checksum(payload.model_dump(mode="json"))
    config         = default_config()

    params = RunParameters(
        scenario=payload.scenario,
        projection_start_year=payload.projection_start_year,
        projection_end_year=payload.projection_end_year,
        is_projection=True,
        monte_carlo_seed=payload.monte_carlo_seed,
        n_monte_carlo=payload.n_monte_carlo,
        ac_rate=payload.ac_rate,
        ac_efficiency_phi=payload.ac_efficiency_phi,
        delta_t_mean=payload.delta_t_mean,
        population_scaler=payload.population_scaler,
        adapt_alpha=payload.adapt_alpha,
        triggered_by=payload.triggered_by,
        input_checksum=input_checksum,
    )

    try:
        scenario_run, agg = await execute_scenario_run(params=params, db=db, config=config)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "ENGINE_FAILURE", "detail": str(exc)},
        ) from exc

    meta = scenario_run.run_metadata or {}
    duration_s = (
        (scenario_run.completed_at - scenario_run.started_at).total_seconds()
        if scenario_run.completed_at and scenario_run.started_at else None
    )

    return ProjectionResponse(
        run_id=scenario_run.id,
        status=scenario_run.status,
        scenario=scenario_run.scenario,
        attributable_deaths=agg.total_attributable_deaths,
        ac_dampened_deaths=agg.total_ac_dampened_deaths,
        yll=agg.total_yll,
        max_temperature=agg.max_temperature if agg.max_temperature != float("-inf") else 0.0,
        mean_rr=agg.mean_rr,
        n_cells=agg.n_cells,
        deaths_ci_lower=None,
        deaths_ci_upper=None,
        config_checksum=scenario_run.config_checksum,
        input_checksum=input_checksum,
        git_commit_hash=scenario_run.git_commit_hash,
        started_at=scenario_run.started_at,
        completed_at=scenario_run.completed_at,
        duration_seconds=duration_s,
    )


@router.get("/{run_id}", response_model=ProjectionResponse, summary="Get projection run by ID")
async def get_projection(
    run_id: int,
    db: AsyncSession = Depends(get_async_session),
) -> ProjectionResponse:
    result = await db.execute(select(ScenarioRun).where(ScenarioRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "NOT_FOUND", "detail": f"ScenarioRun id={run_id} not found."},
        )
    meta = run.run_metadata or {}
    return ProjectionResponse(
        run_id=run.id,
        status=run.status,
        scenario=run.scenario,
        attributable_deaths=meta.get("total_attributable_deaths", 0.0),
        ac_dampened_deaths=meta.get("total_ac_dampened_deaths",   0.0),
        yll=meta.get("total_yll", 0.0),
        max_temperature=meta.get("max_temperature", 0.0),
        mean_rr=meta.get("mean_rr", 1.0),
        n_cells=meta.get("n_cells", 0),
        config_checksum=run.config_checksum,
        input_checksum=meta.get("input_checksum", ""),
        git_commit_hash=run.git_commit_hash,
        started_at=run.started_at,
        completed_at=run.completed_at,
        duration_seconds=(
            (run.completed_at - run.started_at).total_seconds()
            if run.completed_at and run.started_at else None
        ),
    )