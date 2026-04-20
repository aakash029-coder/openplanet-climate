"""
climate_engine/services/llm_service.py — LLM Analysis Service

Uses Groq API (llama-3.1-8b-instant) for:
1. Per-city strategic analysis cards (generate_strategic_analysis)
2. Single-city research narrative (generate_strategic_analysis_raw)
3. Two-city comparison narrative (generate_compare_analysis)

ZERO-HALLUCINATION PROTOCOL:
  - Model is instructed to act as a deterministic engine, not a generative AI.
  - All output must be derived exclusively from the exact input values provided.
  - If a value is not in the input, the model must write "data not specified".
  - No geography, demographics, or infrastructure may be assumed or inferred.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from groq import AsyncGroq

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Client factory
# ─────────────────────────────────────────────────────────────────────────────

def _get_groq_client() -> AsyncGroq:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        try:
            from climate_engine.settings import settings
            api_key = settings.GROQ_API_KEY.get_secret_value()
        except Exception:
            pass
    if not api_key:
        raise ValueError("GROQ_API_KEY missing from environment variables.")
    return AsyncGroq(api_key=api_key)


# ─────────────────────────────────────────────────────────────────────────────
# Shared utilities
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_loss(usd: float) -> str:
    if usd >= 1_000_000_000:
        return f"${usd / 1_000_000_000:.2f}B"
    return f"${usd / 1_000_000:.1f}M"


def _fallback_error(cause: str, effect: str) -> dict:
    """
    Hard fallback returned when the LLM call fails entirely.
    Uses the same 4-key structure as a successful response so the
    frontend never has to handle a shape mismatch.
    """
    return {
        "mortality": (
            f"CAUSE: {cause} "
            f"EFFECT: {effect} "
            "SOLUTION: Check server logs and verify GROQ_API_KEY is set."
        ),
        "economic": "CAUSE: data not specified EFFECT: data not specified SOLUTION: data not specified",
        "infrastructure": "CAUSE: data not specified EFFECT: data not specified SOLUTION: data not specified",
        "mitigation": "CAUSE: data not specified EFFECT: data not specified SOLUTION: data not specified",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Zero-hallucination system prompt (shared base)
# ─────────────────────────────────────────────────────────────────────────────

_DETERMINISTIC_SYSTEM_CORE = """You are a deterministic climate risk analysis engine. \
You are NOT allowed to generate, assume, infer, or imagine any information beyond \
the exact input provided.

STRICT NON-NEGOTIABLE RULES:
1. USE ONLY the exact numerical values provided in the input. No rounding, no reformatting.
2. DO NOT:
   - add any new numbers not present in the input
   - estimate, approximate, or interpolate any value
   - mention any studies, research papers, or external sources
   - assume geography, elevation, coastal status, or urban design unless explicitly provided
   - assume infrastructure, economy, or demographics unless explicitly provided
   - use any country name — refer ONLY to the city name given
3. If any detail is not explicitly provided in the input, write exactly: "data not specified"
4. DO NOT exaggerate, use dramatic language, or use storytelling.
5. DO NOT contradict the provided data.
6. POINT ESTIMATES ONLY. Never write ranges (e.g. "3,000 – 4,000"). Use the exact figure given.
7. OUTPUT must be strict JSON only. No text, explanation, or markdown outside the JSON object.

TONE:
- Factual, minimal, and causal.
- Focus only on physics and direct impact relationships.
- No narrative. No adjectives beyond what the data requires."""



# ─────────────────────────────────────────────────────────────────────────────
# 1. Strategic analysis (4-card JSON) — FULLY DETERMINISTIC (NO AI WRITING)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_strategic_analysis(
    city: str,
    ssp: str,
    year: str,
    canopy: int,
    coolRoof: int,
    calc_temp: float,
    calc_heatwaves: int,
    calc_deaths: int,
    calc_loss_usd: float,
) -> dict:
    """
    Fully deterministic 4-card climate risk brief.
    NO LLM generation for core cards — eliminates all hallucination risk.
    """

    loss_str = _fmt_loss(calc_loss_usd)

    try:
        return {
            "mortality": (
                f"CAUSE: Elevated temperature ({calc_temp}°C) and {calc_heatwaves} heatwave days increase thermal stress. "
                f"EFFECT: {calc_deaths:,} attributable deaths. "
                f"SOLUTION: Heat mitigation and exposure reduction."
            ),

            "economic": (
                f"CAUSE: Temperature of {calc_temp}°C reduces labor productivity during {calc_heatwaves} heatwave days. "
                f"EFFECT: {loss_str} economic loss. "
                f"SOLUTION: Heat-resilient work systems and scheduling adjustments."
            ),

            "infrastructure": (
                f"CAUSE: Sustained temperature of {calc_temp}°C increases thermal load on urban systems. "
                f"EFFECT: elevated stress on cooling and energy infrastructure. "
                f"SOLUTION: load management and passive cooling infrastructure."
            ),

            "mitigation": (
                "CAUSE: Urban heat accumulation. "
                "EFFECT: increased surface temperature above ambient. "
                "SOLUTION: Vegetation cover triggers evapotranspiration cooling; "
                "reflective roofing reduces absorbed solar radiation. "
                "Every 10% canopy increase delivers approximately 1.2°C peak cooling; "
                "every 10% cool roof deployment delivers approximately 0.8°C."
            ),
        }

    except Exception as e:
        logger.error("[llm_service] deterministic generation failed: %s", e)
        return _fallback_error("Deterministic Generation Failed", str(e))

# ─────────────────────────────────────────────────────────────────────────────
# 2. Research narrative (single paragraph, plain text)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_strategic_analysis_raw(prompt: str) -> str:
    """
    Single-city research narrative — one tight paragraph.

    The caller is responsible for injecting all metric values into `prompt`.
    The model must use only those values and must not infer anything beyond them.
    """
    try:
        client = _get_groq_client()
    except ValueError as e:
        logger.error(str(e))
        return "Scientific reasoning unavailable — API key missing."

    system_msg = (
        _DETERMINISTIC_SYSTEM_CORE
        + "\n\nFOR THIS CALL SPECIFICALLY:\n"
        "- Output exactly ONE paragraph (3–4 sentences). No lists, no bullets, no newlines.\n"
        "- No markdown of any kind.\n"
        "- Connect temperature, heatwave days, mortality, and economic loss causally "
        "using only the values given.\n"
        "- If a metric is absent from the input, write 'data not specified' in its place.\n"
        "- Do not introduce any external context, city descriptions, or assumed geography."
    )

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=220,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error("[llm_service] generate_strategic_analysis_raw failed: %s", e)
        return "Scientific reasoning temporarily unavailable."


# ─────────────────────────────────────────────────────────────────────────────
# 3. Two-city comparison (single paragraph, plain text)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_compare_analysis(
    city_a: str,
    city_b: str,
    data_a: dict,
    data_b: dict,
) -> str:
    """
    Side-by-side comparison of two cities.

    Model must use only the metrics provided for each city and must
    state which city has higher risk using the exact provided numbers.
    It must not infer any reason from geography or demographics.
    """
    try:
        client = _get_groq_client()
    except ValueError as e:
        logger.error(str(e))
        return "Comparison unavailable — API key missing."

    def _fmt_city_block(name: str, d: dict) -> str:
        loss = d.get("economic_decay_usd", 0)
        deaths = d.get("attributable_deaths", 0)
        return (
            f"City: {name}\n"
            f"  Peak Tx5d Temperature: {d.get('peak_tx5d_c', 'data not specified')}°C\n"
            f"  Annual Heatwave Days: {d.get('heatwave_days', 'data not specified')}\n"
            f"  Attributable Deaths: {deaths:,}\n"
            f"  Economic Loss: {_fmt_loss(loss)}\n"
            f"  Max Wet-Bulb Temperature: {d.get('wbt_max_c', 'data not specified')}°C"
        )

    system_msg = (
        _DETERMINISTIC_SYSTEM_CORE
        + "\n\nFOR THIS CALL SPECIFICALLY:\n"
        "- Output exactly ONE paragraph (3–4 sentences). No lists, no bullets, no newlines.\n"
        "- No markdown of any kind.\n"
        "- State clearly which city has higher absolute climate risk.\n"
        "- Quantify the difference using the exact numbers provided (e.g. delta in deaths, "
        "delta in temperature, delta in economic loss).\n"
        "- Do NOT infer any geographic, demographic, or economic reason not present in the data.\n"
        "- If a metric is absent from a city's data block, write 'data not specified'."
    )

    user_msg = (
        "Compare the climate heat risk for these two cities using ONLY the data below.\n\n"
        f"{_fmt_city_block(city_a, data_a)}\n\n"
        f"{_fmt_city_block(city_b, data_b)}\n\n"
        "State which city has higher absolute risk, quantify the difference using the exact "
        "numbers above, and explain the causal relationship between temperature, heatwave days, "
        "deaths, and economic loss — using only the values provided."
    )

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.0,
            max_tokens=260,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error("[llm_service] generate_compare_analysis failed: %s", e)
        return "Comparative analysis temporarily unavailable."