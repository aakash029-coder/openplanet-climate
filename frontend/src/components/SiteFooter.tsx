import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer
      className="mt-auto relative z-50 py-12 md:py-14 px-5 md:px-10 lg:px-16"
      style={{ borderTop: '1px solid var(--hairline)', background: 'var(--panel)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(176,141,87,0.18) 30%, rgba(176,141,87,0.18) 70%, transparent 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex items-center gap-3.5 shrink-0">
            <img
              src="/logo.jpeg"
              alt="OpenPlanet"
              className="w-9 h-9 object-cover shrink-0"
              style={{ border: '1px solid var(--hairline)' }}
            />
            <div className="flex flex-col gap-1">
              <span
                className="text-sm font-sans font-semibold tracking-tight leading-none"
                style={{ color: 'var(--text)' }}
              >
                OpenPlanet
              </span>
              <span
                className="text-[8px] font-mono tracking-[0.25em] leading-none uppercase"
                style={{ color: 'var(--muted)' }}
              >
                Risk Intelligence
              </span>
              <div className="flex flex-col gap-1 mt-1.5">
                <a href="https://doi.org/10.5281/zenodo.19340991" target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 transition-colors duration-150 hover:text-white"
                   style={{ color: 'var(--reference)' }}>
                  <span className="font-mono text-[6px] uppercase tracking-widest px-1 py-0.5"
                        style={{ border: '1px solid rgba(176,141,87,0.25)', color: 'var(--copper)' }}>
                    Published
                  </span>
                  <span className="font-mono text-[7px] tracking-[0.1em]">Zenodo · DOI 10.5281/zenodo.19340991</span>
                </a>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-[6px] uppercase tracking-widest opacity-40" style={{ color: 'var(--reference)' }}>Listed on</span>
                  {[
                    { label: 'UNDRR', href: 'https://www.preventionweb.net/organization/openplanet-risk-intelligence' },
                    { label: 'CAKE', href: 'https://www.cakex.org/tools/openplanet-risk-intelligence' },
                    { label: 'ClimateBase', href: 'https://climatebase.org/company/1142537/openplanet-risk-intelligence' },
                  ].map(p => (
                    <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer"
                       className="font-mono text-[7px] uppercase tracking-[0.12em] transition-colors duration-150 hover:text-white"
                       style={{ color: 'var(--reference)' }}>
                      {p.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 text-[9px] uppercase tracking-[0.25em] font-mono" style={{ color: 'var(--muted)' }}>
            <Link href="/privacy" className="hover:text-white transition-colors duration-150">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors duration-150">
              Terms
            </Link>
            <Link href="/support" className="hover:text-white transition-colors duration-150">
              Support
            </Link>
            <a
              href="https://github.com/aakash029-coder/openplanet-climate"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors duration-150"
            >
              GitHub
            </a>
          </div>

          <a
            href="https://www.linkedin.com/company/openplanet-climate/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors duration-150 p-2 shrink-0"
            style={{ color: 'var(--muted)', border: '1px solid var(--hairline)' }}
            aria-label="OpenPlanet LinkedIn"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>

        <div className="divider-copper" />

        <p className="font-mono text-[10px] text-center leading-loose max-w-3xl mx-auto" style={{ color: 'var(--muted)' }}>
          DATA: Copernicus C3S (ERA5 · CMIP6) · MODELS: Gasparrini 2017, Burke 2018, Stull 2011 · OPEN SOURCE:
          GitHub · v2.0
        </p>
      </div>
    </footer>
  );
}
