import os
import logging
import json
from groq import AsyncGroq

logger = logging.getLogger(__name__)


def _get_groq_client() -> AsyncGroq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY missing from environment variables.")
    return AsyncGroq(api_key=api_key)


def _fmt_loss(usd: float) -> str:
    if usd >= 1_000_000_000:
        return f"${usd / 1_000_000_000:.2f}B"
    return f"${usd / 1_000_000:.1f}M"


def _fmt_loss_range(usd: float) -> str:
    low  = usd * 0.92
    high = usd * 1.08
    return f"{_fmt_loss(low)} – {_fmt_loss(high)}"


def _fmt_deaths_range(deaths: int) -> str:
    return f"{int(deaths * 0.85):,} – {int(deaths * 1.15):,}"


def _fallback_error(cause: str, effect: str) -> dict:
    return {
        "mortality":      f"**CAUSE:** {cause} **EFFECT:** {effect} **SOLUTION:** Check logs.",
        "economic":       "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
        "infrastructure": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
        "mitigation":     "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
    }


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
    Baseline-only AI analysis — 1 Groq call on Generate button.
    Mitigation numbers come from frontend math, not AI.
    This prevents hallucination and eliminates slider-triggered API calls.
    """
    try:
        client = _get_groq_client()
    except ValueError as e:
        logger.error(str(e))
        return _fallback_error("API Key Missing", "Check Hugging Face Secrets.")

    loss_str = _fmt_loss(calc_loss_usd)

    system_prompt = """You are the OpenPlanet Expert Climate Risk AI writing for institutional investors and policymakers.

ABSOLUTE RULES:
1. ZERO HALLUCINATION: Use ONLY the exact numbers from the user message. Never invent figures.
2. POINT ESTIMATES ONLY: Use exact numbers given. Never write ranges like "3,424 – 4,634".
3. CITY-SPECIFIC: Every sentence must reference this specific city's geography, climate, economy.
   Wrong: "Heat causes deaths in urban areas."
   Right: "Los Angeles's basin geography traps hot air, extending heatwave duration beyond regional averages."
4. BASELINE ONLY for mortality/economic/infrastructure cards: Explain WHY baseline risk exists.
   Do NOT mention sliders, canopy%, or coolRoof% in these 3 cards.
5. MITIGATION card: Explain the SCIENCE of how canopy + cool roofs work in general.
   Do NOT state specific slider percentages or claim specific savings — those are shown separately.
   The mitigation card explains WHY these interventions work, not HOW MUCH was applied.
6. OUTPUT: Strict JSON, 4 keys, no text outside JSON."""

    user_prompt = f"""Write a baseline climate risk brief for {city} under {ssp} scenario for {year}.

EXACT ENGINE NUMBERS — use verbatim, no modification:
- City: {city}
- Scenario: {ssp} | Year: {year}
- Peak Tx5d Temperature: {calc_temp}°C
- Annual Heatwave Days: {calc_heatwaves} days
- Attributable Deaths (baseline, no mitigation): {calc_deaths:,}
- Economic Loss (baseline, no mitigation): {loss_str}

CARD INSTRUCTIONS:

mortality card — explain WHY {city} specifically has high heat mortality:
  CAUSE: {city}'s specific geography/density/UHI that amplifies heat exposure
  EFFECT: {calc_deaths:,} baseline deaths projected at {calc_temp}°C peak over {calc_heatwaves} heatwave days
  SOLUTION: 1 specific intervention appropriate for {city}'s urban form

economic card — explain the labor/productivity mechanism for {city}:
  CAUSE: Which sectors in {city} are most exposed at {calc_temp}°C (construction, logistics, agriculture, tourism)
  EFFECT: {loss_str} baseline economic loss from {calc_heatwaves} days of heat stress
  SOLUTION: 1 specific policy for {city}'s dominant economic sectors

infrastructure card — explain {city}'s most vulnerable infrastructure:
  CAUSE: Which infrastructure in {city} is most stressed at {calc_temp}°C for {calc_heatwaves} days
  EFFECT: Specific failure mode (grid blackouts, road buckling, transit shutdown)
  SOLUTION: Engineering fix specific to that infrastructure type

mitigation card — explain the SCIENCE of urban cooling interventions (city-agnostic mechanism):
  CAUSE: Urban heat island physics — impervious surfaces, lack of vegetation, albedo effects
  EFFECT: How canopy cover reduces temperature via evapotranspiration and shading; how cool roofs reduce solar absorption
  SOLUTION: Scaling principle — every 10% canopy increase ≈ 1.2°C cooling; every 10% cool roof coverage ≈ 0.8°C cooling — these reductions compound across mortality and economic metrics

REQUIRED JSON:
{{
  "mortality": "**CAUSE:** [city-specific geography + {calc_heatwaves} heatwave days mechanism]. **EFFECT:** {calc_deaths:,} baseline deaths at {calc_temp}°C — without any intervention. **SOLUTION:** [specific action for {city}].",
  "economic": "**CAUSE:** [specific labor sectors in {city} exposed at {calc_temp}°C]. **EFFECT:** {loss_str} baseline economic loss across {calc_heatwaves} heat-stress days. **SOLUTION:** [specific policy for {city}].",
  "infrastructure": "**CAUSE:** [specific infrastructure vulnerability in {city} at {calc_temp}°C]. **EFFECT:** [specific failure mode]. **SOLUTION:** [engineering fix].",
  "mitigation": "**CAUSE:** [UHI physics — impervious surfaces, albedo, lack of vegetation]. **EFFECT:** Canopy cover triggers evapotranspiration cooling while cool roofs reflect solar radiation — both directly reduce peak temperatures, shortening heatwave duration and cutting heat-attributable deaths and economic losses proportionally. **SOLUTION:** Every 10% canopy increase delivers ~1.2°C peak cooling; every 10% cool roof deployment delivers ~0.8°C — use the sliders above to model the compounding impact on this city's baseline numbers."
}}"""

    try:
        completion = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.05,
            max_tokens=700,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content.strip()
        if raw.startswith("```json"): raw = raw[7:-3].strip()
        elif raw.startswith("```"):   raw = raw[3:-3].strip()

        parsed = json.loads(raw)

        required = {"mortality", "economic", "infrastructure", "mitigation"}
        if not required.issubset(parsed.keys()):
            logger.warning(f"AI missing keys: {required - parsed.keys()}")
            return _fallback_error("Incomplete Response", "Missing keys.")

        return parsed

    except json.JSONDecodeError as e:
        logger.error(f"AI JSON parse failed: {e}")
        return _fallback_error("JSON Parse Error", str(e))
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return _fallback_error("AI Generation Failed", str(e))


async def generate_strategic_analysis_raw(prompt: str) -> str:
    """
    Deep Dive single-city research — one authoritative paragraph.
    """
    try:
        client = _get_groq_client()
    except ValueError as e:
        logger.error(str(e))
        return "Scientific reasoning unavailable — API key missing."

    system_msg = (
        "You are a Senior Climate Risk Scientist writing for an IPCC-level report. "
        "RULES: "
        "1. Write exactly ONE paragraph (3-4 sentences). No lists, no bullets, no newlines. "
        "2. No markdown. "
        "3. Use ONLY the exact numbers provided. Never substitute with ranges or approximations. "
        "4. Explain causal mechanisms — WHY this city, WHY this geography. "
        "5. Weave thermal physiology, UHI dynamics, and economic productivity into one narrative."
    )

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.1,
            max_tokens=220,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"Groq raw analysis failed: {e}")
        return "Scientific reasoning temporarily unavailable."


async def generate_compare_analysis(
    city_a: str,
    city_b: str,
    data_a: dict,
    data_b: dict,
) -> str:
    """
    Single Groq call with BOTH cities — no contradiction possible.
    Uses point estimates only — matches metrics panel exactly.
    """
    try:
        client = _get_groq_client()
    except ValueError as e:
        logger.error(str(e))
        return "Comparison unavailable — API key missing."

    def _fmt(d: dict) -> str:
        loss   = d.get("economic_decay_usd", 0)
        deaths = d.get("attributable_deaths", 0)
        return (
            f"Peak Tx5d: {d.get('peak_tx5d_c', 'N/A')}°C | "
            f"Heatwave Days: {d.get('heatwave_days', 'N/A')} | "
            f"Deaths: {deaths:,} | "
            f"Economic Loss: {_fmt_loss(loss)} | "
            f"WBT: {d.get('wbt_max_c', 'N/A')}°C | "
            f"Region: {d.get('region', 'N/A')}"
        )

    system_msg = (
        "You are a Senior Climate Risk Scientist comparing two cities for institutional investors. "
        "RULES: "
        "1. Write ONE paragraph (3-4 sentences). No lists, no bullets, no newlines. "
        "2. Use ONLY the exact numbers provided — zero hallucination. "
        "3. NEVER substitute point estimates with ranges. Use the exact figures given. "
        "4. State CLEARLY which city faces higher risk and WHY (geography + numbers). "
        "5. Quantify the difference using exact numbers."
    )

    user_msg = f"""Compare climate heat risk for these two cities.
Use the exact numbers below — no substitution with ranges or approximations.

{city_a}:
{_fmt(data_a)}

{city_b}:
{_fmt(data_b)}

State which city faces higher absolute climate risk, explain geographic/thermal reasons,
and quantify the difference using the exact numbers above."""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_msg},
            ],
            temperature=0.05,
            max_tokens=250,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"Compare analysis failed: {e}")
        return "Comparative analysis temporarily unavailable."