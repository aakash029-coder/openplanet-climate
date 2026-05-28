'use client';

import React, { useState, useEffect } from "react";
import { ExcelExportFullButton, type ExcelExportData } from "@/components/ExcelExport";
import { useClimateData, type CityClimateData, type Projection } from "@/context/ClimateDataContext";

function Code({ children }: { children: string }) {
  return (
    <code className="font-mono text-[10px] bg-slate-900/50 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 uppercase tracking-tighter shadow-sm">
      {children}
    </code>
  );
}

function Formula({ label, formula, note }: { label: string; formula: string; note?: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] border border-slate-800 rounded-xl px-6 py-5 my-6 relative overflow-hidden group shadow-sm">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/30 group-hover:bg-blue-500/80 transition-colors" />
      <p className="text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="text-white overflow-x-auto py-2 font-serif text-lg tracking-wide">{formula}</div>
      {note && (
        <div className="text-[10px] font-mono text-slate-500 mt-4 leading-relaxed uppercase tracking-widest border-t border-slate-800 pt-3">
          {note}
        </div>
      )}
    </div>
  );
}

function Ref({ authors, year, journal, title }: { authors: string; year: number; journal: string; title: string }) {
  return (
    <div className="flex gap-4 py-5 border-b border-slate-800/60 last:border-0 group hover:bg-slate-900/50 transition-colors px-4 -mx-4 rounded-lg">
      <span className="text-slate-500 font-mono text-[10px] mt-1 font-bold">[{year}]</span>
      <div className="space-y-1">
        <p className="text-[11px] font-mono text-slate-300 uppercase tracking-wider group-hover:text-white transition-colors">{authors}</p>
        <p className="text-[10px] font-mono text-slate-500 leading-relaxed uppercase tracking-widest">
          {title}. <span className="text-slate-400 italic font-bold">{journal}</span>
        </p>
      </div>
    </div>
  );
}

const DEMO_EXCEL_DATA: ExcelExportData = {
  city_name:           "TEMPLATE MATRIX — Execute deep dive to populate",
  lat:                 0,
  lng:                 0,
  ssp:                 "SSP2-4.5",
  target_year:         2050,
  era5_baseline_c:     0,
  era5_p95_c:          0,
  era5_humidity_p95:   0,
  peak_tx5d_c:         0,
  heatwave_days:       0,
  mean_temp_c:         0,
  population:          0,
  gdp_usd:             0,
  death_rate:          0,
  vulnerability:       0,
  canopy_pct:          0,
  albedo_pct:          0,
  attributable_deaths: 0,
  economic_decay_usd:  0,
  wbt_c:               0,
  cmip6_source:        "not_populated",
};

export default function MethodologyModule() {
  const [open, setOpen] = useState<string | null>("economics");
  const { primaryData } = useClimateData();

  const [currentExcelData, setCurrentExcelData] = useState<ExcelExportData>(DEMO_EXCEL_DATA);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const syncData = () => {
      let sourceData = primaryData;

      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('openplanet_last_risk_data');
        if (saved) {
          try { sourceData = JSON.parse(saved); } catch { /* ignore stale cache */ }
        }
      }

      if (sourceData) {
        try {
          const _source: CityClimateData = sourceData;
          const projections: Projection[] = Array.isArray(_source.projections) ? _source.projections : [];
          const proj: Projection | undefined = projections.find((p) => p.year === 2050) ?? projections[0];

          if (proj) {
            const safeNum = (val: unknown, fallback = 0): number => {
              if (val == null || val === '') return fallback;
              if (typeof val === 'number') return (isFinite(val) && !isNaN(val)) ? val : fallback;
              const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
              return (isNaN(n) || !isFinite(n)) ? fallback : n;
            };

            const baselineMean = _source.baseline?.baseline_mean_c ?? 20;

            const mappedData: ExcelExportData = {
              city_name:           _source.city_name || 'Target Settlement',
              lat:                 safeNum(_source.lat),
              lng:                 safeNum(_source.lng),
              ssp:                 _source.ssp || 'SSP2-4.5',
              target_year:         proj.year ?? 2050,
              era5_baseline_c:     safeNum(baselineMean),
              era5_p95_c:          safeNum(_source.threshold_c),
              era5_humidity_p95:   safeNum(_source.era5_humidity_p95 || 70),
              peak_tx5d_c:         safeNum(proj.peak_tx5d_c),
              heatwave_days:       safeNum(proj.heatwave_days),
              mean_temp_c:         safeNum(baselineMean + 2),
              population:          safeNum(_source.population),
              gdp_usd:             safeNum(_source.gdp_usd),
              death_rate:          7.5,
              vulnerability:       1.0,
              canopy_pct:          safeNum(_source.canopy_offset_pct),
              albedo_pct:          safeNum(_source.albedo_offset_pct),
              attributable_deaths: safeNum(proj.attributable_deaths),
              economic_decay_usd:  safeNum(proj.economic_decay_usd),
              wbt_c:               safeNum(proj.wbt_max_c),
              cmip6_source:        proj.source || 'CMIP6 Multi-Model Ensemble',
            };

            setCurrentExcelData(mappedData);
            setIsLive(true);
          }
        } catch { /* malformed source data — retain demo template */ }
      }
    };

    syncData();

    if (typeof window !== 'undefined') {
      window.addEventListener('climate_data_updated', syncData);
      window.addEventListener('storage', syncData);
    }
    
    const interval = setInterval(syncData, 1500);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('climate_data_updated', syncData);
        window.removeEventListener('storage', syncData);
      }
      clearInterval(interval);
    };
  }, [primaryData]);

  const sections = [
    {
      id: "economics",
      title: "Bipartite Economic Damage Model",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Traditional climate economics suffer from the "Oven & Freezer" averaging fallacy. To resolve this, OpenPlanet implements a <span className="text-white font-bold">Bipartite Hybrid Model</span>.</p>
          <Formula
            label="Integrated Macroeconomic & Heat Shock Formula"
            formula={"Loss = Base_Damage(Days_normal) + Shock_Damage(Days_extreme)"}
            note={<div className="space-y-2">
              <div><span className="text-blue-400">Base_Damage (Burke et al. 2018):</span> Applies to standard operational days. Penalty scales quadratically as annual mean temperature deviates from a 13°C global optimum.</div>
              <div><span className="text-blue-400">Shock_Damage (ILO Standards):</span> Triggers strictly during calculated heatwave days. Enforces a 1.5% physiological labor productivity constraint per degree exceeding 34.0°C (Tx5d limit).</div>
            </div>}
          />
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">
              Note: Metropolitan GDP is estimated via national GDP per capita multiplied by urban density productivity ratios. This provides a directional risk bracket for capital allocation, not audited financial reporting.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "wetbulb",
      title: "Thermodynamic Wet-Bulb Limits",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Wet-Bulb Temperature (WBT) determines absolute human survivability. OpenPlanet utilizes the empirical <span className="text-white font-bold">Stull (2011) equation</span> augmented with diurnal vapor pressure corrections.</p>
          <Formula
            label="Clausius-Clapeyron Corrected Stull Formula"
            formula={"WBT = Stull(T_max, RH_afternoon)"}
            note="Raw ERA5 daily maximum relative humidity occurs at night, whereas T_max occurs in the afternoon. We apply Clausius-Clapeyron saturation vapor pressure adjustments to accurately derive co-occurring afternoon humidity, preventing inflated wet-bulb anomalies in arid climates."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {[
              { range:"WBT < 28°C",  label:"Stable Operation", color:"text-emerald-500", desc:"Standard physiological cooling active" },
              { range:"28–31°C",     label:"Labor Constraint", color:"text-amber-500",   desc:"Mandatory rest cycles required for outdoor labor" },
              { range:"WBT ≥ 31°C", label:"Critical Hazard",  color:"text-red-500",     desc:"Approaching theoretical survivability limits (35°C)" },
            ].map((s) => (
              <div key={s.range} className="bg-[#09090b] border border-slate-800 p-4 rounded-lg">
                <p className={`${s.color} font-bold text-[10px] tracking-widest mb-1`}>{s.label}</p>
                <p className="text-white text-[10px] tracking-widest mb-2">{s.range}</p>
                <p className="text-slate-500 text-[9px] tracking-widest">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "zones",
      title: "Climate Archetype Self-Diagnosis",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Instead of relying on static coordinate mapping, the engine self-diagnoses the local climate zone using ERA5 thermal signatures. This determines the parameters used in the bipartite economic model.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse mt-4">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Archetype", "Detection Signature", "Engine Adjustment"].map(h => (
                    <th key={h} className="text-left text-slate-400 tracking-widest py-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[
                  { r:"Permafrost",         sig:"Mean Temp ≤ 2.0°C",                       adj:"Infrastructure thaw penalty (2.5% per °C > 0)" },
                  { r:"Lethal Humid",       sig:"WBT ≥ 31°C & RH ≥ 60%",                   adj:"Strict mortality escalation factor" },
                  { r:"Hyper-Arid",         sig:"Tx5d ≥ 38°C & P95 RH ≤ 45%",              adj:"Aridity productivity constraints applied" },
                  { r:"Extreme Continental",sig:"Tx5d - Mean Temp ≥ 28°C",                 adj:"Volatility amplifier (1.35x) on Burke baseline" },
                  { r:"Standard",           sig:"Baseline Temperate / Maritime",           adj:"Standard global meta-analysis applied" },
                ].map((row) => (
                  <tr key={row.r} className="hover:bg-slate-900/50 transition-colors">
                    <td className="text-white font-bold py-3 pr-4">{row.r}</td>
                    <td className="text-slate-400 py-3 pr-4">{row.sig}</td>
                    <td className="text-slate-500 py-3">{row.adj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "mortality",
      title: "Epidemiological Mortality Forecasting",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Heat-attributable mortality utilizes the <span className="text-white font-bold">Gasparrini et al. (2017) Lancet Planetary Health</span> dose-response framework combined with live UN Population data.</p>
          <Formula
            label="Attributable Fraction (AF) Formulation"
            formula={"Deaths = Pop × (DR/1000) × (HW/365) × AF × OP-CVI"}
            note={<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div><span className="text-blue-400">Pop</span> = Scaled Metropolitan Population</div>
              <div><span className="text-blue-400">DR</span> = UN API Crude Death Rate (Fallback: WHO)</div>
              <div><span className="text-blue-400">AF</span> = (RR−1)/RR, where RR = exp(0.0801 × ΔT)</div>
              <div><span className="text-blue-400">OP-CVI</span> = OpenPlanet Composite Vulnerability Index</div>
              <div className="col-span-2 text-amber-500/70">β = 0.0801 is the Gasparrini et al. (2017) global pooled mean — applied as a cross-city macro-benchmarking constant.</div>
            </div>}
          />
          <p className="mt-4">The <span className="text-white font-bold">OpenPlanet Composite Vulnerability Index (OP-CVI)</span> is an original cross-city macro-benchmarking proxy constructed from three socioeconomic axes:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label:"Wealth Proxy",    text:"Capital access for active cooling and AC adoption. Derived from World Bank GDP per capita (inverse scaling)." },
              { label:"Age Structure",   text:"Physiological sensitivity weight for elderly cohorts (65+). Anchored to Gasparrini et al. (2017) age-stratified analysis." },
              { label:"Health Capacity", text:"Emergency response viability via physicians per 1,000 (World Bank SH.MED.PHYS.ZS)." },
            ].map((item) => (
              <div key={item.label} className="bg-[#09090b] border border-slate-800 p-4 rounded-lg">
                <p className="text-slate-300 font-bold text-[10px] tracking-widest mb-2">{item.label}</p>
                <p className="text-slate-500 text-[9px] tracking-widest">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mt-2">
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed">
              OP-CVI is an original OpenPlanet normalization index for comparative cross-city portfolio screening. It is not a reproduction of any certified actuarial or epidemiological vulnerability standard.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "cmip6",
      title: "CMIP6 Ensemble & Climatology",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Near-term scenarios (2015–2050) utilize an equal-weighted multi-model ensemble of CMIP6 projections, anchoring local anomaly thresholds to a <span className="text-white font-bold">Contemporary Non-Stationary Baseline (2011–2020)</span>.</p>
          <Formula
            label="Empirical Heatwave Threshold — Contemporary Baseline"
            formula={"T_threshold = P95(ERA5 Tmax, 2011–2020)"}
            note={<div className="space-y-1">
              <div>The analytical calculation engine isolates the most recent complete decade (2011–2020, ~3,650 daily observations per coordinate) as its localized empirical baseline. Using a modern decade-scale window captures accelerated anthropogenic extreme heat velocities more accurately than a 30-year average that dilutes current thermal regimes with pre-acceleration climatology from the 1990s, while also ensuring reliable upstream API throughput. Macro-climatic context (1995–2024 trend) is surfaced separately in the overview display layer for orientation only.</div>
            </div>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            {[
              { year: "2030 - 2050", method: "CMIP6 API Integration", color: "text-blue-400",   note: "High-resolution model extraction" },
              { year: "2075 - 2100", method: "IPCC AR6 Extrapolation", color: "text-slate-400", note: "Published regional decadal delta rates" },
            ].map((r) => (
              <div key={r.year} className="bg-[#09090b] border border-slate-800 p-4 rounded-lg flex items-center justify-between">
                <span className="text-white font-bold text-lg">{r.year}</span>
                <div className="text-right"><span className={`text-[10px] ${r.color} tracking-widest font-bold block`}>{r.method}</span><span className="text-[9px] text-slate-500 tracking-widest">{r.note}</span></div>
              </div>
            ))}
          </div>
          <p>Post-2050 values utilize deterministic mathematical extrapolations published by the IPCC AR6 WG1 due to spatial API latency restrictions for deep-future granular datasets.</p>
        </div>
      ),
    },
    {
      id: "limitations",
      title: "Data Integrity & Acknowledgement of Limitations",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>OpenPlanet operates as a <span className="text-white font-bold">macroscopic climate risk intelligence engine</span>. It is engineered for rapid portfolio screening and directional asset risk allocation. It is explicitly not a substitute for microclimate CFD engineering or localized actuarial reporting.</p>
          <div className="space-y-3 mt-4">
            {[
              { label:"Spatial Resolution",             text:"Risk calculations are computed at the geocoded city centroid and projected outward via a spatial decay model to populate the H3 Resolution 9 hex grid (avg. cell ≈ 0.1053 km², edge ≈ 0.14 km). ERA5 native resolution is ~31 km and CMIP6 is ~20–50 km — the H3 grid provides a city-scale spatial indexing framework for visualization, not independent sub-cell temperature measurements." },
              { label:"Model Variance Sensitivity Bounds", text:"Displayed uncertainty ranges (±15% mortality, ±8% economic) are scaling constants for directional range orientation, not statistically derived confidence intervals from ensemble spread or Monte Carlo simulation." },
              { label:"Adaptation & Mitigation Offsets",text:"Urban canopy and albedo offsets are approximated via generalized linear correlations (e.g., Bowler et al. 2010). They do not reflect nuanced wind shear or structural shadow casting parameters. The simulator is a directional tool only." },
              { label:"Economic Proxy Dependency",     text:"Bipartite loss calculations deploy derived metropolitan GDP metrics. Supply chain contagion and secondary market volatility are excluded from direct loss estimates. OP-CVI is a macro-benchmarking proxy, not a certified actuarial index." },
              { label:"Data Lineage Transparency",     text:"Every API response carries a metadata.data_lineage field. When 'statistical_fallback' is active, a latitude-based piecewise regression was substituted for upstream ERA5 or CMIP6 API calls that timed out. Fallback outputs carry materially higher uncertainty and are flagged in the RightPanel lineage badge." },
            ].map((item) => (
              <div key={item.label} className="border border-slate-800 bg-[#09090b] rounded-lg p-4">
                <p className="font-bold text-[11px] tracking-widest mb-2 text-white">{item.label}</p>
                <p className="text-slate-400 text-[10px] tracking-widest leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "sources",
      title: "Scientific Citations",
      content: (
        <div className="space-y-2 mt-2">
          <Ref authors="Gasparrini A. et al." year={2017} title="Projections of temperature-related excess mortality under climate change scenarios" journal="Lancet Planetary Health" />
          <Ref authors="Burke M. et al." year={2018} title="Global non-linear effect of temperature on economic production" journal="Nature" />
          <Ref authors="ILO" year={2019} title="Working on a Warmer Planet: The Impact of Heat Stress on Labour Productivity" journal="International Labour Organization" />
          <Ref authors="Stull R." year={2011} title="Wet-bulb temperature from relative humidity and air temperature" journal="Journal of Applied Meteorology and Climatology" />
          <Ref authors="Hersbach H. et al." year={2020} title="The ERA5 global reanalysis" journal="Q. J. R. Meteorol. Soc." />
          <Ref authors="Sherwood S.C. & Huber M." year={2010} title="An adaptability limit to climate change due to heat stress" journal="PNAS" />
          <Ref authors="IPCC AR6 WG1" year={2021} title="Climate Change 2021: The Physical Science Basis" journal="Cambridge University Press" />
          <Ref authors="World Bank" year={2023} title="World Development Indicators (WDI)" journal="World Bank Group" />
          <Ref authors="UN Population Division" year={2024} title="World Population Prospects" journal="United Nations" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 flex flex-col min-h-full pb-12 relative z-10">

      {/* Header */}
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-slate-800 p-10 rounded-2xl shadow-lg relative overflow-hidden">
        <h2 className="text-[11px] font-mono font-bold text-white uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
          <span className="w-2 h-2 bg-blue-500 rounded-sm" />
          Scientific Protocol & Architecture
        </h2>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-[0.2em] leading-loose max-w-3xl">
          Complete documentation of empirical models, thermodynamic validations, and econometric methodologies powering the OpenPlanet Risk Intelligence Engine.
        </p>
      </div>

      {/* Accordion */}
      <div className="space-y-4 flex-grow">
        {sections.map((s) => (
          <div key={s.id} className="bg-[#09090b]/80 backdrop-blur-xl border border-slate-800 rounded-xl overflow-hidden group shadow-md transition-all duration-300 hover:border-slate-600">
            <button onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full flex items-center justify-between px-8 py-6 text-left transition-all hover:bg-slate-800/50">
              <span className={`text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-colors ${open === s.id ? "text-white" : "text-slate-400"}`}>{s.title}</span>
              <span className={`text-slate-500 transition-transform duration-500 ${open === s.id ? "rotate-180 text-white" : ""}`}>▼</span>
            </button>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${open === s.id ? "max-h-[2500px] opacity-100" : "max-h-0 opacity-0"}`}>
              <div className="px-8 pb-8 pt-2 border-t border-slate-800/60 bg-[#050505]">{s.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Excel Export ── */}
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl">
        <h3 className="text-[10px] font-mono text-white uppercase tracking-[0.4em] mb-2 flex items-center gap-3">
          <span className="w-2 h-2 bg-emerald-500 rounded-sm" />
          Auditable Financial Model Export
        </h3>
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-4 leading-relaxed">
          Download the operational 4-sheet valuation model. Adjustable input cells allow institutional risk managers to run sensitivity analyses directly within the exported spreadsheet framework.
        </p>

        {!isLive && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-5">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">
              Note: Uninitialized template mode. Execute a location query via the primary interface to compile localized climate vectors before export.
            </p>
          </div>
        )}

        {isLive && (
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"/>
            <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest leading-relaxed">
              Compiled Data Stream Active: {currentExcelData.city_name} | {currentExcelData.ssp} | {currentExcelData.target_year}
            </p>
          </div>
        )}

        <ExcelExportFullButton data={currentExcelData} />

        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mt-4">
          {isLive
            ? `Output conforms to internal modelling parameters derived for ${currentExcelData.city_name}. Designed for professional risk auditing and validation.`
            : `Base architectural file. Metrics default to null logic pending simulation trigger.`
          }
        </p>
      </div>

      {/* ── Legal Disclaimer ── */}
      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-5">
        <p className="text-[7px] font-mono text-amber-500/60 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
          <span>⚠</span> Regulatory Disclaimer
        </p>
        <p className="text-[8px] font-mono text-slate-600 leading-relaxed">
          All outputs are directional macro-scale proxies derived from public scientific datasets (Copernicus C3S ERA5 · Open-Meteo CMIP6 · World Bank WDI). They do not constitute certified weather forecasts, audited engineering assessments, insurance underwriting opinions, or financial instruments of any kind. The mortality model uses the Gasparrini et al. (2017) global pooled β = 0.0801 as a cross-city benchmarking constant. Model Variance Sensitivity Bounds (±15% / ±8%) are scaling constants, not statistically derived confidence intervals. When{' '}
          <span className="text-amber-500/70">metadata.data_lineage = &quot;statistical_fallback&quot;</span>, a latitude-based piecewise regression was substituted for a failed upstream API call — treat as indicative only. The authors accept zero civil or commercial liability for any consequential action taken in reliance on these outputs. Independent validation is mandatory before operational deployment.
        </p>
      </div>
    </div>
  );
}