"""
climate_engine/api/routers/asi.py — ASI Agentverse Chat Protocol endpoint.

Mounts:
  POST /submit
"""
from __future__ import annotations

import asyncio
import base64
import datetime
import json
import logging
import re
import uuid
from typing import Optional

import httpx
from fastapi import Request
from fastapi.routing import APIRouter
from pydantic import BaseModel

from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
)
from climate_engine.services.socioeconomic_service import geocode_city
from climate_engine.api.physics import (
    detect_climate_archetype,
    _fetch_era5_humidity_p95,
    _stull_wetbulb,
)
from climate_engine.api._helpers import _coords_vault_key, _CITY_COORDS

logger = logging.getLogger(__name__)

router = APIRouter()

_AGENT_ADDRESS = "agent1qdc29zvkgxqsesp0xp76n8qyxjg4pyvd5f4tlqca9t48jrtwe5ntsj69k6y"


class ASIChatPayload(BaseModel):
    version: int = 1
    sender: str = ""
    target: str = ""
    session: str = ""
    schema_digest: str = ""
    protocol_digest: str = ""
    payload: str = ""
    expires: int = 0
    nonce: int = 0
    signature: str = ""


async def _get_asi_climate_summary(city_name: str) -> str:
    """Fetch real ERA5 + CMIP6 data for a city and format as agent-readable text."""
    vault_key = _coords_vault_key(city_name)
    if vault_key:
        cv = _CITY_COORDS[vault_key]
        lat, lng = cv["lat"], cv["lng"]
        logger.info("[asi] vault hit '%s' -> (%.4f, %.4f)", city_name, lat, lng)
    else:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as geo_client:
            geo = await geocode_city(city_name, geo_client)
        lat, lng = geo.latitude, geo.longitude
        logger.info("[asi] geocoded '%s' -> (%.4f, %.4f)", city_name, lat, lng)

    baseline, rh_p95 = await asyncio.gather(
        fetch_historical_baseline_full(lat, lng),
        _fetch_era5_humidity_p95(lat, lng),
    )

    proj_2030, proj_2050 = await asyncio.gather(
        fetch_cmip6_projection(lat, lng, "ssp245", 2030, baseline, 0.0),
        fetch_cmip6_projection(lat, lng, "ssp245", 2050, baseline, 0.0),
        return_exceptions=True,
    )

    lines = [f"OpenPlanet Heat Risk Report — {city_name}"]

    for year, proj in [(2030, proj_2030), (2050, proj_2050)]:
        if isinstance(proj, Exception):
            logger.warning("[asi] CMIP6 year=%d failed for '%s': %s", year, city_name, proj)
            continue
        tx5d = proj["tx5d_c"]
        hw_days = int(proj["hw_days"])
        mean_temp = proj["mean_temp_c"]
        try:
            wb_prof = await fetch_wetbulb_profile(lat, lng, "ssp245", year)
            wbt = wb_prof["projected_wb_c"]
        except Exception:
            wbt = None
        zone_obj = detect_climate_archetype(mean_temp=mean_temp, p95_rh=rh_p95, tx5d=tx5d, true_wbt=wbt)
        if wbt is None:
            wbt = _stull_wetbulb(temp_c=tx5d, rh_pct=rh_p95, zone=zone_obj.zone).wbt_celsius
        risk_level = "CRITICAL" if wbt >= 31 else ("DANGER" if wbt >= 28 else "STABLE")
        lines.append(
            f"{year} (SSP2-4.5): Peak Tx5d {tx5d:.1f}°C | {hw_days} heatwave days | "
            f"Wet-bulb {wbt:.1f}°C | Risk: {risk_level}"
        )

    if len(lines) == 1:
        raise ValueError(f"No CMIP6 projection data available for '{city_name}'")

    lines.append("Full interactive analysis: openplanetrisk.com")
    return "\n".join(lines)


@router.post("/submit", tags=["ASI Agent"])
async def agentverse_submit(request: Request):
    # Always return 200 — never let Agentverse see a 4xx/5xx
    try:
        body = await request.json()
        sender = body.get("sender", "")
        session = body.get("session", str(uuid.uuid4()))
        schema_digest = body.get("schema_digest", "")
        protocol_digest = body.get("protocol_digest", "")
        payload_b64 = body.get("payload", "")

        logger.info("[asi/submit] sender=%r  session=%r", sender, session)

        # Decode the payload envelope
        payload_data: dict = {}
        if payload_b64:
            try:
                padded = payload_b64 + "=" * ((4 - len(payload_b64) % 4) % 4)
                payload_data = json.loads(base64.b64decode(padded).decode("utf-8"))
                logger.info("[asi/submit] decoded_payload=%r", payload_data)
            except Exception as exc:
                logger.warning("[asi/submit] payload decode failed: %s", exc)

        # ── ChatAcknowledgement — return ack and stop ─────────────────────────
        if "acknowledged_msg_id" in payload_data:
            logger.info("[asi/submit] ChatAcknowledgement received, ack-ing back")
            ack = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "acknowledged_msg_id": payload_data.get("acknowledged_msg_id", ""),
                "metadata": {},
            }
            return {
                "version": 1,
                "sender": _AGENT_ADDRESS,
                "target": sender,
                "session": session,
                "schema_digest": schema_digest,
                "protocol_digest": protocol_digest,
                "payload": base64.b64encode(json.dumps(ack).encode("utf-8")).decode("ascii"),
                "expires": 0,
                "nonce": 0,
                "signature": "",
            }

        # ── ChatMessage — extract city and return climate data ────────────────
        raw_text = ""

        content = payload_data.get("content", [])
        if content and isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    raw_text = item.get("text", "").strip()
                    break
                elif isinstance(item, dict) and "text" in item:
                    raw_text = item.get("text", "").strip()
                    break

        if not raw_text:
            raw_text = str(payload_data.get("text", "")).strip()

        if not raw_text:
            msg = payload_data.get("message", {})
            if isinstance(msg, dict):
                raw_text = str(msg.get("text", msg.get("content", ""))).strip()
            elif isinstance(msg, str):
                raw_text = msg.strip()

        if not raw_text:
            bc = payload_data.get("content", "")
            if isinstance(bc, str):
                raw_text = bc.strip()

        if not raw_text:
            for key in ["text", "message", "query", "input", "city", "prompt"]:
                val = body.get(key, "")
                if val and isinstance(val, str):
                    raw_text = val.strip()
                    break
                elif val and isinstance(val, dict):
                    raw_text = str(val.get("text", val.get("content", ""))).strip()
                    if raw_text:
                        break

        logger.info("[asi/submit] raw_text=%r", raw_text)

        city_name = ""
        if raw_text:
            match = re.search(
                r'\bfor\s+([A-Z][a-zA-Z\s\-]+?)(?:\s+including|\s*[,\.?]|$)',
                raw_text,
            )
            city_name = match.group(1).strip() if match else raw_text.strip()

        logger.info("[asi/submit] city_name=%r", city_name)

        if city_name:
            try:
                response_text = await _get_asi_climate_summary(city_name)
            except Exception as exc:
                logger.warning("[asi/submit] climate summary failed for '%s': %s", city_name, exc)
                response_text = (
                    f"Climate data for '{city_name}' is currently unavailable. "
                    "Visit openplanetrisk.com for full heat risk intelligence."
                )
        else:
            response_text = (
                "Please provide a city name in your message. "
                "Example: 'What is the heat risk for Mumbai?' "
                "Visit openplanetrisk.com for full heat risk intelligence."
            )

        response_message = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "msg_id": str(uuid.uuid4()),
            "content": [{"type": "text", "text": response_text}],
        }
        encoded_payload = base64.b64encode(
            json.dumps(response_message).encode("utf-8")
        ).decode("ascii")

        return {
            "version": 1,
            "sender": _AGENT_ADDRESS,
            "target": sender,
            "session": session,
            "schema_digest": schema_digest,
            "protocol_digest": protocol_digest,
            "payload": encoded_payload,
            "expires": 0,
            "nonce": 0,
            "signature": "",
        }

    except Exception as exc:
        logger.error("[asi/submit] unhandled error: %s", exc)
        fallback_msg = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "msg_id": str(uuid.uuid4()),
            "content": [{"type": "text", "text": (
                "Heat risk data temporarily unavailable. "
                "Visit openplanetrisk.com for full analysis."
            )}],
        }
        fallback = base64.b64encode(
            json.dumps(fallback_msg).encode("utf-8")
        ).decode("ascii")
        return {
            "version": 1,
            "sender": _AGENT_ADDRESS,
            "target": "",
            "session": str(uuid.uuid4()),
            "schema_digest": "",
            "protocol_digest": "",
            "payload": fallback,
            "expires": 0,
            "nonce": 0,
            "signature": "",
        }
