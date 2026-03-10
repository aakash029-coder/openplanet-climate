'use client'

import Link from 'next/link'
import { useSession, signOut, signIn } from 'next-auth/react'
import { usePathname } from 'next/navigation' 

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname() 

  const getLinkStyle = (path: string) => {
    return pathname === path 
      ? "text-cyan-400 font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" 
      : "text-slate-500 hover:text-slate-200 transition-colors";
  };

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20 bg-black/60 backdrop-blur-2xl border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
      
      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-4 group">
        <div className="relative flex items-center justify-center w-10 h-10 bg-black/50 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] overflow-hidden group-hover:border-cyan-500/50 transition-colors rounded-xl">
          <span className="relative text-white font-serif font-black text-sm tracking-tighter">OP</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-serif font-extrabold text-slate-200 tracking-wider leading-none mb-1 drop-shadow-md">OpenPlanet</span>
          <span className="text-[9px] font-mono text-cyan-600 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
        </div>
      </Link>

      {/* Center Navigation Links */}
      <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
        <Link href="/" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/')}`}>Home</Link>
        <Link href="/discover" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/discover')}`}>Discover</Link>
        <Link href="/about" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/about')}`}>About</Link>
      </div>

      {/* Extreme Right Auth Actions */}
      <div className="flex items-center gap-6">
        {session ? (
          
          <div className="flex items-center gap-5 bg-black/40 border border-white/5 px-5 py-2 rounded-full shadow-inner backdrop-blur-sm">
            <span className="text-[11px] font-mono text-amber-100/80 font-bold tracking-widest uppercase">
              {session.user?.name?.split(' ')[0] || 'OPERATOR'}
            </span>
            <div className="w-[1px] h-3 bg-white/10"></div>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className="text-[10px] font-mono text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Logout
            </button>
          </div>

        ) : (
          <div className="flex items-center">
            {/* BLACK GLOSSY SIGN IN BUTTON */}
            <button 
              onClick={() => signIn('google')} 
              className="relative px-8 py-2.5 rounded-full text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase transition-all overflow-hidden group border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] bg-black/50 hover:border-cyan-400"
            >
              <div className="absolute inset-0 bg-cyan-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10">Sign In</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}