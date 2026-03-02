"""
climate_engine/config.py — Scientific Configuration

Responsibilities
────────────────
This file contains ONLY scientific and physical parameters.

It deliberately does NOT contain:
  - Database paths, URLs, or table names  → that is settings.py + session.py
  - API keys or credentials               → that is settings.py
  - Infrastructure configuration          → that is settings.py

The science layer is DB-agnostic. ConfigManager knows nothing about
where data is stored or how it is retrieved. It knows only physics,
epidemiology, and urban morphology.

Architecture rule
─────────────────
    settings.py   → infrastructure (DB URL, credentials, pool sizes)
    config.py     → science (beta, gamma, MMT, UHI physics)

These two worlds never mix.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import FrozenSet, Literal


# ---------------------------------------------------------------------------
# Sub-configs — all frozen, all pure science
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PhysicsConstants:
    GAMMA: float = 0.35
    """⚠ DEPRECATED — legacy engine only. New engine uses CouplingConfig.GAMMA_BASE."""
    WB_COEFF: float = 0.65
    CLIP_MAX: float = 3.0


@dataclass(frozen=True)
class ThermalNode:
    name:   str
    lat:    float
    lon:    float
    weight: float


@dataclass(frozen=True)
class MorphologyConfig:
    PROXY_MODE:       Literal["polycentric", "monocentric", "landsat"] = "polycentric"
    UHI_SCALE_FACTOR: float = 8.0
    NODES: tuple[ThermalNode, ...] = field(default_factory=lambda: (
        ThermalNode("Central Kolkata", 22.580, 88.350, 1.00),
    ))


@dataclass(frozen=True)
class ResolutionConfig:
    H3_RESOLUTION: int   = 9
    MAX_DIST_DEG:  float = 0.4


@dataclass(frozen=True)
class ValidationThresholds:
    MAX_TEMP_PHYSICAL:    float = 60.0
    MIN_TEMP_PHYSICAL:    float = -10.0
    MAX_HOURLY_DRIFT:     float = 0.001
    MAX_ANOMALY_ABS:      float = 3.0
    MAX_SPREAD_CEILING:   float = 5.0
    MIN_REALISTIC_SPREAD: float = 2.0
    SKEW_WARN:            float = 0.4
    SKEW_HIGH:            float = 0.8


@dataclass(frozen=True)
class UncertaintyConfig:
    GAMMA_LOW:    float = 0.30
    GAMMA_HIGH:   float = 0.50
    WB_COEFF_LOW: float = 0.55
    WB_COEFF_HIGH:float = 0.75
    SCALE_FRAC:   float = 0.20


# ── BLOCK 1 — LST ↔ Air Coupling (Adaptive Gamma) ────────────────────────────

@dataclass(frozen=True)
class CouplingConfig:
    GAMMA_BASE:        float = 0.88   # authoritative gamma for new engine
    GAMMA_MIN:         float = 0.60
    GAMMA_MAX:         float = 0.90
    ELEVATION_BREAK_1: float = 2000.0
    ELEVATION_BREAK_2: float = 4000.0


# ── BLOCK 2 — Lapse Rate / BLH Coupling ──────────────────────────────────────

@dataclass(frozen=True)
class BoundaryLayerConfig:
    BLH_REF_MIN:       float = 100.0
    BLH_REF_MAX:       float = 300.0
    BLH_MULTIPLIER_CAP:float = 2.5


# ── BLOCK 3 — UHI Dynamic Model ──────────────────────────────────────────────

@dataclass(frozen=True)
class UrbanPhysicsConfig:
    IMP_REF:   float = 0.10
    POP_REF:   int   = 1000
    ALPHA_IMP: float = 1.0
    BETA_POP:  float = 1.0
    WIND_K: dict[str, float] = field(default_factory=lambda: {
        "Dfa": 0.54,
        "Cfa": 0.75,
        "Cfb": 0.60,
        "Csa": 0.50,
        "BWh": 0.66,
        "Af":  0.15,
    })
    ANTHRO_COEFF:          float = 1e-7
    """To be calibrated against observed AC waste-heat flux."""
    ANTHRO_TEMP_CAP:       float = 1.5
    """°C — hard ceiling on ΔT_anthro; prevents runaway feedback."""
    MOISTURE_DEFICIT_COEFF:float = 0.15
    MIN_REL_HUMIDITY:      float = 0.10
    """Physical lower bound; below this wet-bulb calculation breaks."""
    MAX_REL_HUMIDITY:      float = 0.99
    """Physical upper bound; avoids supersaturation artefacts."""


# ── BLOCK 4 — Epidemiology (WHO-grade) ───────────────────────────────────────

@dataclass(frozen=True)
class EpidemiologyConfig:
    BETA_HEAT_GLOBAL:         float = 0.04
    BETA_HEAT_TROPICAL:       float = 0.09
    ACCLIMATION_FACTOR:       float = 0.85
    WETBULB_THRESHOLD:        float = 30.5
    WETBULB_KAPPA_STEEPNESS:  float = 0.75
    MONTE_CARLO_DRAWS:        int   = 1000
    AC_ADAPTATION_SCALAR_MAX: float = 0.40
    """Max fractional mortality reduction from AC uptake. Reserved — not yet active."""
    MMT_SHIFT_PER_DECADE:     float = 0.20
    """°C shift in minimum-mortality temperature per decade. Reserved — not yet active."""


# ── BLOCK 5 — Uncertainty Priors ─────────────────────────────────────────────

@dataclass(frozen=True)
class UncertaintyPriors:
    GAMMA_RANGE:  tuple[float, float] = (0.60, 0.90)
    WIND_K_STD:   float = 0.05
    BETA_HEAT_STD:float = 0.01


# ── BLOCK 6 — Urban Detection (DEGURBA thresholds) ───────────────────────────

@dataclass(frozen=True)
class UrbanDetectionConfig:
    CITY_DENSITY:              int   = 1500
    CITY_POP_MIN:              int   = 50000
    CLUSTER_DENSITY:           int   = 300
    CLUSTER_POP_MIN:           int   = 5000
    FALSE_POSITIVE_IMP:        float = 0.50
    FALSE_POSITIVE_POP_DENSITY:float = 50.0


# ---------------------------------------------------------------------------
# ConfigManager — single frozen root config object
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ConfigManager:
    """
    Root scientific configuration object.

    All sub-configs are frozen dataclasses. ConfigManager itself is frozen.
    No mutation is possible after construction — guaranteed by the dataclass
    machinery. Any "change" produces a new instance via dataclasses.replace().

    Construction
    ────────────
        cfg = ConfigManager.build()                          # all defaults
        cfg = ConfigManager.build(resolution=ResolutionConfig(H3_RESOLUTION=8))

    Hashing
    ───────
        ConfigManager has no checksum() method.
        Hashing is the responsibility of VersionControl.hash_config(cfg),
        which calls cfg.to_dict() and SHA-256s the result.
        This enforces a single hash implementation across the codebase.
    """

    physics:           PhysicsConstants   = field(default_factory=PhysicsConstants)
    morphology:        MorphologyConfig   = field(default_factory=MorphologyConfig)
    resolution:        ResolutionConfig   = field(default_factory=ResolutionConfig)
    validation:        ValidationThresholds = field(default_factory=ValidationThresholds)
    uncertainty:       UncertaintyConfig  = field(default_factory=UncertaintyConfig)
    coupling:          CouplingConfig     = field(default_factory=CouplingConfig)
    boundary_layer:    BoundaryLayerConfig= field(default_factory=BoundaryLayerConfig)
    urban_physics:     UrbanPhysicsConfig = field(default_factory=UrbanPhysicsConfig)
    epidemiology:      EpidemiologyConfig = field(default_factory=EpidemiologyConfig)
    uncertainty_priors:UncertaintyPriors  = field(default_factory=UncertaintyPriors)
    urban_detection:   UrbanDetectionConfig = field(default_factory=UrbanDetectionConfig)

    # ── Derived properties ────────────────────────────────────────────────────

    @property
    def h3_col_name(self) -> str:
        """Canonical H3 column name derived from resolution (e.g. 'h3_09')."""
        return f"h3_{self.resolution.H3_RESOLUTION:02d}"

    @property
    def required_columns(self) -> FrozenSet[str]:
        """Minimum DataFrame columns required by the science pipeline."""
        return frozenset({
            "latitude", "longitude", self.h3_col_name,
            "temp_c", "t_wb", "valid_time",
        })

    # ── Constructor ───────────────────────────────────────────────────────────

    @classmethod
    def build(cls, **overrides) -> "ConfigManager":
        """
        Construct a validated ConfigManager.

        Usage:
            cfg = ConfigManager.build()
            cfg = ConfigManager.build(
                resolution=ResolutionConfig(H3_RESOLUTION=8),
                epidemiology=EpidemiologyConfig(BETA_HEAT_GLOBAL=0.05),
            )
        """
        instance = cls(**overrides) if overrides else cls()
        instance._validate()
        return instance

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate(self) -> None:
        """
        Assert all cross-field scientific invariants.
        Called by build() — never call directly.
        """
        # Legacy physics (kept for backward compat)
        if not (0 < self.physics.GAMMA <= 1):
            raise ValueError(
                "PhysicsConstants.GAMMA must be in (0, 1] — legacy field."
            )

        if self.resolution.H3_RESOLUTION < 0:
            raise ValueError(
                f"ResolutionConfig.H3_RESOLUTION must be >= 0. "
                f"Got {self.resolution.H3_RESOLUTION}."
            )

        # Coupling
        if not (self.coupling.GAMMA_MIN
                <= self.coupling.GAMMA_BASE
                <= self.coupling.GAMMA_MAX):
            raise ValueError(
                "CouplingConfig: GAMMA_BASE must be in [GAMMA_MIN, GAMMA_MAX]. "
                f"Got GAMMA_BASE={self.coupling.GAMMA_BASE}, "
                f"range=[{self.coupling.GAMMA_MIN}, {self.coupling.GAMMA_MAX}]."
            )

        # Boundary layer
        if self.boundary_layer.BLH_REF_MIN >= self.boundary_layer.BLH_REF_MAX:
            raise ValueError(
                "BoundaryLayerConfig: BLH_REF_MIN must be < BLH_REF_MAX. "
                f"Got [{self.boundary_layer.BLH_REF_MIN}, {self.boundary_layer.BLH_REF_MAX}]."
            )

        # Urban physics
        if self.urban_physics.ANTHRO_TEMP_CAP <= 0:
            raise ValueError(
                f"UrbanPhysicsConfig: ANTHRO_TEMP_CAP must be > 0. "
                f"Got {self.urban_physics.ANTHRO_TEMP_CAP}."
            )
        if not (0 < self.urban_physics.MIN_REL_HUMIDITY
                  < self.urban_physics.MAX_REL_HUMIDITY
                  <= 1):
            raise ValueError(
                "UrbanPhysicsConfig: humidity bounds must satisfy "
                "0 < MIN_REL_HUMIDITY < MAX_REL_HUMIDITY <= 1. "
                f"Got MIN={self.urban_physics.MIN_REL_HUMIDITY}, "
                f"MAX={self.urban_physics.MAX_REL_HUMIDITY}."
            )
        for climate_zone, k in self.urban_physics.WIND_K.items():
            if k <= 0:
                raise ValueError(
                    f"UrbanPhysicsConfig: WIND_K['{climate_zone}'] must be > 0. "
                    f"Got {k}."
                )

        # Epidemiology
        if self.epidemiology.MONTE_CARLO_DRAWS < 1:
            raise ValueError(
                f"EpidemiologyConfig: MONTE_CARLO_DRAWS must be >= 1. "
                f"Got {self.epidemiology.MONTE_CARLO_DRAWS}."
            )
        if not (0.0 < self.epidemiology.AC_ADAPTATION_SCALAR_MAX <= 1.0):
            raise ValueError(
                "EpidemiologyConfig: AC_ADAPTATION_SCALAR_MAX must be in (0, 1]. "
                f"Got {self.epidemiology.AC_ADAPTATION_SCALAR_MAX}."
            )
        if self.epidemiology.MMT_SHIFT_PER_DECADE < 0:
            raise ValueError(
                "EpidemiologyConfig: MMT_SHIFT_PER_DECADE must be >= 0. "
                f"Got {self.epidemiology.MMT_SHIFT_PER_DECADE}."
            )

        # Uncertainty priors
        lo, hi = self.uncertainty_priors.GAMMA_RANGE
        if lo >= hi:
            raise ValueError(
                "UncertaintyPriors: GAMMA_RANGE lower bound must be < upper bound. "
                f"Got ({lo}, {hi})."
            )

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """
        Full serialisation of all sub-configs.
        Used by VersionControl.hash_config() to produce the run checksum.
        Every sub-config block is included — nothing omitted.
        """
        return {
            "physics":            dataclasses.asdict(self.physics),
            "morphology":         dataclasses.asdict(self.morphology),
            "resolution":         dataclasses.asdict(self.resolution),
            "validation":         dataclasses.asdict(self.validation),
            "uncertainty":        dataclasses.asdict(self.uncertainty),
            "coupling":           dataclasses.asdict(self.coupling),
            "boundary_layer":     dataclasses.asdict(self.boundary_layer),
            "urban_physics":      dataclasses.asdict(self.urban_physics),
            "epidemiology":       dataclasses.asdict(self.epidemiology),
            "uncertainty_priors": dataclasses.asdict(self.uncertainty_priors),
            "urban_detection":    dataclasses.asdict(self.urban_detection),
            "derived": {
                "h3_col_name": self.h3_col_name,
            },
        }

    def summary(self) -> str:
        """
        Human-readable one-line summary for logging and run_metadata storage.
        Called by VersionControl.stamp() → RunStamp.config_summary.
        """
        return (
            f"Config ["
            f"Res={self.resolution.H3_RESOLUTION} | "
            f"Col={self.h3_col_name} | "
            f"Proxy={self.morphology.PROXY_MODE} | "
            f"γ∈[{self.coupling.GAMMA_MIN},{self.coupling.GAMMA_MAX}] | "
            f"RH∈[{self.urban_physics.MIN_REL_HUMIDITY},{self.urban_physics.MAX_REL_HUMIDITY}] | "
            f"AnthroCAP={self.urban_physics.ANTHRO_TEMP_CAP}°C | "
            f"MC={self.epidemiology.MONTE_CARLO_DRAWS}"
            f"]"
        )


# ---------------------------------------------------------------------------
# Module-level default factory
# ---------------------------------------------------------------------------

def default_config() -> ConfigManager:
    """
    Return the validated default ConfigManager.

    This is the single entry point used by:
        - scenario_runner.py (when no config override is provided)
        - tests (as the canonical baseline config)
        - CLI tools

    Never instantiate ConfigManager() directly in application code —
    always go through default_config() or ConfigManager.build().
    """
    return ConfigManager.build()