export const metadata = {
  title: 'Terms of Service — OpenPlanet',
  description: 'Terms governing use of OpenPlanet Climate Risk Intelligence Platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--canvas)', color: 'var(--text)' }}>
      <main className="max-w-3xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="mb-12 pb-8" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--muted)' }}>
            Document Ref: OP-TOS-01 · Effective: March 2026
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="font-serif text-[0.9rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            OpenPlanet is an open-source educational instrument that provides directional academic
            risk intelligence. All climate outputs are derived directly from Copernicus C3S ERA5
            reanalysis archives and CMIP6 ensemble data, processed through peer-reviewed
            epidemiological and economic models. By using this platform you accept the terms below.
          </p>
        </div>

        <div className="space-y-10 font-serif text-[0.875rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>1.0</span>
              Nature of the Service — Educational Risk Intelligence
            </h2>
            <p className="mb-3">
              OpenPlanet is a computational estimation engine, not a licensed advisory service.
              Outputs are research-grade directional indicators for academic, planning, and
              educational purposes. All projections are:
            </p>
            <ul className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--hairline)' }}>
              <li className="pl-4">Derived from publicly documented scientific models (Gasparrini 2017, Burke 2018, Stull 2011, Sherwood & Huber 2010) with all equations reproduced exactly as published.</li>
              <li className="pl-4">Sourced from Copernicus C3S ERA5 reanalysis and CMIP6 model outputs — open-access public-domain archives.</li>
              <li className="pl-4">Capped at the year 2050 — the validated horizon for the CMIP6 spatial outputs used. No post-2050 extrapolation is performed.</li>
              <li className="pl-4">Probabilistic estimates with explicitly stated confidence intervals (mortality ±15%, economics ±8%), not deterministic forecasts.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>2.0</span>
              Limitation of Liability
            </h2>
            <p className="mb-3">
              All projections are provided strictly for informational and research purposes.
            </p>
            <ul className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--hairline)' }}>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>No financial advice:</strong> Outputs do not
                constitute investment, legal, or financial advice. Independent due diligence is
                required before any capital allocation decisions.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>No operational reliance:</strong> This platform
                is not a real-time emergency alert system and must not be used as the sole basis for
                immediate life-safety operations or disaster response.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>No warranty:</strong> The provider does not
                warrant the absolute accuracy of underlying third-party datasets. Models are subject
                to scientific uncertainty and evolving methodological standards.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Liability cap:</strong> Under no circumstances
                shall the provider or contributors be liable for direct, indirect, or consequential
                losses arising from use of platform outputs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>3.0</span>
              Scientific Uncertainty and Data Provenance
            </h2>
            <p>
              The engine aggregates data from open-access global scientific archives. Primary data
              attribution: ERA5 reanalysis — Copernicus C3S / ECMWF (Hersbach et al. 2020);
              CMIP6 projections — World Climate Research Programme; socioeconomic data —
              UN Population Division, World Bank. Users accept that macro-environmental models
              carry inherent uncertainty arising from CMIP6 ensemble spread, 31 km spatial
              downscaling resolution, and future adaptation behaviour not captured in historical
              coefficient derivations.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>4.0</span>
              Open-Source Licence and Acceptable Use
            </h2>
            <p className="mb-3">
              OpenPlanet is an open-source project. The source code, model documentation, and
              analytical methodology are publicly available. Users are granted unrestricted
              access for educational, research, and non-commercial planning purposes. Commercial
              use of raw outputs in downstream products or services requires attribution to
              the original data sources (Copernicus C3S, CMIP6, cited peer-reviewed literature).
            </p>
            <p>
              Any attempt to artificially inflate simulation limits, bypass authentication
              gateways, or disrupt the spatial computing engine constitutes a violation of
              acceptable use and will result in immediate session termination.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>5.0</span>
              Analyst Summary Methodology
            </h2>
            <p>
              The "Analyst Summary" feature applies a large language model to synthesise
              publicly available geoscientific literature relevant to the queried location.
              Summaries represent rigorous statistical downscaling narrative based on the
              computed metrics — they are not speculative forecasts. All quantitative claims
              within analyst summaries are anchored to the engine's verified CMIP6 output
              and must be interpreted within the stated confidence intervals.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            OpenPlanet is an open-source project. Climate data © Copernicus Climate Change Service (C3S), ECMWF.
            CMIP6 data via World Climate Research Programme. All projections for academic and planning use only.
          </p>
        </div>

      </main>
    </div>
  );
}
