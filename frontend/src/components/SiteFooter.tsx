import Link from 'next/link';

const NAV_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Dashboard',   href: '/dashboard' },
      { label: 'Methodology', href: '/methodology' },
      { label: 'About',       href: '/about' },
    ],
  },
  {
    heading: 'Research',
    links: [
      { label: 'Zenodo Publication', href: 'https://doi.org/10.5281/zenodo.19340991', external: true },
      { label: 'Source Code',        href: 'https://github.com/aakash029-coder/openplanet-climate', external: true },
      { label: 'UNDRR PreventionWeb', href: 'https://www.preventionweb.net/organization/openplanet-risk-intelligence', external: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms',   href: '/terms' },
      { label: 'Support', href: '/support' },
    ],
  },
] as const;

export default function SiteFooter() {
  return (
    <footer
      className="mt-auto relative z-50"
      style={{ borderTop: '1px solid var(--hairline)', background: 'var(--panel)' }}
    >
      {/* Copper rule */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(176,141,87,0.22) 35%, rgba(176,141,87,0.22) 65%, transparent 100%)' }}
      />

      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-5 md:px-10 lg:px-16 pt-12 pb-10 grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10 md:gap-8">

        {/* Brand column */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpeg"
              alt="OpenPlanet"
              className="w-8 h-8 object-cover shrink-0"
              style={{ border: '1px solid var(--hairline)' }}
            />
            <div>
              <p className="text-sm font-sans font-semibold tracking-tight leading-none mb-0.5" style={{ color: 'var(--text)' }}>
                OpenPlanet
              </p>
              <p className="text-[8px] font-mono tracking-[0.25em] uppercase leading-none" style={{ color: 'var(--muted)' }}>
                Risk Intelligence
              </p>
            </div>
          </div>

          <p className="font-sans text-[11px] leading-relaxed max-w-[220px]" style={{ color: 'var(--text-2)' }}>
            Research-grade heat risk projections for any city on Earth.
            ERA5 reanalysis + CMIP6 ensemble projections, every formula auditable.
          </p>

          {/* Social */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/openplanet-climate/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OpenPlanet LinkedIn"
              className="flex items-center justify-center w-8 h-8 transition-colors duration-150 hover:text-white"
              style={{ color: 'var(--muted)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </a>
            <a
              href="https://github.com/aakash029-coder/openplanet-climate"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OpenPlanet GitHub"
              className="flex items-center justify-center w-8 h-8 transition-colors duration-150 hover:text-white"
              style={{ color: 'var(--muted)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Nav columns */}
        {NAV_COLS.map(col => (
          <div key={col.heading} className="flex flex-col gap-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--muted)' }}>
              {col.heading}
            </p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map(link => (
                <li key={link.label}>
                  {'external' in link && link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-[11px] transition-colors duration-150 hover:text-white flex items-center gap-1.5 group"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {link.label}
                      <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-sans text-[11px] transition-colors duration-150 hover:text-white"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        className="max-w-7xl mx-auto px-5 md:px-10 lg:px-16 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        <p className="font-mono text-[8px] leading-loose" style={{ color: 'var(--muted)', opacity: 0.55 }}>
          Data: Copernicus C3S (ERA5 · CMIP6) · Models: Gasparrini 2017, Burke 2018, Stull 2011 · v2.0
        </p>
        <p className="font-mono text-[8px] shrink-0" style={{ color: 'var(--muted)', opacity: 0.4 }}>
          © 2025 OpenPlanet Risk Intelligence · Open Source
        </p>
      </div>
    </footer>
  );
}
