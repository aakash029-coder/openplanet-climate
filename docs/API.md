# OpenPlanet Climate Engine — API Reference

Base URL (local): `http://localhost:7860`
Interactive docs: `GET /docs` (Swagger UI) · `GET /redoc` (ReDoc) · `GET /openapi.json` (raw schema)

> **All outputs are directional macro-scale proxies** from public datasets and
> peer-reviewed methods — not certified forecasts, actuarial certifications, or
> financial instruments. See the [Legal Disclaimer](../README.md#regulatory-compliance-limitation-of-liability--legal-disclaimer).

## Conventions

- **Content-Type:** `application/json` for all `POST` bodies.
- **Request tracing:** every response carries an `X-Request-ID` header (also echoed in error bodies).
- **Rate limiting:** responses include `X-RateLimit-Limit` / `X-RateLimit-Remaining`; exceeding the limit returns `429`.
- **Data lineage:** every climate payload includes `metadata.data_lineage`:
  - `empirical_api` — built from live ERA5 / CMIP6 / World Bank data.
  - `statistical_fallback` — an upstream API failed; a latitude-model estimate was substituted. **Treat as order-of-magnitude only.**

---

## `POST /api/climate-risk`

Canonical projection set for a coordinate — the single source of truth for every UI tab.

**Request**

```json
{
  "lat": 28.6139,
  "lng": 77.2090,
  "ssp": "SSP2-4.5",
  "canopy_offset_pct": 0,
  "albedo_offset_pct": 0,
  "location_hint": "Delhi, India"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `lat`, `lng` | float | WGS84 decimal degrees (required). |
| `ssp` | string | `SSP2-4.5` (default) or `SSP5-8.5`. |
| `canopy_offset_pct` | int | Mitigation: urban canopy expansion 0–100 (display-only cooling). |
| `albedo_offset_pct` | int | Mitigation: cool-roof albedo 0–100 (display-only cooling). |
| `location_hint` | string | `"City, Country"` — improves geocoding/socioeconomic lookup. |

**Response (abridged)**

```json
{
  "threshold_c": 41.2,
  "tx5d_baseline_c": 43.0,
  "gdp_usd": 293000000000,
  "population": 32000000,
  "era5_humidity_p95": 54.0,
  "baseline": { "baseline_mean_c": 25.1 },
  "projections": [
    {
      "year": 2050,
      "source": "cmip6_ensemble",
      "heatwave_days": 68,
      "peak_tx5d_c": 49.2,
      "mean_temp_c": 27.4,
      "attributable_deaths": 5075,
      "economic_decay_usd": 4200000000,
      "wbt_max_c": 32.4,
      "survivability_status": "DANGER",
      "n_models": 2,
      "audit_trail": { "mortality": { "...": "..." } }
    }
  ],
  "metadata": { "data_lineage": "empirical_api" }
}
```

Mortality / economic / wet-bulb fields each carry an `audit_trail` with the
formula, the substituted variables, and the peer-reviewed source.

---

## `POST /api/predict`

Dashboard simulation for a single year — returns the H3 hex grid, charts, AI
narrative, and historical eras in addition to the projection.

**Request**

```json
{
  "city": "Delhi, India",
  "lat": 28.6139,
  "lng": 77.2090,
  "ssp": "SSP2-4.5",
  "year": "2050",
  "canopy": 0,
  "coolRoof": 0
}
```

**Response (keys):** `resolvedLocation`, `hexGrid[]` (`{hex_id, position, risk_weight}`),
`auditTrail`, `aiAnalysis`, `historicalEras`, `charts.{heatwave, economic}`.

---

## `POST /api/research-analysis`

LLM-generated narrative risk analysis (Groq) for the active city. Requires
`GROQ_API_KEY` to be configured server-side; degrades gracefully when unset.

---

## `GET /health`

Liveness probe. `200 {"status": "ok"}` when the engine is serving.

---

## Error shape

```json
{
  "error": "HTTP_429",
  "detail": "Rate limit exceeded",
  "request_id": "f1c2…"
}
```

## Shareable deep links (frontend)

The dashboard encodes the active view in the URL so projections are shareable:

```
/dashboard?city=Delhi%2C%20India&lat=28.6139&lng=77.2090&year=2050&ssp=SSP5-8.5
```

Opening such a link auto-runs the projection and reproduces the exact scenario.
