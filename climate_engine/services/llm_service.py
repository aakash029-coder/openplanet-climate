"""
climate_engine/services/llm_service.py
Handles dynamic AI synthesis using Groq's ultra-fast Llama-3 inference.
"""
import os
import json
import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)

# Initialize Groq (it will automatically look for GROQ_API_KEY in your .env or Hugging Face secrets)
api_key = os.environ.get("GROQ_API_KEY")
client = AsyncGroq(api_key=api_key) if api_key else None

async def generate_strategic_analysis(city: str, ssp: str, year: str, canopy: int, cool_roof: int) -> dict:
    """Queries Groq to generate a localized climate risk assessment."""
    
    if not client:
        logger.error("GROQ_API_KEY is missing. Returning N/A fallback.")
        return _get_fallback()

    prompt = f"""
    You are an expert institutional climate risk analyst. 
    Generate a highly concise, data-driven climate risk assessment for the city of {city} in the year {year} under the {ssp} emission scenario.
    The user is proposing a mitigation strategy of +{canopy}% canopy cover and +{cool_roof}% high-albedo cool roofs.

    You MUST output your response strictly as a JSON object with four exact keys: 'mortality', 'economic', 'infrastructure', and 'mitigation'.
    For each key, the value MUST be a single string formatted EXACTLY like this:
    **CAUSE:** [1 highly technical sentence] **EFFECT:** [1 highly technical sentence] **SOLUTION:** [1 highly technical sentence]

    Make the insights geographically and economically accurate for {city}. Use strict scientific and economic terminology.
    Output ONLY the valid JSON object. Do not include markdown code block formatting (like ```json).
    """

    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must output raw, valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="llama3-8b-8192", # Groq's fast Llama 3 model
            temperature=0.2, # Low temperature for highly factual/rigid responses
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON string returned by Groq into a Python dictionary
        result_content = response.choices[0].message.content
        return json.loads(result_content)

    except Exception as e:
        logger.error(f"Groq API generation failed: {e}")
        return _get_fallback()

def _get_fallback() -> dict:
    msg = "**CAUSE:** API Disconnected. **EFFECT:** N/A **SOLUTION:** Add GROQ_API_KEY to Hugging Face secrets."
    return {
        "mortality": msg, "economic": msg, "infrastructure": msg, "mitigation": msg
    }