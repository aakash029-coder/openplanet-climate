"""
climate_engine/services — Orchestration layer.

Files
─────
    scenario_runner.py  — ScenarioRun lifecycle, streaming, batching
    engine_bridge.py    — science ↔ service boundary (pure transformation)

Architectural rule
──────────────────
    API layer   → calls scenario_runner only
    Services    → call engine_bridge only
    Engine      → pure science, no DB, no HTTP
"""

from climate_engine.services.scenario_runner import (
    RunAggregates,
    RunParameters,
    execute_scenario_run,
)

__all__ = [
    "execute_scenario_run",
    "RunParameters",
    "RunAggregates",
]