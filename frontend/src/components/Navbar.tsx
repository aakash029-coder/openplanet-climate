'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  // ✅ Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false)

  const getLinkStyle = (path: string) => {
    return pathname === path
      ? "text-cyan-400 font-extrabold drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]"
      : "text-slate-500 hover:text-slate-200 transition-all duration-300"
  }

  return (
    <>
      {/* ✅ FIX: GPU-accelerated navbar — scroll pe kabhi nahi hilega */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20 bg-[#050505]/40 backdrop-blur-2xl border-b border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.9)]"
        style={{
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-4 group" onClick={() => setMobileOpen(false)}>
          <div className="relative flex items-center justify-center w-10 h-10 overflow-hidden rounded-full border border-white/5 shadow-[0_0_15px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all duration-300">
            <img
              src="/logo.jpeg"
              alt="OpenPlanet Logo"
              className="w-full h-full object-cover scale-110"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-serif font-bold text-slate-200 tracking-[0.2em] leading-none mb-1 uppercase">OpenPlanet</span>
            <span className="text-[8px] font-mono text-cyan-700 tracking-[0.3em] leading-none uppercase">Risk Intelligence</span>
          </div>
        </Link>

        {/* Center Navigation — desktop only */}
        <div className="hidden md:flex items-center gap-12 absolute left-1/2 -translate-x-1/2">
          <Link href="/" className={`text-[10px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/')}`}>Home</Link>
          <Link href="/discover" className={`text-[10px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/discover')}`}>Discover</Link>
          <Link href="/about" className={`text-[10px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/about')}`}>About</Link>
        </div>

        {/* Right side: Auth + Mobile Hamburger */}
        <div className="flex items-center gap-4">

          {/* Auth — always visible */}
          {session ? (
            <div className="flex items-center gap-4 bg-black/60 border border-white/5 px-5 py-1.5 rounded-full shadow-inner backdrop-blur-md">
              <span className="text-[10px] font-mono text-amber-100/70 font-bold tracking-widest uppercase">
                {session.user?.name?.split(' ')[0] || 'OPERATOR'}
              </span>
              <div className="w-[1px] h-3 bg-white/10"></div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-[9px] font-mono text-slate-500 hover:text-red-500 uppercase tracking-widest transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="relative px-7 py-2 rounded-full text-[9px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase transition-all overflow-hidden group border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] bg-black/80 hover:border-cyan-400"
            >
              <div className="absolute inset-0 bg-cyan-950/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10">Sign In</span>
            </button>
          )}

          {/* ✅ Hamburger — mobile only */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 group"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-[1.5px] bg-slate-400 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[6px]' : ''}`}></span>
            <span className={`block w-5 h-[1.5px] bg-slate-400 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-5 h-[1.5px] bg-slate-400 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[6px]' : ''}`}></span>
          </button>

        </div>
      </nav>

      {/* ✅ Mobile Menu Dropdown — below navbar, GPU-layered */}
      {mobileOpen && (
        <>
          {/* Backdrop — click outside se band */}
          <div
            className="fixed inset-0 z-[98] bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Menu panel */}
          <div
            className="fixed top-20 left-0 right-0 z-[99] md:hidden bg-[#050814]/95 backdrop-blur-2xl border-b border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-top-2 duration-200"
            style={{ transform: 'translate3d(0, 0, 0)' }}
          >
            <div className="flex flex-col px-8 py-6 gap-6">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className={`text-[11px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/')}`}
              >
                Home
              </Link>
              <Link
                href="/discover"
                onClick={() => setMobileOpen(false)}
                className={`text-[11px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/discover')}`}
              >
                Discover
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileOpen(false)}
                className={`text-[11px] font-bold uppercase tracking-[0.3em] ${getLinkStyle('/about')}`}
              >
                About
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}