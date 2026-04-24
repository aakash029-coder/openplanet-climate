'use client';

import { useState, useEffect } from "react";
import { ExcelExportFullButton, type ExcelExportData } from "@/components/ExcelExport";
import { useClimateData } from "@/context/ClimateDataContext";

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
          try { 
            sourceData = JSON.parse(saved); 
          } catch (e) { console.error("Cache read fail"); }
        }
      }

      if (sourceData) {
        try {
          const _source: any = sourceData;
          const projections = Array.isArray(_source.projections) ? _source.projections : [_source];
          const proj: any = projections.find((p: any) => Number(p.year || p.target_year) === 2050) || projections[0];

          if (proj) {
            const safeNum = (val: any, fallback = 0): number => {
              if (val == null || val === "" || val === undefined) return fallback;
              if (typeof val === 'number') {
                return (isFinite(val) && !isNaN(val)) ? val : fallback;
              }
              const str = String(val).toUpperCase().trim().replace(/,/g, '').replace(/\s/g, '');
              if (/^-?[\d.]+E[+-]?\d+$/i.test(str)) {
                const parsed = parseFloat(str);
                return (isFinite(parsed) && !isNaN(parsed)) ? parsed : fallback;
              }
              const cleanStr = str.replace(/^\$/, '');
              let multi = 1;
              let numStr = cleanStr;
              if (cleanStr.endsWith('T') || cleanStr.includes('TRILLION')) {
                multi = 1e12;
                numStr = cleanStr.replace(/T$|TRILLION/g, '');
              } else if (cleanStr.endsWith('B') || cleanStr.includes('BILLION')) {
                multi = 1e9;
                numStr = cleanStr.replace(/B$|BILLION/g, '');
              } else if (cleanStr.endsWith('M') || cleanStr.includes('MILLION')) {
                multi = 1e6;
                numStr = cleanStr.replace(/M$|MILLION/g, '');
              } else if (cleanStr.endsWith('K')) {
                multi = 1e3;
                numStr = cleanStr.replace(/K$/, '');
              }
              const parsed = parseFloat(numStr.replace(/[^0-9.\-]/g, ''));
              return (isNaN(parsed) || !isFinite(parsed)) ? fallback : parsed * multi;
            };

            const baselineMean = _source.baseline?.baseline_mean_c || proj.era5_baseline_c || 20;
            const extractedLat = _source.lat ?? proj.lat ?? _source.location?.lat ?? _source.geo?.lat ?? _source.metadata?.lat ?? 0;
            const extractedLng = _source.lng ?? proj.lng ?? _source.location?.lng ?? _source.geo?.lng ?? _source.metadata?.lng ?? 0;

            const mappedData: ExcelExportData = {
              city_name:           _source.city_name || proj.city_name || "Target Settlement",
              lat:                 safeNum(extractedLat),
              lng:                 safeNum(extractedLng),
              ssp:                 _source.ssp || proj.ssp || "SSP2-4.5",
              target_year:         safeNum(proj.year || proj.target_year, 2050),
              era5_baseline_c:     safeNum(baselineMean),
              era5_p95_c:          safeNum(_source.threshold_c || proj.era5_p95_c),
              era5_humidity_p95:   safeNum(_source.era5_humidity_p95 || proj.era5_humidity_p95 || 70),
              peak_tx5d_c:         safeNum(proj.peak_tx5d_c || proj.temp),
              heatwave_days:       safeNum(proj.heatwave_days || proj.heatwave),
              mean_temp_c:         safeNum(proj.mean_temp_c || (baselineMean + 2)),
              population:          safeNum(_source.population || proj.population),
              gdp_usd:             safeNum(_source.gdp_usd || proj.gdp_usd),
              death_rate:          safeNum(proj.death_rate || 7.5),
              vulnerability:       safeNum(proj.vulnerability || 1.0),
              canopy_pct:          safeNum(_source.canopy_offset_pct || 0),
              albedo_pct:          safeNum(_source.albedo_offset_pct || 0),
              attributable_deaths: safeNum(proj.attributable_deaths || proj.deaths),
              economic_decay_usd:  safeNum(proj.economic_decay_usd || proj.loss),
              wbt_c:               safeNum(proj.wbt_max_c || proj.wbt),
              cmip6_source:        proj.source || "CMIP6 Multi-Model Ensemble",
            };

            setCurrentExcelData(mappedData);
            setIsLive(true);
          }
        } catch (err) {
          console.error("Methodology Data Sync Error:", err);
        }
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
            formula={"Deaths = Pop × (DR/1000) × (HW/365) × AF × V"}
            note={<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div><span className="text-blue-400">Pop</span> = Scaled Metropolitan Population</div>
              <div><span className="text-blue-400">DR</span> = UN API Crude Death Rate (Fallback: WHO)</div>
              <div><span className="text-blue-400">AF</span> = (RR−1)/RR, where RR = exp(0.0801 × ΔT)</div>
              <div><span className="text-blue-400">V</span> = Composite Vulnerability Multiplier</div>
            </div>}
          />
          <p className="mt-4">The Vulnerability Multiplier (V) evaluates adaptive capacity through three data-driven dimensions:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label:"Wealth Proxy",  text:"Capital access for active cooling / AC adoption curves." },
              { label:"Age Structure", text:"Physiological sensitivity scaling for elderly cohorts (>65)." },
              { label:"Health Capacity", text:"Emergency response viability via physicians per 1,000." },
            ].map((item) => (
              <div key={item.label} className="bg-[#09090b] border border-slate-800 p-4 rounded-lg">
                <p className="text-slate-300 font-bold text-[10px] tracking-widest mb-2">{item.label}</p>
                <p className="text-slate-500 text-[9px] tracking-widest">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "cmip6",
      title: "CMIP6 Ensemble & Climatology",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>Near-term scenarios (2015–2050) utilize an equal-weighted multi-model ensemble of CMIP6 projections, anchoring local anomaly thresholds to the ERA5 1991-2020 climatology.</p>
          <Formula
            label="Empirical Heatwave Threshold"
            formula={"T_threshold = P95(ERA5 Tmax, 1991–2020)"}
            note="Thresholds are strictly emergent from localized 30-year meteorological physics. We compute the 95th percentile from ~10,950 daily maximum temperature observations per coordinate."
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
              { label:"Spatial Averaging",             text:"The spatial grid resolves to H3 boundaries using ERA5 (~31km) and CMIP6 (~50km) resolutions. Hyper-local street-canyon heat retention is modeled heuristically via distance-decay algorithms rather than real-time fluid dynamics." },
              { label:"Adaptation & Mitigation Offsets",text:"Urban canopy and albedo offsets are approximated via generalized linear correlations (e.g., Bowler et al. 2010). They do not reflect nuanced wind shear or structural shadow casting parameters." },
              { label:"Economic Proxy Dependency",     text:"Bipartite loss calculations deploy derived metropolitan GDP metrics. Supply chain contagion and secondary market volatility are excluded from direct loss estimates." },
              { label:"Zero Fallback Mandate",         text:"The engine enforces strict data requirements. If accurate APIs (geocoding, UN demographic data) fail after structured retry protocols, calculations are intentionally halted rather than defaulting to arbitrary global means." },
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
    </div>
  );
}