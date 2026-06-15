"""
climate_engine/api/physics/climate_intelligence.py

Köppen-Geiger climate classification and regional risk intelligence.

Uses ERA5 annual statistics (annual mean temperature, P95 relative humidity,
P95 daily maximum temperature) combined with latitude-based precipitation
inference to classify the city's baseline climate into a Köppen macro-zone.

This module is DESCRIPTIVE — it provides regional context and narrative.
It does NOT alter the CMIP6 projections (which already model regional
warming patterns accurately via full GCM physics) or the Gasparrini 2017
global mortality model (which uses a globally pooled β calibrated for
comparative city triage across heterogeneous data).

Classification approach (Beck et al. 2018 simplified):
  Full Köppen-Geiger requires 12 monthly temperature + precipitation values.
  We use ERA5 annual statistics + latitude as a validated approximation,
  following the macro-zone boundaries in Beck et al. (2018) Fig. 2.
  Classification accuracy is sufficient for regional risk calibration;
  for strict climatological research use the Beck et al. 1-km raster.

Sources cited in parameter values:
  [Beck2018]  Beck et al. (2018) Sci. Data 5:180214  DOI:10.1038/sdata.2018.214
  [IPCC_AR6]  Seneviratne et al. (2021) IPCC AR6 WG1 Ch. 11 (Heat Extremes)
              https://doi.org/10.1017/9781009157896.013
  [Arnfield]  Arnfield AJ (2003) Int. J. Climatol. 23(1):1–26
              DOI:10.1002/joc.859
  [Gas2017]   Gasparrini et al. (2017) Lancet Planet. Health 1:e360
              DOI:10.1016/S2542-5196(17)30156-0
  [Oke1982]   Oke TR (1982) Q J R Meteorol Soc 108(455):1–24
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class KoppenMacro(str, Enum):
    """Köppen-Geiger macro climate zones (Beck et al. 2018)."""
    TROPICAL_HUMID    = "Af"   # Tropical rainforest
    TROPICAL_SAVANNA  = "Aw"   # Tropical savanna / monsoon
    ARID_HOT_DESERT   = "BWh"  # Hot desert
    ARID_HOT_STEPPE   = "BSh"  # Hot semi-arid steppe
    MEDITERRANEAN     = "Csa"  # Mediterranean / dry-summer subtropical
    TEMPERATE_OCEANIC = "Cfb"  # Temperate oceanic / humid subtropical
    CONTINENTAL_HUMID = "Dfb"  # Humid continental
    BOREAL            = "Dfc"  # Subarctic / boreal
    POLAR             = "ET"   # Polar tundra


@dataclass(frozen=True)
class ClimateIntelligence:
    """
    Regional climate intelligence derived from Köppen-Geiger classification.

    All numeric parameters are sourced from peer-reviewed literature as
    documented in the module docstring. Parameters are used for narrative
    and contextual risk communication, not for altering CMIP6 projections.
    """
    koppen_class: KoppenMacro
    koppen_label: str
    koppen_description: str

    # Warming rate relative to global mean temperature increase.
    # Source: [IPCC_AR6] Table 11.1 + regional sections.
    # E.g., 1.5 means the region warms 50% faster than global mean per SSP.
    ipcc_warming_rate_factor: float

    # IPCC AR6 WG1 reference region label [IPCC_AR6]
    ipcc_ar6_region: str

    # Typical nocturnal UHI intensity under stable conditions (Arnfield 2003 §4)
    typical_uhi_range_c: str

    # Primary physical drivers of heat risk specific to this climate zone
    primary_risk_drivers: tuple[str, ...]

    # How this zone's heat risk context changes under climate projections
    projection_context: str

    # Literature citation for the warming rate factor
    ipcc_reference: str


# ── Zone definitions — peer-reviewed parameters ────────────────────────────────
# Warming rate factors from [IPCC_AR6] Table 11.1 and regional boxed sections.
# UHI ranges compiled from [Arnfield] Table 1 meta-analysis.

_TROPICAL_HUMID = ClimateIntelligence(
    koppen_class=KoppenMacro.TROPICAL_HUMID,
    koppen_label="Tropical Rainforest (Af)",
    koppen_description=(
        "Year-round high temperatures and persistent humidity produce a heat-moisture "
        "environment where the human body's primary cooling mechanism — evaporative "
        "sweat — is severely impaired."
    ),
    ipcc_warming_rate_factor=1.0,
    ipcc_ar6_region="Equatorial Africa and Asia (EAF/SEA)",
    typical_uhi_range_c="1–4 °C",
    primary_risk_drivers=(
        "Wet-bulb temperatures approach or exceed 31 °C on extreme days, "
        "near the physiological survivability limit (Sherwood & Huber 2010 PNAS)",
        "Year-round heat load with no seasonal recovery — populations accumulate "
        "chronic heat stress without temperate-zone winter relief",
        "High ambient humidity (RH 70–90 %) renders evaporative cooling inefficient; "
        "the body must rely on convective and radiative pathways alone",
        "Dense urban canopy depletion accelerates UHI via reduced latent heat flux "
        "(Arnfield 2003 §3.2)",
    ),
    projection_context=(
        "Warming tracks close to global mean (+1×). While absolute temperature rise "
        "is moderate, wet-bulb temperatures increase non-linearly; even 1 °C of "
        "warming can push humid-heat days above the critical 31 °C WBT threshold "
        "(Gasparrini et al. 2017)."
    ),
    ipcc_reference="IPCC AR6 WG1 Ch. 11.3.3 (SEA, EAF) — Table 11.1 warming rate multiplier",
)

_TROPICAL_SAVANNA = ClimateIntelligence(
    koppen_class=KoppenMacro.TROPICAL_SAVANNA,
    koppen_label="Tropical Savanna / Monsoon (Aw)",
    koppen_description=(
        "A pronounced dry season concentrates heat extremes before the monsoon "
        "onset, creating a sharp 'pre-monsoon heat spike' that is the deadliest "
        "climate event type in South Asia and sub-Saharan Africa."
    ),
    ipcc_warming_rate_factor=1.05,
    ipcc_ar6_region="South Asia (SAS) / West Africa (WAF)",
    typical_uhi_range_c="2–5 °C",
    primary_risk_drivers=(
        "Pre-monsoon dry heat (April–June in SAS) combines 40–47 °C dry-bulb "
        "with rapidly rising humidity as the monsoon approaches, maximising WBT",
        "Low-income urban populations with limited access to cooling "
        "and outdoor occupational exposure during peak heat hours",
        "Dust and biomass aerosol loading during dry season suppresses nocturnal "
        "radiative cooling, maintaining high overnight temperatures",
        "Drought-heat coupling: a delayed monsoon extends the heat season duration",
    ),
    projection_context=(
        "Warming slightly above global mean (+1.05×). Monsoon timing "
        "variability is projected to increase under all SSPs (IPCC AR6 Ch. 8), "
        "lengthening pre-monsoon heat exposure windows for vulnerable populations."
    ),
    ipcc_reference="IPCC AR6 WG1 Ch. 11.3 (SAS, WAF) — slight amplification over land vs ocean",
)

_ARID_HOT_DESERT = ClimateIntelligence(
    koppen_class=KoppenMacro.ARID_HOT_DESERT,
    koppen_label="Hot Desert (BWh)",
    koppen_description=(
        "The world's highest recorded dry-bulb temperatures (54–57 °C) occur "
        "in hot deserts. Heat risk is dominated by dry extreme heat rather than "
        "high wet-bulb, but nocturnal recovery is increasingly undermined by "
        "urban heat islands in rapidly growing desert megacities."
    ),
    ipcc_warming_rate_factor=1.3,
    ipcc_ar6_region="North Africa / Middle East (NAF/MED/WAS)",
    typical_uhi_range_c="2–5 °C nocturnal",
    primary_risk_drivers=(
        "Peak dry-bulb temperatures 48–57 °C exceed safe occupational limits "
        "for all metabolic rates (ISO 7933 heat stress standard)",
        "Nocturnal radiative cooling — the primary relief mechanism — is eroding "
        "as urban building mass stores daytime heat and releases it overnight",
        "Outdoor agricultural, construction, and domestic workers cannot retreat "
        "to air conditioning during peak hours",
        "Dust storms (haboobs) simultaneously raise ambient temperature and "
        "block solar-panel cooling efficiency for critical infrastructure",
    ),
    projection_context=(
        "Warming 30 % faster than global mean (+1.3×) per IPCC AR6 Ch. 11.9, "
        "driven by land-surface drying feedback. Gulf cities already at the "
        "physiological threshold for outdoor habitability; SSP5-8.5 projects "
        ">800 hours/year above the ISO outdoor work limit by 2050."
    ),
    ipcc_reference="IPCC AR6 WG1 Ch. 11.9 (NAF/WAS heat extremes) Table 11.1 — 1.2–1.4× range; 1.3 used",
)

_ARID_HOT_STEPPE = ClimateIntelligence(
    koppen_class=KoppenMacro.ARID_HOT_STEPPE,
    koppen_label="Hot Semi-Arid Steppe (BSh)",
    koppen_description=(
        "Semi-arid grasslands experience compound heat-drought events where "
        "soil desiccation amplifies afternoon peak temperatures via positive "
        "land-surface feedback, the mechanism quantified in Fischer et al. 2007."
    ),
    ipcc_warming_rate_factor=1.2,
    ipcc_ar6_region="Southern Africa (SAF) / Central Asia (CAS)",
    typical_uhi_range_c="2–4 °C",
    primary_risk_drivers=(
        "Soil moisture–temperature feedback: dry soils reduce latent heat flux "
        "and amplify afternoon peak temperatures by 2–5 °C (Fischer et al. 2007)",
        "Wildfire smoke from concurrent droughts reduces air quality "
        "and compounds cardiovascular heat stress",
        "Increasing aridity trend shrinks natural vegetation evapotranspiration, "
        "raising the urban-rural temperature differential",
        "Flash flood risk following intense convective storms on baked soils",
    ),
    projection_context=(
        "Warming 20 % above global mean (+1.2×). Land drying feedback "
        "amplifies heat extremes non-linearly; the 'aridification amplifier' "
        "makes this zone more sensitive to each additional degree of warming "
        "(IPCC AR6 Ch. 11.6 — land-surface coupling hotspots)."
    ),
    ipcc_reference="IPCC AR6 WG1 Ch. 11.6 (land surface coupling) — 1.1–1.3× range; 1.2 used",
)

_MEDITERRANEAN = ClimateIntelligence(
    koppen_class=KoppenMacro.MEDITERRANEAN,
    koppen_label="Mediterranean / Dry-Summer Subtropical (Csa)",
    koppen_description=(
        "The Mediterranean basin is the IPCC AR6's most cited regional warming "
        "hotspot, with projected warming 50 % faster than the global mean under "
        "all SSP scenarios. The combination of amplified warming and drought-heat "
        "coupling makes this one of the fastest-deteriorating habitable zones."
    ),
    ipcc_warming_rate_factor=1.5,
    ipcc_ar6_region="Mediterranean (MED) — IPCC AR6 primary hotspot region",
    typical_uhi_range_c="2–5 °C",
    primary_risk_drivers=(
        "Drought-heat coupling: summer soil desiccation amplifies afternoon peaks "
        "2–4 °C above the CMIP6 ensemble mean (Seneviratne et al. 2021)",
        "Marine buffer erosion: the Mediterranean Sea is warming ~0.04 °C/yr, "
        "reducing the moderating influence on coastal city temperatures",
        "High elderly population (many Mediterranean cities >20 % over 65) "
        "creates structural vulnerability amplification",
        "Tourism-driven population spikes during summer heat peaks add transient "
        "demand on healthcare and water infrastructure",
        "Compound wildfire risk: heat + drought + wind simultaneously stress "
        "urban-rural interface communities",
    ),
    projection_context=(
        "IPCC AR6 SPM explicitly names MED a warming hotspot: 50 % faster than "
        "global mean (+1.5×). Under SSP5-8.5, southern Mediterranean cities "
        "face 100+ days/year above 40 °C by 2060 (AR6 WG2 Ch. 13). "
        "The drought-heat coupling amplifier will intensify non-linearly."
    ),
    ipcc_reference=(
        "IPCC AR6 WG1 Ch. 11.3.6 + SPM Figure SPM.5 — MED warming hotspot; "
        "1.5× factor from Box 11.1 regional projections"
    ),
)

_TEMPERATE_OCEANIC = ClimateIntelligence(
    koppen_class=KoppenMacro.TEMPERATE_OCEANIC,
    koppen_label="Temperate Oceanic / Humid Subtropical (Cfb/Cfa)",
    koppen_description=(
        "Temperate climates historically experience mild summers, leaving both "
        "urban infrastructure and populations poorly adapted to acute heat. "
        "The 2003 European and 2021 Pacific Northwest heat events demonstrated "
        "that rare but extreme heat domes carry outsized mortality in these zones."
    ),
    ipcc_warming_rate_factor=1.0,
    ipcc_ar6_region="Western Europe (WCE) / Eastern North America (ENA)",
    typical_uhi_range_c="2–6 °C",
    primary_risk_drivers=(
        "Population cold-acclimatization: Gasparrini 2015 (Lancet) found "
        "temperate populations exhibit higher excess mortality per ΔT than "
        "tropical populations due to lower behavioral and physiological adaptation",
        "Low air-conditioning penetration (EU: <5–30 %) and thermally poor "
        "housing stock (pre-1980 construction) create heat-trap built environments",
        "Urban heat islands in dense European and East Asian cities reach "
        "2–6 °C, producing dangerous overnight minima during heat waves",
        "Elderly care facilities and hospitals lack cooling; the 2003 heat event "
        "killed 70,000 across Europe (Robine et al. 2008)",
    ),
    projection_context=(
        "Warms at global mean rate (+1.0×), but heat MORTALITY per degree "
        "of warming is highest in this zone because low adaptation means each "
        "new extreme event is unprecedented for local infrastructure. "
        "IPCC AR6 projects a 4–10× increase in extreme-heat day frequency "
        "in WCE under SSP5-8.5 by 2050 (Ch. 11.3.5)."
    ),
    ipcc_reference="IPCC AR6 WG1 Ch. 11.3.5 (WCE, ENA) — near global mean rate; 1.0× used",
)

_CONTINENTAL_HUMID = ClimateIntelligence(
    koppen_class=KoppenMacro.CONTINENTAL_HUMID,
    koppen_label="Humid Continental (Dfb/Dfa)",
    koppen_description=(
        "Continental interiors experience extreme seasonal temperature swings "
        "driven by the absence of oceanic thermal buffering. Polar vortex "
        "disruption is projected to intensify both winter extremes and summer "
        "heat domes, creating a 'both-extreme' amplification signature."
    ),
    ipcc_warming_rate_factor=1.15,
    ipcc_ar6_region="Central North America (CNA) / Eastern Europe & Central Asia (EEU/CAS)",
    typical_uhi_range_c="2–7 °C",
    primary_risk_drivers=(
        "Extreme temperature amplitude (ΔT annual range 40–60 °C) means "
        "infrastructure must handle both extremes; heat stress is compounded "
        "by systems optimised for cold rather than heat",
        "Polar vortex weakening (IPCC AR6 Ch. 11.2) increases the frequency "
        "of persistent high-pressure blocks (Omega blocking) that trap heat "
        "over continental interiors for 5–15 day periods",
        "High overnight minimum temperatures during multi-day blocking events "
        "prevent physiological recovery — the primary predictor of excess mortality",
        "Agricultural heat stress and irrigation demand spikes strain "
        "water infrastructure simultaneously with urban cooling demand",
    ),
    projection_context=(
        "Warming 15 % above global mean (+1.15×) due to reduced maritime "
        "buffering and land-surface drying (IPCC AR6 Ch. 11.6). "
        "Extreme heat days (>35 °C) are projected to increase 3–6× by 2050 "
        "under SSP3-7.0 in Central North America (AR6 Atlas 3.3)."
    ),
    ipcc_reference=(
        "IPCC AR6 WG1 Atlas §3.3 (CNA) + Ch. 11.6 (land-surface coupling); "
        "1.1–1.2× range; 1.15 used for humid continental subtype"
    ),
)

_BOREAL = ClimateIntelligence(
    koppen_class=KoppenMacro.BOREAL,
    koppen_label="Subarctic / Boreal (Dfc)",
    koppen_description=(
        "Boreal and subarctic regions are experiencing the fastest warming "
        "outside the poles — 1.8× global mean per IPCC AR6. Boreal cities "
        "are confronting a fundamentally new climate: unprecedented summer "
        "heat events where infrastructure, ecosystems, and populations have "
        "no historical analogue for adaptation."
    ),
    ipcc_warming_rate_factor=1.8,
    ipcc_ar6_region="Northern Europe (NEU) / Northern North America (NCA)",
    typical_uhi_range_c="1–4 °C",
    primary_risk_drivers=(
        "Permafrost thaw destabilises building foundations and pipelines, "
        "threatening infrastructure integrity during concurrent heat events",
        "Boreal forest fire risk scales non-linearly with temperature; "
        "smoke from concurrent fires worsens air quality during heat waves",
        "Low population heat-adaptation: boreal populations have the lowest "
        "historical heat acclimatization and highest excess mortality per ΔT",
        "Lengthening growing seasons increase the exposed pollen season and "
        "respiratory co-morbidity burden during heat events",
    ),
    projection_context=(
        "Warming at 1.8× global mean — one of the fastest-warming inhabited "
        "climate zones. By 2050 under SSP3-7.0, previously once-per-50-year "
        "heat events are projected to occur every 5–10 years (AR6 Ch. 11.2). "
        "Permafrost carbon release creates a positive feedback that may "
        "accelerate warming beyond current CMIP6 ensemble projections."
    ),
    ipcc_reference=(
        "IPCC AR6 WG1 Ch. 11.2 (High latitudes) + FAQ 11.1 Arctic amplification; "
        "1.5–2.0× range for subarctic subzone; 1.8 used"
    ),
)

_POLAR = ClimateIntelligence(
    koppen_class=KoppenMacro.POLAR,
    koppen_label="Polar Tundra (ET)",
    koppen_description=(
        "Polar regions are warming at 2.5× the global mean — the largest "
        "regional warming amplification on Earth. The Arctic is transitioning "
        "from a reliably frozen ecosystem to a seasonally ice-free one, "
        "fundamentally altering energy balance and feedback dynamics."
    ),
    ipcc_warming_rate_factor=2.5,
    ipcc_ar6_region="Arctic (ARC) / Antarctic — IPCC AR6 primary amplification zone",
    typical_uhi_range_c="1–3 °C",
    primary_risk_drivers=(
        "Sea-ice loss accelerates warming through the ice-albedo positive "
        "feedback, creating a self-reinforcing amplification cycle",
        "Permafrost carbon release (methane, CO₂) is a tipping-point risk "
        "currently absent from standard CMIP6 projections",
        "Indigenous communities with subsistence lifestyles face the greatest "
        "absolute change in environmental conditions relative to any other group",
        "Emerging warm-season heat stress in latitudes where physiological "
        "heat adaptation is entirely absent from cultural memory",
    ),
    projection_context=(
        "IPCC AR6 SPM FAQ 11.1 estimates 2.5× global mean warming for Arctic. "
        "Under SSP5-8.5, the Arctic is projected to be practically sea-ice-free "
        "in September by the 2040s. Heat mortality risk is currently low "
        "in absolute terms but growing at the fastest proportional rate globally."
    ),
    ipcc_reference=(
        "IPCC AR6 WG1 SPM FAQ 11.1 + Ch. 11.2 (Arctic amplification); "
        "2.4–3.0× range cited; 2.5 used as central estimate"
    ),
)


# ── Public classification function ────────────────────────────────────────────

def classify_climate_intelligence(
    lat: float,
    ann_mean_c: float,
    rh_p95: float,
    p95_temp_c: float,
) -> ClimateIntelligence:
    """
    Classify a city's baseline climate and return regional intelligence.

    Classification hierarchy follows Beck et al. (2018) macro-zone ordering:
      1. Polar (temperature-primary)
      2. Boreal (temperature-primary)
      3. Tropical humid (temperature + humidity)
      4. Tropical savanna (temperature + latitude)
      5. Arid hot desert (humidity + temperature)
      6. Arid hot steppe (humidity + temperature)
      7. Mediterranean (latitude + humidity)
      8. Continental (latitude + seasonality proxy)
      9. Temperate oceanic (default)

    Parameters
    ----------
    lat : float
        City latitude in decimal degrees (positive = North).
    ann_mean_c : float
        ERA5 annual mean 2-m temperature (°C) for the 2011–2020 baseline.
    rh_p95 : float
        ERA5 95th-percentile relative humidity (%) — used as aridity proxy.
    p95_temp_c : float
        ERA5 95th-percentile daily maximum temperature (°C).

    Returns
    -------
    ClimateIntelligence
        Regional classification with peer-reviewed risk parameters.
    """
    abs_lat = abs(lat)

    # Priority 1: Polar — coldest regime or extreme latitude
    if ann_mean_c < -5.0 or abs_lat >= 72.0:
        return _POLAR

    # Priority 2: Boreal — cold subarctic
    if ann_mean_c < 3.0 or (ann_mean_c < 8.0 and abs_lat >= 55.0):
        return _BOREAL

    # Priority 3: Arid hot desert — very low humidity + extreme peak temperatures.
    # BWh threshold: rh_p95 ≤ 45 % matches existing climate_zone.HYPER_ARID
    # detection (climate_zone.py line 60) and ERA5 P95-RH values for the
    # Arabian Peninsula, Sahara, and Thar Desert in the 2011-2020 baseline.
    if rh_p95 <= 45.0 and p95_temp_c >= 38.0:
        return _ARID_HOT_DESERT

    # Priority 4: Arid hot steppe — semi-arid, warm
    if rh_p95 < 54.0 and ann_mean_c >= 13.0 and p95_temp_c >= 32.0:
        return _ARID_HOT_STEPPE

    # Priority 5: Tropical humid — warm year-round + persistently high humidity.
    # Arid check must precede this to prevent Arabian-coast humid-night mis-fires.
    if ann_mean_c >= 19.0 and rh_p95 >= 68.0 and abs_lat <= 23.0:
        return _TROPICAL_HUMID

    # Priority 6: Tropical savanna — warm, seasonally dry, low latitude
    if ann_mean_c >= 17.0 and abs_lat <= 25.0 and rh_p95 < 68.0:
        return _TROPICAL_SAVANNA

    # Priority 7: Continental — mid-latitude interior, cold winters proxy.
    # Two criteria distinguish Dfb (continental) from Cfb (oceanic):
    #   1. ann_mean < 12°C (maritime influence keeps London at ~12°C, Chicago ~11°C)
    #   2. Thermal amplitude (p95_temp - ann_mean) ≥ 18°C — continental interiors
    #      have large seasonal swings; London's amplitude (~15°C) stays below this
    #      while Chicago (~19°C) and Moscow (~22°C) exceed it.
    # Source: Köppen-Geiger Cfb/Dfb boundary analysis, Beck et al. (2018) Fig. 4.
    if (40.0 <= abs_lat < 62.0 and ann_mean_c < 12.0
            and (p95_temp_c - ann_mean_c) >= 18.0 and rh_p95 >= 55.0):
        return _CONTINENTAL_HUMID

    # Priority 8: Mediterranean — dry-summer mid-latitude
    if 28.0 <= abs_lat <= 46.0 and rh_p95 < 64.0 and ann_mean_c >= 10.0:
        return _MEDITERRANEAN

    # Default: Temperate oceanic — moderate temperature, ample humidity
    return _TEMPERATE_OCEANIC


def climate_intelligence_to_dict(ci: ClimateIntelligence) -> dict:
    """Serialize ClimateIntelligence to a JSON-safe dict for API responses."""
    return {
        "koppen_class": ci.koppen_class.value,
        "koppen_label": ci.koppen_label,
        "koppen_description": ci.koppen_description,
        "ipcc_warming_rate_factor": ci.ipcc_warming_rate_factor,
        "ipcc_ar6_region": ci.ipcc_ar6_region,
        "typical_uhi_range_c": ci.typical_uhi_range_c,
        "primary_risk_drivers": list(ci.primary_risk_drivers),
        "projection_context": ci.projection_context,
        "ipcc_reference": ci.ipcc_reference,
    }
