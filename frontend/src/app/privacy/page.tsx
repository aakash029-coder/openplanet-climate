export const metadata = {
  title: 'Privacy Policy — OpenPlanet',
  description: 'Data handling practices for OpenPlanet Climate Risk Intelligence Platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--canvas)', color: 'var(--text)' }}>
      <main className="max-w-3xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="mb-12 pb-8" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--muted)' }}>
            Document Ref: OP-PRV-01 · Effective: March 2026
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="font-serif text-[0.9rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            OpenPlanet is an open-source educational instrument. It provides directional academic
            risk intelligence derived exclusively from public-domain scientific archives including
            Copernicus Climate Change Service (C3S / ECMWF) ERA5 reanalysis, CMIP6 model outputs,
            and peer-reviewed epidemiological literature. This policy governs how session data is
            handled while operating this platform.
          </p>
        </div>

        <div className="space-y-10 font-serif text-[0.875rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>1.0</span>
              Data Collection
            </h2>
            <p className="mb-3">
              To deliver climate risk intelligence, the platform collects the minimum data
              technically necessary to operate a session:
            </p>
            <ul className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--hairline)' }}>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Authentication tokens</strong> — cryptographic
                session markers issued by third-party identity providers (e.g. Google OAuth).
                No passwords are stored by OpenPlanet.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Geospatial query parameters</strong> — city names,
                coordinates, emissions scenario selection, and mitigation slider values entered during
                an analysis session.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Diagnostic telemetry</strong> — compute latency
                and API response times, aggregated and anonymised, used solely to maintain engine
                performance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>2.0</span>
              Data Sources and Attribution
            </h2>
            <p className="mb-3">
              All climate projections are derived from publicly accessible scientific archives.
              No proprietary or personally identifiable data is ingested into the analytical models.
              Primary data sources with full attribution:
            </p>
            <ul className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--hairline)' }}>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Copernicus C3S ERA5</strong> — ECMWF ERA5 global
                reanalysis (1991–2020 standard normal period). Hersbach et al. (2020),
                doi:10.1002/qj.3803.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>CMIP6 Ensemble</strong> — MRI-AGCM3-2-S and
                MPI-ESM1-2-XR projections. All outputs are strictly capped at 2050 — the validated
                horizon for these model outputs. Accessed via Open-Meteo Climate API.
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Socioeconomic data</strong> — UN Population
                Division, World Bank national accounts, and most recent national census publications.
                No user-derived data is used in model calculations.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>3.0</span>
              Non-Monetization and Confidentiality
            </h2>
            <p>
              OpenPlanet does not sell, lease, or share user query histories with third-party
              commercial entities or data brokers. Geographic areas of interest researched within
              a session are not broadcast, shared, or used for profiling. Query data is processed
              only to generate the requested scientific output and is not retained beyond technical
              necessity.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>4.0</span>
              Third-Party Infrastructure
            </h2>
            <p>
              The platform runs on Vercel edge infrastructure and uses Copernicus C3S / Open-Meteo
              APIs for scientific data retrieval. These providers operate under their own privacy
              frameworks. Data is shared with infrastructure providers strictly for the purpose of
              executing model computations and serving the user interface. No user data is shared
              beyond what is operationally required.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>5.0</span>
              User Rights
            </h2>
            <p>
              Users may terminate sessions, revoke OAuth tokens via their identity providers, and
              request deletion of account data. Requests should be directed to the project repository
              issue tracker. As an open-source educational project, OpenPlanet maintains no commercial
              user database; session state is stored locally in the browser via sessionStorage and
              localStorage only.
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
