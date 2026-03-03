import os
import json
import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)

api_key = os.environ.get("GROQ_API_KEY")
client = AsyncGroq(api_key=api_key) if api_key else None

async def generate_strategic_analysis(city: str, ssp: str, year: str, canopy: int, cool_roof: int) -> dict:
    if not client:
        msg = "**CAUSE:** GROQ_API_KEY missing. **EFFECT:** N/A **SOLUTION:** Add key to environment."
        return {"mortality": msg, "economic": msg, "infrastructure": msg, "mitigation": msg}

    prompt = f"""
    You are an expert institutional climate risk analyst. 
    Generate a concise, data-driven climate risk assessment for the city of {city} in the year {year} under the {ssp} scenario.
    Mitigation strategy: +{canopy}% canopy cover, +{cool_roof}% high-albedo cool roofs.

    Output STRICTLY as a JSON object with four keys: 'mortality', 'economic', 'infrastructure', and 'mitigation'.
    For each key, the value MUST be a single string formatted EXACTLY like this:
    **CAUSE:** [1 technical sentence] **EFFECT:** [1 technical sentence] **SOLUTION:** [1 technical sentence]
    
    Output ONLY valid JSON. No markdown blocks.
    """
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-8b-8192",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Groq error: {e}")
        # This will print the EXACT error from the server directly to your UI
        error_msg = str(e).replace('"', "'")
        msg = f"**CAUSE:** Pipeline Exception. **EFFECT:** {error_msg} **SOLUTION:** Check Hugging Face Logs."
        return {
            "mortality": msg, 
            "economic": msg, 
            "infrastructure": msg, 
            "mitigation": msg
        }