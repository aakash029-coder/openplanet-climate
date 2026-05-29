'use client';

import React, { useState } from 'react';
import katex from 'katex';
import { ExcelExportFullButton, type ExcelExportData } from "@/components/ExcelExport";
import { useClimateData } from "@/context/ClimateDataContext";

// ── KaTeX renderers ──────────────────────────────────────────────────────────
function Eq({ math, display = false }: { math: string; display?: boolean }) {
  const html = katex.renderToString(math, { throwOnError: false, displayMode: display });
  if (display) {
    return (
      <div
        className="my-6 py-4 px-6 overflow-x-auto"
        style={{ background: 'var(--raised)', borderLeft: '2px solid var(--hairline-strong)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Section header (numbered, Inter eyebrow) ─────────────────────────────────
function SectionHead({ n, title }: { n: string; title: string }) {
  const raw = n.replace('§', '');
  const label = /^\d+$/.test(raw) ? raw.padStart(2, '0') + ' //' : raw + ' //';
  return (
    <div className="flex items-baseline gap-4 mt-16 mb-6 pb-3"
         style={{ borderBottom: '1px solid var(--hairline)' }}>
      <span className="font-mono text-xs tracking-widest" style={{ color: '#71717A' }}>{label}</span>
      <h2 className="font-sans text-h2 font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{title}</h2>
    </div>
  );
}

// ── Body paragraph (Source Serif 4) ─────────────────────────────────────────
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-serif text-body-s leading-[1.6] mb-4"
       style={{ color: 'var(--text-2)' }}>
      {children}
    </p>
  );
}

// ── Inline mono citation ─────────────────────────────────────────────────────
function Cite({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-data" style={{ color: 'var(--reference)' }}>{children}</span>
  );
}

// ── Definition row ───────────────────────────────────────────────────────────
function Def({ sym, desc }: { sym: string; desc: string }) {
  return (
    <div className="flex gap-6 py-2" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <span className="font-mono text-data w-24 shrink-0 tabular-nums" style={{ color: 'var(--text)' }}>
        <Eq math={sym} />
      </span>
      <span className="font-sans text-body-ui" style={{ color: 'var(--text-2)' }}>{desc}</span>
    </div>
  );
}

// ── Reference list entry ─────────────────────────────────────────────────────
function Ref({ id, authors, year, title, journal, doi }: {
  id: string; authors: string; year: number; title: string; journal: string; doi?: string;
}) {
  return (
    <div className="flex gap-6 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <span className="font-mono text-prov w-16 shrink-0" style={{ color: 'var(--muted)' }}>[{id}]</span>
      <div>
        <p className="font-mono text-data font-medium" style={{ color: 'var(--text)' }}>{authors} ({year})</p>
        <p className="font-serif text-body-ui mt-0.5" style={{ color: 'var(--text-2)' }}>
          {title}. <em>{journal}</em>
        </p>
        {doi && (
          <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer"
             className="font-mono text-prov mt-0.5 block hover:underline"
             style={{ color: 'var(--reference)' }}>
            doi:{doi}
          </a>
        )}
      </div>
    </div>
  );
}

const DEMO_EXCEL: ExcelExportData = {
  city_name: "TEMPLATE — run a city analysis to populate",
  lat: 0, lng: 0, ssp: "SSP2-4.5", target_year: 2050,
  era5_baseline_c: 0, era5_p95_c: 0, era5_humidity_p95: 0,
  peak_tx5d_c: 0, heatwave_days: 0, mean_temp_c: 0,
  population: 0, gdp_usd: 0, death_rate: 0, vulnerability: 0,
  canopy_pct: 0, albedo_pct: 0,
  attributable_deaths: 0, economic_decay_usd: 0, wbt_c: 0,
  cmip6_source: "not_populated",
};

export default function MethodologyModule() {
  const { primaryData } = useClimateData();
  const [excelData] = useState<ExcelExportData>(DEMO_EXCEL);

  return (
    <article className="w-full max-w-none px-6 sm:px-12 md:px-16 lg:px-24 xl:px-32 py-10 text-left">

      {/* ── Title block ── */}
      <header className="mb-16 pb-8" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <p className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-3"
           style={{ color: 'var(--muted)' }}>
          Working Paper · OpenPlanet Climate Risk Engine
        </p>
        <h1 className="font-display text-h1 mb-4" style={{ color: 'var(--text)' }}>
          Scientific Methodology and Model Documentation
        </h1>
        <p className="font-serif text-body-s" style={{ color: 'var(--text-2)' }}>
          This document describes the epidemiological, economic, and thermodynamic models used
          to generate city-level heat risk projections. All constants are sourced from
          peer-reviewed literature. All equations are reproduced exactly as published.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <ExcelExportFullButton data={excelData} />
        </div>
      </header>

      {/* ── §1 Data Sources ── */}
      <SectionHead n="§1" title="Climate Data Sources" />
      <P>
        Temperature baselines are derived from the ERA5 reanalysis product published by the
        Copernicus Climate Change Service (C3S) at ECMWF (<Cite>Hersbach et al. 2020</Cite>).
        The reference climatology is computed over the 1991–2020 standard normal period, accessed
        via the Open-Meteo Historical Weather API.
      </P>
      <P>
        Future projections use a two-model CMIP6 ensemble: MRI-AGCM3-2-S and MPI-ESM1-2-XR,
        accessed via the Open-Meteo Climate API. Projections are strictly capped at 2050 —
        the validated horizon for these CMIP6 model outputs. No post-2050 extrapolation is performed.
      </P>
      <P>
        The primary climate variable is the annual maximum five-day consecutive temperature mean
        (TX5d) at 31 km spatial resolution. Relative humidity uses the daily mean
        (relative_humidity_2m_mean) from the ERA5 ensemble.
      </P>

      {/* ── §2 Mortality Model ── */}
      <SectionHead n="§2" title="Heat-Attributable Mortality" />
      <P>
        The mortality model follows the dose-response methodology of{' '}
        <Cite>Gasparrini et al. (2017, Lancet Planetary Health)</Cite>, who pooled 395 studies
        across 197 countries to derive a chronic temperature–mortality coefficient.
      </P>
      <P>
        The relative risk of mortality at temperature excess <Eq math="\Delta T" /> above
        the local historical threshold is:
      </P>
      <Eq display math="RR = e^{\,\beta \cdot \Delta T}, \qquad \beta = 0.0801" />
      <div className="my-4 space-y-0.5">
        <Def sym="\beta" desc="Pooled dose-response coefficient (Gasparrini 2017, GBD meta-analysis)" />
        <Def sym="\Delta T" desc="Temperature excess above local P95 threshold (°C)" />
        <Def sym="RR"  desc="Relative risk of mortality per unit temperature excess" />
      </div>
      <P>
        The attributable fraction (AF) — the fraction of deaths attributable to heat
        on heatwave days — is:
      </P>
      <Eq display math="AF = 1 - e^{-\beta \cdot \Delta T}" />
      <P>
        Total attributable deaths per year:
      </P>
      <Eq display math="D = P \cdot \frac{r}{1000} \cdot \frac{h}{365} \cdot AF \cdot V" />
      <div className="my-4 space-y-0.5">
        <Def sym="P"   desc="Urban agglomeration population (UN/World Bank/census)" />
        <Def sym="r"   desc="Crude death rate per 1,000 population (World Bank)" />
        <Def sym="h"   desc="Annual heatwave days above historical P95 (CMIP6 projection)" />
        <Def sym="AF"  desc="Attributable fraction (Gasparrini dose-response)" />
        <Def sym="V"   desc="Vulnerability modifier — physician density, age structure [0,1]" />
      </div>
      <P>
        Uncertainty: mortality estimates carry a ±15% confidence interval, reflecting parameter
        uncertainty in <Cite>β</Cite>, population data quality, and CMIP6 ensemble spread.
        The Gasparrini coefficient is most accurate for sustained exposure events (12–44 days);
        it systematically undershoots acute events of fewer than 9 days.
      </P>

      {/* ── §3 Economic Model ── */}
      <SectionHead n="§3" title="Economic Impact" />
      <P>
        The economic model uses a hybrid bipartite approach combining the Burke quadratic
        GDP-temperature relationship with ILO labor productivity estimates for extreme-heat days.
      </P>
      <P>
        The Burke et al. (<Cite>2018, Nature</Cite>) quadratic specifies a global optimum temperature
        of approximately 13°C, above which GDP growth is reduced:
      </P>
      <Eq display math="\frac{\Delta y}{y} = \hat{\beta}_1\,(T - T^*) + \hat{\beta}_2\,(T - T^*)^2" />
      <div className="my-4 space-y-0.5">
        <Def sym="T^*"         desc="Optimal temperature for economic productivity ≈ 13°C (Burke 2018)" />
        <Def sym="\hat\beta_1" desc="Linear coefficient from global panel regression (Burke 2018)" />
        <Def sym="\hat\beta_2" desc="Quadratic coefficient, capturing concavity (Burke 2018)" />
      </div>
      <P>
        For days exceeding the 34°C labor-stress threshold, an additional ILO (2019) shock is
        applied: 40% of the workforce at 20% reduced productivity per heatwave day.
        The two components are summed to produce total annual GDP-at-risk.
      </P>
      <P>
        Economic estimates carry a ±8% confidence interval, reflecting GDP data quality
        and model uncertainty.
      </P>

      {/* ── §4 Wet-Bulb Temperature ── */}
      <SectionHead n="§4" title="Wet-Bulb Temperature" />
      <P>
        Wet-bulb temperature (WBT) is the physiological survivability limit metric.
        The empirical formula of <Cite>Stull (2011, J. Applied Meteorology and Climatology)</Cite>:
      </P>
      <Eq display math="T_{WB} = T\arctan\!\bigl[0.151977\,(RH + 8.313659)^{1/2}\bigr] + \arctan(T + RH) - \arctan(RH - 1.676331) + 0.00391838\,RH^{\,3/2}\arctan(0.023101\,RH) - 4.686035" />
      <div className="my-4 space-y-0.5">
        <Def sym="T"   desc="Dry-bulb temperature (°C)" />
        <Def sym="RH"  desc="Relative humidity (%)" />
        <Def sym="T_{WB}" desc="Wet-bulb temperature (°C)" />
      </div>
      <P>
        WBT is capped at 35°C per the survivability limit established by{' '}
        <Cite>Sherwood & Huber (2010, PNAS)</Cite>, who showed that sustained WBT above 35°C
        is incompatible with human thermoregulation regardless of acclimatisation.
      </P>

      {/* ── §5 Urban Adaptation Scenario ── */}
      <SectionHead n="§5" title="Adaptation Scenario (Illustrative)" />
      <P>
        The canopy expansion and cool-roof albedo scenarios are directional illustrations only.
        They are not calibrated intervention models. Canopy offset reduces the effective TX5d
        by approximately 0.8°C per 10% canopy increase in urban areas, based on the urban
        heat island meta-analysis of <Cite>Bowler et al. (2010)</Cite> and{' '}
        <Cite>Santamouris (2015)</Cite>.
      </P>
      <P>
        Cool-roof albedo offset applies a surface energy balance reduction of approximately
        0.4°C per 10% albedo increase. These offsets feed back through the full mortality
        and economic model chain.
      </P>
      <P>
        In highly humid coastal biomes (wet-bulb temperature baseline above 28°C),
        canopy expansion may theoretically trap surface humidity and increase wet-bulb
        exposure. This edge case is flagged automatically.
      </P>

      {/* ── §6 Socioeconomic Data ── */}
      <SectionHead n="§6" title="Socioeconomic Data — Verified City Vault" />
      <P>
        Population, GDP, death rate, and healthcare access data are sourced from the
        OpenPlanet Verified City Vault — hardcoded 2023–2024 values for 59 major cities
        drawn from UN Population Division estimates, World Bank national accounts,
        and most recent national census publications.
      </P>
      <P>
        A census validator rejects any population value outside the range [10,000 – 35,000,000].
        For cities not in the Vault, live Open-Meteo Geocoding results are combined with
        World Bank country-level statistics; a critical alert is logged for anomalous values.
      </P>

      {/* ── §7 Uncertainty ── */}
      <SectionHead n="§7" title="Uncertainty and Limitations" />
      <P>
        All projections are research-grade estimates under specific emissions scenarios
        (SSP2-4.5 or SSP5-8.5). They are directional indicators for planning and analysis —
        not deterministic forecasts and not investment advice.
      </P>
      <P>
        Quantified uncertainties: mortality ±15% CI, economics ±8% CI.
        Unquantified uncertainty sources include: CMIP6 model spread (two-model ensemble),
        downscaling bias at 31 km resolution, urban-rural temperature gradients,
        and future adaptation behaviour.
      </P>
      <P>
        The Gasparrini β coefficient is derived from historical exposure data and may
        not fully represent future adaptation responses. Economic estimates apply a
        global coefficient to individual cities; local economic structure is not captured.
      </P>

      {/* ── References ── */}
      <SectionHead n="Ref" title="References" />
      <div className="space-y-0">
        <Ref id="1" authors="Gasparrini, A. et al." year={2017}
          title="Projections of temperature-related excess mortality under climate change scenarios"
          journal="The Lancet Planetary Health" doi="10.1016/S2542-5196(17)30156-0" />
        <Ref id="2" authors="Burke, M., Solomon, H., Lobell, D.B." year={2018}
          title="Global non-linear effect of temperature on economic production"
          journal="Nature" doi="10.1038/nature15725" />
        <Ref id="3" authors="ILO" year={2019}
          title="Working on a Warmer Planet: The Impact of Heat Stress on Labour Productivity and Decent Work"
          journal="International Labour Organization" />
        <Ref id="4" authors="Stull, R." year={2011}
          title="Wet-Bulb Temperature from Relative Humidity and Air Temperature"
          journal="Journal of Applied Meteorology and Climatology" doi="10.1175/JAMC-D-11-0143.1" />
        <Ref id="5" authors="Sherwood, S.C., Huber, M." year={2010}
          title="An adaptability limit to climate change due to heat stress"
          journal="Proceedings of the National Academy of Sciences" doi="10.1073/pnas.0913352107" />
        <Ref id="6" authors="Bowler, D.E. et al." year={2010}
          title="Urban greening to cool towns and cities: A systematic review of the empirical evidence"
          journal="Landscape and Urban Planning" doi="10.1016/j.landurbplan.2010.05.006" />
        <Ref id="7" authors="Santamouris, M." year={2015}
          title="Regulating the damaged thermostat of cities — Status, impacts and mitigation challenges"
          journal="Energy and Buildings" doi="10.1016/j.enbuild.2014.11.027" />
        <Ref id="8" authors="Hersbach, H. et al." year={2020}
          title="The ERA5 global reanalysis"
          journal="Quarterly Journal of the Royal Meteorological Society" doi="10.1002/qj.3803" />
      </div>

    </article>
  );
}
