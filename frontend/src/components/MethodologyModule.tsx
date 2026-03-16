'use client';

import { useState } from "react";

function Code({ children }: { children: string }) {
  return (
    <code className="font-mono text-[10px] bg-cyan-950/30 border border-cyan-500/20 rounded px-1.5 py-0.5 text-cyan-400 uppercase tracking-tighter shadow-inner">
      {children}
    </code>
  );
}

function Formula({ label, formula, note }: { label: string; formula: string; note?: React.ReactNode }) {
  return (
    <div className="bg-[#050b14]/60 border border-cyan-500/20 rounded-xl px-6 py-5 my-6 relative overflow-hidden group shadow-[0_0_20px_rgba(34,211,238,0.03)] backdrop-blur-md">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      <p className="text-[10px] font-mono text-cyan-200 uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="text-white overflow-x-auto py-2 font-serif text-lg tracking-wide">{formula}</div>
      {note && (
        <div className="text-[10px] font-mono text-slate-400 mt-4 leading-relaxed uppercase tracking-widest border-t border-cyan-500/10 pt-3">
          {note}
        </div>
      )}
    </div>
  );
}

function Ref({ authors, year, journal, title }: { authors: string; year: number; journal: string; title: string }) {
  return (
    <div className="flex gap-4 py-5 border-b border-cyan-500/10 last:border-0 group hover:bg-cyan-900/10 transition-colors px-4 -mx-4 rounded-lg">
      <span className="text-cyan-500/60 font-mono text-[10px] mt-1 font-bold">[{year}]</span>
      <div className="space-y-1">
        <p className="text-[11px] font-mono text-cyan-100 uppercase tracking-wider group-hover:text-cyan-300 transition-colors">{authors}</p>
        <p className="text-[10px] font-mono text-slate-400 leading-relaxed uppercase tracking-widest">
          {title}. <span className="text-slate-300 italic font-bold">{journal}</span>
        </p>
      </div>
    </div>
  );
}

export default function MethodologyModule() {
  const [open, setOpen] = useState<string | null>("threshold");

  const sections = [
    {
      id: "threshold",
      title: "ERA5 Empirical Threshold",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            The heatwave threshold is derived from the{" "}
            <span className="text-cyan-300 font-bold">Open-Meteo ERA5 reanalysis archive</span>, which mirrors
            the ECMWF Copernicus Climate Data Store. No manual lookup tables are used — the threshold is an
            emergent, data-driven property of each coordinate's 30-year climatology.
          </p>
          <div className="bg-[#02050a]/80 border border-cyan-500/20 p-4 rounded-lg font-mono text-[10px] text-cyan-400 break-all leading-tight shadow-inner">
            GET https://archive-api.open-meteo.com/v1/archive?latitude=&#123;lat&#125;&longitude=&#123;lng&#125;&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_max&timezone=auto
          </div>
          <p>
            The engine computes the <span className="text-cyan-300 font-bold">95th percentile (P95)</span> from
            ~10,950 daily Tmax observations across the WMO standard 1991–2020 climate normal period.
            This establishes the local physiological adaptation threshold — the temperature above which
            excess heat mortality risk begins.
          </p>
          <Formula
            label="Heatwave Threshold"
            formula={"T_threshold = P95(ERA5 Tmax, 1991–2020)"}
            note="ERA5 is a physics-constrained global reanalysis derived from satellite, in-situ, and numerical model assimilation. Resolution: ~31km grid."
          />
          <p>
            Additionally, the engine computes the <span className="text-cyan-300 font-bold">WMO Tx5d index</span> —
            the mean temperature of the hottest consecutive 5-day block — as the primary extreme heat metric,
            consistent with WMO ETCCDI standards.
          </p>
        </div>
      ),
    },
    {
      id: "cmip6",
      title: "CMIP6 Future Projections",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Near-term projections (2015–2050) use <span className="text-cyan-300 font-bold">real CMIP6 model output</span>{" "}
            fetched live from the Open-Meteo Climate API. A 3-model ensemble is used with equal-weight averaging,
            consistent with IPCC AR6 methodology.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
            {[
              { model: "MRI-AGCM3-2-S", org: "MRI Japan", res: "20km" },
              { model: "NICAM16-8S", org: "NICAM Japan", res: "High-res" },
              { model: "MPI-ESM1-2-XR", org: "MPI Germany", res: "~50km" },
            ].map((m) => (
              <div key={m.model} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg">
                <p className="text-cyan-300 font-bold text-[10px] tracking-widest mb-1">{m.model}</p>
                <p className="text-slate-500 text-[9px] tracking-widest">{m.org} · {m.res}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            {[
              { year: "2030", method: "CMIP6 Live Ensemble", color: "text-cyan-400", note: "3-model mean" },
              { year: "2050", method: "CMIP6 Live Ensemble", color: "text-cyan-400", note: "3-model mean" },
              { year: "2075", method: "IPCC AR6 Delta", color: "text-purple-400", note: "Published rates" },
              { year: "2100", method: "IPCC AR6 Delta", color: "text-purple-400", note: "Published rates" },
            ].map((r) => (
              <div key={r.year} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg flex items-center justify-between">
                <span className="text-white font-bold text-lg">{r.year}</span>
                <div className="text-right">
                  <span className={`text-[9px] ${r.color} tracking-widest font-bold block`}>{r.method}</span>
                  <span className="text-[8px] text-slate-600 tracking-widest">{r.note}</span>
                </div>
              </div>
            ))}
          </div>

          <p>
            For 2075 and 2100, the engine applies{" "}
            <span className="text-cyan-300 font-bold">IPCC AR6 WG1 published regional warming deltas</span>{" "}
            (Chapter 4, Table 4.5 and Chapter 11, Table 11.1) to the ERA5-anchored 2050 baseline.
            This is the standard methodology used by institutional climate risk platforms.
          </p>

          <Formula
            label="Post-2050 Projection (IPCC AR6 Delta Method)"
            formula={"V(t) = V_ERA5_baseline + IPCC_AR6_delta(ssp, t)"}
            note={
              <div className="space-y-1">
                <div><span className="text-cyan-400">V_ERA5_baseline</span> = ERA5 Tx5d / heatwave days (1991-2020 real data)</div>
                <div><span className="text-cyan-400">IPCC_AR6_delta</span> = published warming rate for SSP scenario and region</div>
                <div className="text-slate-500 mt-2">Source: IPCC AR6 WG1 Ch.4 Table 4.5, Ch.11 Table 11.1 (South/SE Asia regional)</div>
              </div>
            }
          />

          <p>
            A <span className="text-cyan-300 font-bold">±4-year rolling window</span> is applied around each
            target year to reduce inter-annual variability in CMIP6 output, consistent with WMO decadal
            averaging methodology.
          </p>
        </div>
      ),
    },
    {
      id: "regional",
      title: "Regional Climate Calibration",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Raw CMIP6 output is calibrated by climate zone to reflect physical reality.
            Global climate models operate at coarse resolution and require regional downscaling.
            Our calibration uses <span className="text-cyan-300 font-bold">Koppen-Geiger classification</span> and
            IPCC AR6 WG1 regional chapter constraints.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-mono border-collapse mt-4">
              <thead>
                <tr className="border-b border-cyan-500/20">
                  <th className="text-left text-cyan-300 tracking-widest py-3 pr-4">Region</th>
                  <th className="text-left text-cyan-300 tracking-widest py-3 pr-4">Examples</th>
                  <th className="text-left text-cyan-300 tracking-widest py-3 pr-4">HW Cap</th>
                  <th className="text-left text-cyan-300 tracking-widest py-3 pr-4">Temp Cap</th>
                  <th className="text-left text-cyan-300 tracking-widest py-3">Key Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {[
                  { r: "Equatorial (<15°)", ex: "Singapore, Jakarta", hw: "45d", t: "40°C", adj: "Wet-bulb risk days + humidity scaling" },
                  { r: "Tropical (15-25°)", ex: "Mumbai, Bangkok", hw: "120d", t: "48°C", adj: "Humidity penalty above 60% RH" },
                  { r: "South Asian Belt (25-35°)", ex: "Delhi, Karachi, Kolkata", hw: "150d", t: "50°C", adj: "Dense UHI cap 8°C" },
                  { r: "Temperate (35-60°)", ex: "Paris, Berlin, NYC", hw: "50d", t: "44°C", adj: "Ocean dampening if coastal" },
                  { r: "Cold Continental (>60°)", ex: "Helsinki, Yakutsk", hw: "20d", t: "38°C", adj: "Snow albedo feedback -30%" },
                ].map((row) => (
                  <tr key={row.r} className="hover:bg-cyan-900/10 transition-colors">
                    <td className="text-slate-300 py-3 pr-4">{row.r}</td>
                    <td className="text-slate-500 py-3 pr-4">{row.ex}</td>
                    <td className="text-emerald-400 py-3 pr-4">{row.hw}</td>
                    <td className="text-orange-400 py-3 pr-4">{row.t}</td>
                    <td className="text-slate-400 py-3">{row.adj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[9px] text-slate-500 mt-4">
            Coastal dampening (−20 to −35%) applied when coordinates are within major ocean-moderated climate zones.
            UHI intensity capped at 8°C maximum (Oke 1982, Santamouris 2015).
          </p>
        </div>
      ),
    },
    {
      id: "mortality",
      title: "Attributable Deaths (WHO-GBD)",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Heat mortality is estimated using the{" "}
            <span className="text-cyan-300 font-bold">Gasparrini et al. (2017) Lancet Planetary Health</span>{" "}
            dose-response framework — the standard methodology in GBD heat-mortality literature.
          </p>

          <Formula
            label="Gasparrini (2017) Attributable Deaths"
            formula={"Deaths = Pop × (DR/1000) × (HW/365) × AF × V"}
            note={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div><span className="text-cyan-400">Pop</span> = GeoNames metro population</div>
                <div><span className="text-cyan-400">DR</span> = World Bank crude death rate per 1000</div>
                <div><span className="text-cyan-400">HW</span> = calibrated annual heatwave days</div>
                <div><span className="text-cyan-400">AF</span> = (RR−1)/RR, where RR = exp(0.0801 × ΔT)</div>
                <div><span className="text-cyan-400">V</span> = vulnerability multiplier (AC + age + healthcare)</div>
                <div><span className="text-cyan-400">β = 0.0801</span> = GBD meta-analysis global mean</div>
              </div>
            }
          />

          <p>
            The <span className="text-cyan-300 font-bold">vulnerability multiplier (V)</span> adjusts for
            population adaptive capacity using three World Bank indicators fetched live:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {[
              { label: "AC Penetration Proxy", source: "World Bank GDP/capita (NY.GDP.PCAP.CD)", note: "IEA (2023) cooling report correlation" },
              { label: "Age Vulnerability", source: "World Bank age structure (SP.POP.0014 + SP.POP.65UP)", note: "Gasparrini (2017) elderly 3-5x risk" },
              { label: "Healthcare Access", source: "World Bank physicians/1000 (SH.MED.PHYS.ZS)", note: "WHO Global Health Observatory" },
            ].map((item) => (
              <div key={item.label} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg">
                <p className="text-cyan-300 font-bold text-[10px] tracking-widest mb-2">{item.label}</p>
                <p className="text-slate-400 text-[9px] tracking-widest mb-1">{item.source}</p>
                <p className="text-slate-600 text-[8px] tracking-widest">{item.note}</p>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-slate-500">
            Vulnerability multiplier range: 0.25 (high AC + young + excellent healthcare) to 2.5 (minimal AC + aging + weak healthcare).
            95% confidence interval: ±15% of point estimate.
          </p>
        </div>
      ),
    },
    {
      id: "economics",
      title: "Economic Decay Model",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Economic losses combine two published methodologies:
            <span className="text-cyan-300 font-bold"> Burke et al. (2018) Nature</span> temperature-GDP
            non-linear relationship and{" "}
            <span className="text-cyan-300 font-bold">ILO (2019) labor productivity</span> heat stress model.
          </p>

          <Formula
            label="Burke (2018) + ILO (2019) Combined Loss"
            formula={"Loss = GDP × (Burke_penalty + ILO_fraction)"}
            note={
              <div className="space-y-1">
                <div><span className="text-cyan-400">Burke_penalty</span> = 0.0127 × (T_mean − 13°C)² / 100</div>
                <div><span className="text-cyan-400">ILO_fraction</span> = (HW_days/365) × 0.40 × 0.20</div>
                <div><span className="text-cyan-400">T_optimal</span> = 13°C (Burke 2018 global regression optimum)</div>
                <div><span className="text-cyan-400">0.40</span> = fraction of workforce in heat-exposed sectors (ILO)</div>
                <div><span className="text-cyan-400">0.20</span> = productivity loss per heatwave day (ILO weighted)</div>
                <div className="text-slate-500 mt-2">City GDP: GeoNames metro population × World Bank GDP/capita × urban productivity ratio</div>
              </div>
            }
          />

          <p>
            The urban productivity ratio scales national GDP/capita to city-level using
            <span className="text-cyan-300 font-bold"> World Bank Competitive Cities (2023)</span> agglomeration
            premiums: 1.8x (high income) to 7.0x (low income primate cities).
          </p>
        </div>
      ),
    },
    {
      id: "wetbulb",
      title: "Wet-Bulb Temperature & Survivability",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Wet-bulb temperature (WBT) is computed using the{" "}
            <span className="text-cyan-300 font-bold">Stull (2011)</span> empirical formula,
            with real relative humidity fetched from the{" "}
            <span className="text-cyan-300 font-bold">Open-Meteo Forecast API</span> at query time.
          </p>

          <Formula
            label="Stull (2011) Wet-Bulb Formula"
            formula={"WBT = T·atan(0.151977·√(RH+8.31)) + atan(T+RH) − atan(RH−1.68) + 0.00392·RH^1.5·atan(0.023·RH) − 4.686"}
            note="Accuracy: ±0.65°C for RH ∈ [5%, 99%], T ∈ [−20°C, 50°C]. Source: Stull (2011), Journal of Applied Meteorology and Climatology."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {[
              { range: "WBT < 28°C", label: "Stable", color: "text-emerald-400", desc: "Normal outdoor activity possible" },
              { range: "28–31°C", label: "Danger", color: "text-orange-400", desc: "Elderly and vulnerable at risk" },
              { range: "WBT ≥ 31°C", label: "Critical", color: "text-red-400", desc: "Human survivability limit — outdoor labor becomes fatal within hours" },
            ].map((s) => (
              <div key={s.range} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg">
                <p className={`${s.color} font-bold text-[10px] tracking-widest mb-1`}>{s.label}</p>
                <p className="text-slate-300 text-[9px] tracking-widest mb-2">{s.range}</p>
                <p className="text-slate-500 text-[8px] tracking-widest">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-slate-500">
            WBT ≥ 35°C is considered the theoretical absolute limit of human thermoregulation (Sherwood & Huber 2010, PNAS).
            Values above 31°C are consistent with IPCC AR6 projections for South Asian cities under SSP5-8.5.
          </p>
        </div>
      ),
    },
    {
      id: "mitigation",
      title: "Mitigation Offsets",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Two urban cooling interventions are modelled, with coefficients derived from peer-reviewed urban
            climate literature:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="p-6 bg-[#050b14]/80 border border-emerald-500/30 rounded-xl">
              <p className="text-emerald-400 font-bold mb-3 tracking-[0.3em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Canopy Cover
              </p>
              <p className="text-white font-serif text-lg tracking-wider mb-3">ΔT = (% / 100) × 1.2°C</p>
              <p className="text-slate-500 text-[9px] tracking-widest">
                Source: Bowler et al. (2010) — urban greening reduces local Tmax by 0.5–2.0°C per 10% canopy increase.
              </p>
            </div>
            <div className="p-6 bg-[#050b14]/80 border border-sky-500/30 rounded-xl">
              <p className="text-sky-400 font-bold mb-3 tracking-[0.3em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" /> Cool / Reflective Roofs
              </p>
              <p className="text-white font-serif text-lg tracking-wider mb-3">ΔT = (% / 100) × 0.8°C</p>
              <p className="text-slate-500 text-[9px] tracking-widest">
                Source: Santamouris (2015) — high-albedo surfaces reduce urban Tmax by 0.3–1.0°C per 10% coverage.
              </p>
            </div>
          </div>

          <p>
            Mitigation reduces both <span className="text-cyan-300 font-bold">peak Tx5d temperature</span> and
            <span className="text-cyan-300 font-bold"> annual heatwave days</span> (−3.5 days per 1°C cooling),
            which propagates through mortality and economic loss calculations.
          </p>
        </div>
      ),
    },
    {
      id: "data",
      title: "Data Sources & APIs",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>All data is fetched live at query time. No static datasets or cached national averages are used.</p>

          <div className="space-y-3 mt-4">
            {[
              { api: "Open-Meteo ERA5 Archive",    url: "archive-api.open-meteo.com", use: "Historical baseline (1991-2020)" },
              { api: "Open-Meteo Climate (CMIP6)", url: "climate-api.open-meteo.com", use: "Future projections (2015-2050)" },
              { api: "Open-Meteo Forecast",        url: "api.open-meteo.com",         use: "Real-time humidity for wet-bulb" },
              { api: "World Bank API",             url: "api.worldbank.org/v2",        use: "GDP, death rate, age, healthcare, urban share" },
              { api: "GeoNames API",               url: "api.geonames.org",            use: "City population + country code" },
            ].map((d) => (
              <div key={d.api} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-cyan-300 font-bold text-[10px] tracking-widest">{d.api}</p>
                  <p className="text-slate-500 text-[9px] tracking-widest mt-1">{d.url}</p>
                </div>
                <p className="text-slate-400 text-[9px] tracking-widest text-right">{d.use}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "limitations",
      title: "Limitations & Uncertainty",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            OpenPlanet provides <span className="text-cyan-300 font-bold">research-grade estimates</span> for
            analytical and exploratory purposes. The following limitations apply:
          </p>

          <div className="space-y-3 mt-4">
            {[
              {
                label: "Post-2050 Projections",
                text: "2075 and 2100 values use IPCC AR6 published regional delta rates applied to ERA5 baselines. These are not direct CMIP6 model outputs.",
                severity: "amber",
              },
              {
                label: "City GDP Estimates",
                text: "City-level GDP is estimated from national GDP/capita (World Bank) × metro population (GeoNames) × urban productivity ratio. No API provides direct city-level GDP for all cities globally.",
                severity: "amber",
              },
              {
                label: "Mortality Confidence Interval",
                text: "Death estimates carry ±15% uncertainty from the Gasparrini (2017) beta coefficient. Local age structure and healthcare quality further affect precision.",
                severity: "amber",
              },
              {
                label: "Spatial Resolution",
                text: "ERA5 resolution is ~31km, CMIP6 models 20-50km. Sub-city microclimatic variation (street canyons, parks) is not captured.",
                severity: "info",
              },
              {
                label: "Outputs are Projections, Not Forecasts",
                text: "All values represent plausible futures under stated SSP scenarios — not deterministic predictions. Actual outcomes depend on future emissions trajectories, adaptation measures, and social factors not modelled here.",
                severity: "info",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`border rounded-lg p-4 ${
                  item.severity === "amber"
                    ? "border-amber-500/20 bg-amber-950/10"
                    : "border-cyan-500/10 bg-[#050b14]/60"
                }`}
              >
                <p className={`font-bold text-[10px] tracking-widest mb-2 ${item.severity === "amber" ? "text-amber-400" : "text-cyan-400"}`}>
                  {item.label}
                </p>
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
          <Ref authors="Bowler D.E. et al." year={2010} title="Urban greening to cool towns and cities: A systematic review of the empirical evidence" journal="Landscape and Urban Planning" />
          <Ref authors="Santamouris M." year={2015} title="Analyzing the heat island magnitude and characteristics in urban areas" journal="Energy and Buildings" />
          <Ref authors="Sherwood S.C. & Huber M." year={2010} title="An adaptability limit to climate change due to heat stress" journal="PNAS" />
          <Ref authors="IPCC AR6 WG1" year={2021} title="Climate Change 2021: The Physical Science Basis — Chapter 4 & Chapter 11" journal="Cambridge University Press" />
          <Ref authors="World Bank" year={2023} title="Competitive Cities for Jobs and Growth" journal="World Bank Group" />
          <Ref authors="IEA" year={2023} title="The Future of Cooling — Opportunities for Energy-Efficient Air Conditioning" journal="International Energy Agency" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 flex flex-col min-h-full pb-12 relative z-10">

      {/* Header */}
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 p-10 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/10 blur-[120px] pointer-events-none" />
        <h2 className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
          <span className="w-2 h-2 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_8px_#22d3ee]" />
          Scientific Protocol & Methodology
        </h2>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-[0.2em] leading-loose max-w-3xl">
          Documentation of data pipelines, calibration methodology, and peer-reviewed empirical constants
          used by the OpenPlanet climate risk engine.
        </p>
      </div>

      {/* Accordion */}
      <div className="space-y-4 flex-grow">
        {sections.map((s) => (
          <div
            key={s.id}
            className="bg-[#02050a]/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden group shadow-lg transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
          >
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="w-full flex items-center justify-between px-8 py-6 text-left transition-all hover:bg-cyan-900/10"
            >
              <span className={`text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-colors ${open === s.id ? "text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-slate-300"}`}>
                {s.title}
              </span>
              <span className={`text-cyan-500 transition-transform duration-500 ${open === s.id ? "rotate-180 text-cyan-300" : ""}`}>
                ▼
              </span>
            </button>

            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${open === s.id ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
              <div className="px-8 pb-8 pt-2 border-t border-cyan-500/10 bg-[#050b14]/30">
                {s.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}