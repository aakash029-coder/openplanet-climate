'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const linkClass = (path: string) =>
    pathname === path
      ? 'font-bold'
      : 'transition-colors duration-200'

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-12 lg:px-16 h-16 bg-[var(--canvas)]/95 backdrop-blur-xl border-b"
        style={{ transform: 'translate3d(0,0,0)', willChange: 'transform', borderBottomColor: 'var(--hairline)' }}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
          <div className="relative flex items-center justify-center w-8 h-8 overflow-hidden border border-white/[0.06]">
            <img src="/logo.jpeg" alt="OpenPlanet Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-sans font-semibold text-white tracking-tight leading-none">OpenPlanet</span>
            <span className="text-[8px] font-mono text-zinc-600 tracking-[0.25em] leading-none uppercase mt-0.5">Risk Intelligence</span>
          </div>
        </Link>

        {/* Center nav — desktop */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link href="/"         className={`text-[10px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/')}`}        style={{ color: pathname === '/'         ? 'var(--text)' : 'var(--text-2)' }}>Home</Link>
          <Link href="/discover" className={`text-[10px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/discover')}`} style={{ color: pathname === '/discover'   ? 'var(--text)' : 'var(--text-2)' }}>Discover</Link>
          <Link href="/about"    className={`text-[10px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/about')}`}    style={{ color: pathname === '/about'     ? 'var(--text)' : 'var(--text-2)' }}>About</Link>
        </div>

        {/* Right: auth + hamburger */}
        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3 bg-white/[0.02] px-4 py-1.5" style={{ border: '1px solid var(--hairline)' }}>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>
                {session.user?.name?.split(' ')[0] || 'OPERATOR'}
              </span>
              <div className="w-px h-3 bg-white/[0.08]" />
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-[9px] font-mono uppercase tracking-widest transition-colors hover:text-white" style={{ color: 'var(--muted)' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="px-4 py-2 text-[9px] font-mono font-bold tracking-[0.2em] uppercase bg-white/[0.02] hover:bg-white/[0.05] hover:text-white transition-all duration-150"
              style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)' }}
            >
              Sign In
            </button>
          )}

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            onClick={() => setMobileOpen(p => !p)}
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-[1px] bg-zinc-400 transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`block w-5 h-[1px] bg-zinc-400 transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-[1px] bg-zinc-400 transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[98] bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed top-16 left-0 right-0 z-[99] md:hidden border-b"
            style={{ transform: 'translate3d(0,0,0)', background: 'var(--canvas)', borderBottomColor: 'var(--hairline)' }}
          >
            <div className="flex flex-col px-6 py-5 gap-5">
              <Link href="/"         onClick={() => setMobileOpen(false)} className={`text-[11px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/')}`}        style={{ color: pathname === '/'       ? 'var(--text)' : 'var(--text-2)' }}>Home</Link>
              <Link href="/discover" onClick={() => setMobileOpen(false)} className={`text-[11px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/discover')}`} style={{ color: pathname === '/discover' ? 'var(--text)' : 'var(--text-2)' }}>Discover</Link>
              <Link href="/about"    onClick={() => setMobileOpen(false)} className={`text-[11px] font-mono font-bold uppercase tracking-[0.25em] ${linkClass('/about')}`}    style={{ color: pathname === '/about'   ? 'var(--text)' : 'var(--text-2)' }}>About</Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
