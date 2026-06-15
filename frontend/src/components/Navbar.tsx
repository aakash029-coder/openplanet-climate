'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) => pathname === path

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-5 md:px-10 lg:px-16 h-16 glass-nav border-b"
        style={{ borderBottomColor: 'var(--hairline)', transform: 'translate3d(0,0,0)' }}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group shrink-0" onClick={() => setMobileOpen(false)}>
          <div className="relative flex items-center justify-center w-8 h-8 overflow-hidden shrink-0"
               style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src="/logo.jpeg" alt="OpenPlanet Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-sans font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
              OpenPlanet
            </span>
            <span className="text-[8px] font-mono tracking-[0.25em] leading-none uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
              Risk Intelligence
            </span>
          </div>
        </Link>

        {/* Center nav — desktop */}
        <div className="hidden md:flex items-center gap-12 absolute left-1/2 -translate-x-1/2">
          {[
            { href: '/',         label: 'Home'     },
            { href: '/discover', label: 'Discover' },
            { href: '/about',    label: 'About'    },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="relative text-[11px] font-sans font-medium uppercase tracking-[0.18em] transition-colors duration-200 hover:text-white group"
              style={{ color: isActive(href) ? 'var(--text)' : 'var(--text-2)' }}
            >
              {label}
              <span
                className="absolute -bottom-1 left-0 right-0 h-px transition-all duration-200"
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--hairline-strong), transparent)',
                  opacity: isActive(href) ? 1 : 0,
                }}
              />
            </Link>
          ))}
        </div>

        {/* Right: auth + hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          {session ? (
            <div className="flex items-center gap-3 px-3.5 py-2 hidden md:flex"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>
                {session.user?.name?.split(' ')[0] || 'OPERATOR'}
              </span>
              <div className="w-px h-3" style={{ background: 'var(--hairline-strong)' }} />
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-[9px] font-mono uppercase tracking-widest transition-colors duration-150 hover:text-white"
                style={{ color: 'var(--muted)' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="hidden md:flex items-center px-4 py-2 text-[9px] font-mono font-bold tracking-[0.2em] uppercase transition-all duration-150 hover:text-white btn-primary"
              style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)', touchAction: 'manipulation' }}
            >
              Sign In
            </button>
          )}

          {/* Hamburger — 44×44 touch target */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-11 h-11 gap-[5px] rounded-sm transition-colors duration-150 hover:bg-white/[0.04]"
            onClick={() => setMobileOpen(p => !p)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            style={{ touchAction: 'manipulation' }}
          >
            <span className={`block w-5 h-[1.5px] rounded-full transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`}
                  style={{ background: 'var(--text-2)' }} />
            <span className={`block w-5 h-[1.5px] rounded-full transition-all duration-200 ${mobileOpen ? 'opacity-0 scale-x-0' : ''}`}
                  style={{ background: 'var(--text-2)' }} />
            <span className={`block w-5 h-[1.5px] rounded-full transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`}
                  style={{ background: 'var(--text-2)' }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[98] bg-black/70 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id="mobile-nav-menu"
            className="fixed top-16 left-0 right-0 z-[99] md:hidden border-b animate-fadeSlideDown glass-nav"
            style={{ borderBottomColor: 'var(--hairline)' }}
          >
            <div className="flex flex-col">
              {[
                { href: '/',         label: 'Home'     },
                { href: '/discover', label: 'Discover' },
                { href: '/about',    label: 'About'    },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-6 min-h-[52px] text-[12px] font-mono font-bold uppercase tracking-[0.25em] transition-colors duration-150"
                  style={{
                    color: isActive(href) ? 'var(--text)' : 'var(--text-2)',
                    borderBottom: '1px solid var(--hairline)',
                  }}
                >
                  {label}
                  {isActive(href) && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--positive)' }} />
                  )}
                </Link>
              ))}

              {/* Auth in mobile menu */}
              <div className="px-6 py-4">
                {session ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>
                      {session.user?.name?.split(' ')[0] || 'OPERATOR'}
                    </span>
                    <button
                      onClick={() => { signOut({ callbackUrl: '/' }); setMobileOpen(false); }}
                      className="text-[10px] font-mono uppercase tracking-widest px-3 py-2 transition-colors hover:text-white"
                      style={{ color: 'var(--muted)', border: '1px solid var(--hairline)' }}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { signIn('google'); setMobileOpen(false); }}
                    className="w-full flex items-center justify-center min-h-[44px] text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-all duration-150 hover:text-white btn-primary"
                    style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)', touchAction: 'manipulation' }}
                  >
                    Sign In with Google
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
