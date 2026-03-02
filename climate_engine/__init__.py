"""
climate_engine — Global-tier climate mortality engine.

Package hierarchy
─────────────────
    climate_engine/
    ├── config.py           — scientific parameters (frozen, DB-agnostic)
    ├── settings.py         — infrastructure (DB URL, credentials, pool)
    ├── version_control.py  — run provenance and reproducibility
    ├── lapse_layer.py      — elevation temperature correction
    ├── epidemiology.py     — heat-attributable mortality computation
    ├── db/                 — ORM models, session, base
    ├── api/                — FastAPI routes, schemas, main app
    ├── audit/              — input hashing and governance
    └── services/           — orchestration (scenario_runner, engine_bridge)

Import convention
─────────────────
    Always import from the submodule directly:
        from climate_engine.config import ConfigManager
        from climate_engine.db import H3Cell, get_async_session
    Never import from this file — it exposes nothing intentionally.
"""