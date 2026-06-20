"""
OpenPlanet Heat-Risk Agent — Agentverse HOSTED agent (single file, no external deps).

Why hosted: a hosted agent runs on Agentverse's own always-on infrastructure, so
it never depends on a separate process (the old mailbox agent went down whenever
the Hugging Face Space slept). Agentverse manages uptime automatically.

Constraints honoured: only `requests` + the Python standard library are used (the
hosted sandbox allows these). All climate science is inline — geocoding, the ERA5
2011–2020 baseline, the bias-corrected CMIP6 delta projection, the Stull (2011)
wet-bulb, and the risk label — using the free, keyless Open-Meteo APIs.

Paste this whole file into Agentverse → Create Agent → Hosted, then Start it and
publish the Chat Protocol. It answers ASI:One queries like "heat risk in Kolkata".

Data sources (all free, no key):
  ERA5 reanalysis : archive-api.open-meteo.com   (2011–2020 baseline decade)
  CMIP6 (downscaled): climate-api.open-meteo.com  (MRI-AGCM3-2-S + MPI-ESM1-2-XR
                      2-model ensemble, SSP2-4.5, bias-corrected delta to 2050)
  Geocoding        : geocoding-api.open-meteo.com (GeoNames)
"""
from datetime import datetime, timezone
from uuid import uuid4
import math
import re

import requests
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

agent = Agent()

# ── Tiny stats helpers (no numpy in the sandbox) ──────────────────────────────

def _percentile(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def _annual_tx5d(times, tmax):
    """WMO Tx5d normal: mean over years of the annual max 5-consecutive-day mean Tmax."""
    by_year = {}
    for t, v in zip(times, tmax):
        if t and v is not None:
            by_year.setdefault(t[:4], []).append(float(v))
    per_year = []
    for vals in by_year.values():
        if len(vals) >= 5:
            per_year.append(max(sum(vals[i:i + 5]) / 5.0 for i in range(len(vals) - 4)))
    return sum(per_year) / len(per_year) if per_year else (max(tmax) if tmax else 0.0)


def _stull(temp_c, rh_pct):
    """Stull (2011) wet-bulb temperature from co-occurring T (°C) and RH (%)."""
    rh = max(5.0, min(100.0, rh_pct))
    return (
        temp_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(temp_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )


# ── Open-Meteo data access (free, keyless) ────────────────────────────────────

_TIMEOUT = 25


def _get(url, params):
    r = requests.get(url, params=params, timeout=_TIMEOUT)
    r.raise_for_status()
    return r.json()


def geocode(city):
    data = _get("https://geocoding-api.open-meteo.com/v1/search",
                {"name": city.split(",")[0].strip(), "count": 5, "format": "json"})
    results = data.get("results") or []
    if not results:
        return None
    # If a country/region token is given, prefer a matching hit; else the most populous.
    parts = [p.strip().lower() for p in city.split(",")]
    if len(parts) > 1:
        for r in results:
            if parts[-1] in (str(r.get("country", "")).lower(), str(r.get("country_code", "")).lower()):
                return r
    return max(results, key=lambda r: r.get("population") or 0)


def era5_baseline(lat, lng):
    d = _get("https://archive-api.open-meteo.com/v1/archive", {
        "latitude": lat, "longitude": lng,
        "start_date": "2011-01-01", "end_date": "2020-12-31",
        "daily": "temperature_2m_max,temperature_2m_mean,relative_humidity_2m_mean,wet_bulb_temperature_2m_max",
        "timezone": "auto",
    }).get("daily", {})
    times = d.get("time", [])
    tmax = [v for v in d.get("temperature_2m_max", []) if v is not None]
    tmean = [v for v in d.get("temperature_2m_mean", []) if v is not None]
    rh = d.get("relative_humidity_2m_mean", [])
    wb = [v for v in d.get("wet_bulb_temperature_2m_max", []) if v is not None]
    if not tmax:
        raise ValueError("no ERA5 data")
    p95 = _percentile(tmax, 95)
    n_years = len({t[:4] for t in times if t}) or 10
    # Relative humidity on the hottest (>=P95) days — the coincident humidity for wet-bulb.
    hot_rh = [float(r) for tm, r in zip(d.get("temperature_2m_max", []), rh)
              if tm is not None and r is not None and tm >= p95]
    return {
        "annual_mean": round(sum(tmean) / len(tmean), 1) if tmean else 0.0,
        "tx5d": round(_annual_tx5d(times, d.get("temperature_2m_max", [])), 1),
        "p95": round(p95, 1),
        "hw_days": round(sum(1 for v in tmax if v > p95) / n_years),
        "wb_base": round(_percentile(wb, 95), 1) if wb else None,
        "rh_hot": round(sum(hot_rh) / len(hot_rh), 0) if hot_rh else _percentile(
            [float(r) for r in rh if r is not None], 95),
    }


_CMIP6_MODELS = ["MRI_AGCM3_2_S", "MPI_ESM1_2_XR"]


def cmip6_stats(lat, lng, y0, y1):
    """Per-model {tx5d, p95, tmax, n_years} for a CMIP6 window (2-model ensemble)."""
    # The Open-Meteo CMIP6 series spans 1950–2050; clamp so an edge window never
    # requests an out-of-range date (which returns HTTP 400).
    y0 = max(int(y0), 1950)
    y1 = min(int(y1), 2050)
    d = _get("https://climate-api.open-meteo.com/v1/climate", {
        "latitude": lat, "longitude": lng,
        "start_date": f"{y0}-01-01", "end_date": f"{y1}-12-31",
        "models": ",".join(_CMIP6_MODELS),
        "daily": "temperature_2m_max",
        "timezone": "auto",
    }).get("daily", {})
    times = d.get("time", [])
    out = {}
    for m in _CMIP6_MODELS:
        series = d.get(f"temperature_2m_max_{m}", [])
        clean = [v for v in series if v is not None]
        if not clean:
            continue
        out[m] = {
            "tx5d": _annual_tx5d(times, series),
            "p95": _percentile(clean, 95),
            "tmax": series,
            "n_years": len({t[:4] for t in times if t}) or 1,
        }
    return out


def _risk(wbt, hw_ratio):
    if wbt is not None and wbt >= 31:
        return "CRITICAL"
    if wbt is not None and wbt >= 28:
        return "DANGER"
    if hw_ratio >= 2.0:
        return "HIGH RISK"
    if hw_ratio >= 1.5:
        return "ESCALATING RISK"
    return "STABLE"


# ── City extraction ───────────────────────────────────────────────────────────

_GREETING = re.compile(r'^\s*(hi+|hello+|hey+|help|test|ping|who are you|what can you do)\b', re.I)


def extract_city(text):
    text = re.sub(r"@[\w.\-]+", "", text).strip()
    for pat in (
        r'\bfor\s+([A-Z][a-zA-Z\s\-]{2,30})',
        r'\b(?:in|at|about|of)\s+([A-Z][a-zA-Z\s\-]{2,30})',
        r'([A-Z][a-zA-Z]{2,20})\s+(?:heat|temperature|climate|weather|risk|2050|2030)',
    ):
        m = re.search(pat, text)
        if m:
            return m.group(1).strip(" ,.?!")
    words = text.split()
    if 1 <= len(words) <= 3 and text[:1].isupper() and not any(c.isdigit() for c in text):
        return text.strip(" ,.?!")
    return text.strip(" ,.?!")


# ── Main analysis ─────────────────────────────────────────────────────────────

def analyse(city_query):
    geo = geocode(city_query)
    if not geo:
        return (f"I couldn't locate \"{city_query}\". Try a clear city name, e.g. "
                f"\"heat risk in Mumbai\" or \"Delhi\".")
    lat, lng = geo["latitude"], geo["longitude"]
    name = geo.get("name", city_query)
    country = geo.get("country", "")
    label = f"{name}, {country}".strip(", ")

    base = era5_baseline(lat, lng)

    # Bias-corrected delta downscaling: anchor to the ERA5 baseline, add the
    # CMIP6-internal warming delta (future − CMIP6 2015 window). Same statistic on
    # both sides cancels the model's coarse-grid bias, so the 2050 peak can never
    # come out below the observed baseline.
    cb = cmip6_stats(lat, lng, 2011, 2016)
    stats = []
    prev_tx5d, prev_hw = base["tx5d"], base["hw_days"]
    for year in (2030, 2050):
        fut = cmip6_stats(lat, lng, year - 2, year + 2)
        if not fut or not cb:
            continue
        deltas, hws = [], []
        for m in fut:
            if m not in cb:
                continue
            deltas.append(fut[m]["tx5d"] - cb[m]["tx5d"])
            # Future days above THIS model's own baseline-window P95 (threshold
            # bias-corrected per model), per year — then ensemble-averaged.
            hws.append(sum(1 for v in fut[m]["tmax"] if v is not None and v > cb[m]["p95"]) / fut[m]["n_years"])
        if not deltas:
            continue
        delta = sum(deltas) / len(deltas)
        tx5d = max(round(base["tx5d"] + delta, 1), prev_tx5d)
        hw = max(round(sum(hws) / len(hws)), prev_hw)
        wbt = round(min(_stull(tx5d, base["rh_hot"]), tx5d, 35.0), 1)
        prev_tx5d, prev_hw = tx5d, hw
        stats.append({"year": year, "tx5d": tx5d, "hw": hw, "wbt": wbt,
                      "risk": _risk(wbt, hw / base["hw_days"] if base["hw_days"] else 1.0)})

    lines = [
        f"🌡️ Heat-risk outlook for {label}",
        "",
        f"Historical baseline [ERA5, 2011–2020]: annual mean {base['annual_mean']}°C, "
        f"5-day peak (Tx5d) {base['tx5d']}°C, ~{base['hw_days']} extreme-heat days/year"
        + (f", observed wet-bulb {base['wb_base']}°C." if base['wb_base'] is not None else "."),
    ]
    if not stats:
        lines.append("\nCMIP6 projection data is momentarily unavailable for this location — "
                     "please try again shortly.")
    for s in stats:
        lines.append(
            f"\n{s['year']} [CMIP6 SSP2-4.5, 2-model ensemble]: peak {s['tx5d']}°C, "
            f"~{s['hw']} extreme-heat days/year, wet-bulb {s['wbt']}°C [Stull 2011] → {s['risk']}."
        )
    lines.append("\nProjections are capped at 2050 (the validated CMIP6 horizon) — we do not "
                 "extrapolate to 2075/2100. Directional screening estimate; "
                 "see openplanetrisk.com for the full interactive analysis.")
    return "\n".join(lines)


# ── Chat protocol — ALWAYS reply ──────────────────────────────────────────────

chat_proto = Protocol(spec=chat_protocol_spec)


def _reply(text):
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=text), EndSessionContent(type="end-session")],
    )


@chat_proto.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(
        timestamp=datetime.now(timezone.utc), acknowledged_msg_id=msg.msg_id))

    text = ""
    for item in msg.content:
        if isinstance(item, TextContent) and (item.text or "").strip():
            text = item.text.strip()
            break
    if not text:
        return

    if _GREETING.match(text):
        out = ("Hi! I'm the OpenPlanet Heat-Risk agent. Give me any city and I'll return its "
               "ERA5 historical baseline and bias-corrected CMIP6 2030/2050 heat projection "
               "(peak temperature, extreme-heat days, wet-bulb, risk). "
               "Try: \"heat risk in Kolkata\".")
    else:
        try:
            out = analyse(extract_city(text))
        except Exception as exc:
            ctx.logger.warning(f"analyse failed: {exc}")
            out = ("That city's climate data is taking longer than usual or is momentarily "
                   "unavailable. Please send the city name again in a few seconds. "
                   "Full analysis: openplanetrisk.com")

    try:
        await ctx.send(sender, _reply(out))
    except Exception as exc:
        ctx.logger.error(f"failed to send reply: {exc}")


@chat_proto.on_message(ChatAcknowledgement)
async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(chat_proto, publish_manifest=True)


if __name__ == "__main__":
    agent.run()
