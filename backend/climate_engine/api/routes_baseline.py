"""
climate_engine/api/routes_baseline.py — Historical Baseline Endpoint

Identical architecture to routes_projection.py.
Differences only:
  - is_projection = False  (hardcoded)
  - scenario = historical  (hardcoded — user cannot override)
  - No delta_t, no adapt_alpha
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from climate_engine.api.schemas import BaselineRequest, ErrorResponse, ProjectionResponse
from climate_engine.audit.input_hashing import compute_checksum
from climate_engine.config import default_config
from climate_engine.db.models import ClimateScenario
from climate_engine.db.session import get_async_session
from climate_engine.services.scenario_runner import RunParameters, execute_scenario_run

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/baseline", tags=["Baseline"])


@router.post(
    "/run",
    response_model=ProjectionResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Run a historical baseline mortality computation",
)
async def run_baseline(
    payload: BaselineRequest,
    db: AsyncSession = Depends(get_async_session),
) -> ProjectionResponse:

    input_checksum = compute_checksum(payload.model_dump(mode="json"))
    config         = default_config()

    params = RunParameters(
        scenario=ClimateScenario.historical,      # hardcoded — not user-supplied
        projection_start_year=payload.baseline_start_year,
        projection_end_year=payload.baseline_end_year,
        is_projection=False,                       # hardcoded
        monte_carlo_seed=payload.monte_carlo_seed,
        n_monte_carlo=payload.n_monte_carlo,
        ac_rate=payload.ac_rate,
        ac_efficiency_phi=payload.ac_efficiency_phi,
        delta_t_mean=0.0,                          # no temperature delta for baseline
        population_scaler=1.0,
        adapt_alpha=0.0,                           # no adaptation for baseline
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

    duration_s = (
        (scenario_run.completed_at - scenario_run.started_at).total_seconds()
        if scenario_run.completed_at and scenario_run.started_at else None
    )

    return ProjectionResponse(
        run_id=scenario_run.id,
        status=scenario_run.status,
        scenario=ClimateScenario.historical,
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