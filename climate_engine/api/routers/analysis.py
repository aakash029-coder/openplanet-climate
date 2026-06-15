"""
climate_engine/api/routers/analysis.py — AI analysis endpoints.

Mounts:
  POST /api/research-analysis
  POST /api/compare-analysis
"""
from __future__ import annotations

import logging
import re

from fastapi import Request, Response
from fastapi.routing import APIRouter

from climate_engine.api.security import get_rate_limit_string, limiter
from climate_engine.api.schemas import ResearchAIRequest, CompareAnalysisRequest
from climate_engine.services.llm_service import (
    generate_strategic_analysis_raw,
    generate_compare_analysis,
)

logger = logging.getLogger(__name__)

router = APIRouter()
_rate_limit = get_rate_limit_string()


@router.post("/api/research-analysis", tags=["Analysis"])
@limiter.limit(_rate_limit)
async def research_analysis(request: Request, req: ResearchAIRequest, response: Response):
    logger.info(
        "[research-analysis] city=%r  context=%r  metrics_keys=%s",
        req.city_name,
        req.context,
        list(req.metrics.keys()),
    )
    prompt = (
        "[SYSTEM: SCIENTIFIC AUDIT MODE]\n"
        f"Context: {req.context}\n"
        f"Write a cohesive 3-4 sentence executive summary for {req.city_name}.\n"
        "REAL METRICS (Open-Meteo ERA5 + CMIP6 + World Bank):\n"
        f"- Peak Tx5d: {req.metrics.get('temp')}\n"
        f"- Elevation: {req.metrics.get('elevation')}\n"
        f"- Annual heatwave/heat-stress days: {req.metrics.get('heatwave')}\n"
        f"- Economic loss: {req.metrics.get('loss')}\n"
        "RULES: ONE paragraph. No lists. No bullets. "
        "Authoritative IPCC scientist tone. Use exact numbers provided."
    )
    try:
        raw = await generate_strategic_analysis_raw(prompt)
        clean = raw.replace("**", "").replace("*", "").replace("\n", " ").strip()
        clean = re.sub(r"\b\d+\.\s", "", clean)
        return {"reasoning": clean}
    except Exception as exc:
        logger.error("[research-analysis] LLM error: %s", exc)
        return {"reasoning": "Scientific reasoning temporarily unavailable."}


@router.post("/api/compare-analysis", tags=["Analysis"])
@limiter.limit(_rate_limit)
async def compare_analysis(request: Request, req: CompareAnalysisRequest, response: Response):
    logger.info(
        "[compare-analysis] city_a=%r  city_b=%r",
        req.city_a,
        req.city_b,
    )
    try:
        comparison = await generate_compare_analysis(
            city_a=req.city_a,
            city_b=req.city_b,
            data_a=req.data_a,
            data_b=req.data_b,
        )
        return {"comparison": comparison}
    except Exception as exc:
        logger.error("[compare-analysis] error: %s", exc)
        return {"comparison": "Comparative analysis temporarily unavailable."}
