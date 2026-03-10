'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut, signIn } from 'next-auth/react' // 👈 signIn wapas import kiya
import { useState } from 'react'
import { usePathname } from 'next/navigation' 

export default function Navbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const pathname = usePathname() 

  const getLinkStyle = (path: string) => {
    return pathname === path 
      ? "text-cyan-400 font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" 
      : "text-slate-400 hover:text-white transition-colors";
  };

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20 bg-[#010314]/60 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
      
      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-4 group">
        <div className="relative flex items-center justify-center w-10 h-10 bg-white/5 border border-white/20 shadow-[0_0_15px_rgba(56,189,248,0.15)] overflow-hidden group-hover:border-cyan-500 transition-colors rounded-xl">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
          <span className="relative text-white font-black text-sm tracking-tighter">OP</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold text-white tracking-[0.15em] leading-none mb-1 uppercase drop-shadow-md">OpenPlanet</span>
          <span className="text-[9px] font-mono text-cyan-500 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
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
          <div className="relative">
            <button 
              onClick={() => setOpen(!open)} 
              className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 rounded-full py-1.5 px-2 pr-5 transition-all shadow-sm"
            >
              {session.user?.image ? (
                <Image src={session.user.image} alt="Profile" width={28} height={28} className="rounded-full border border-slate-600"/>
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-100">
                  {session.user?.name?.[0] || 'U'}
                </div>
              )}
              <span className="font-mono text-xs text-slate-300 uppercase tracking-widest">
                {session.user?.name?.split(' ')[0] || 'Operator'}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-3 w-56 bg-[#020617]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-5 py-4 text-xs font-mono text-slate-300 hover:bg-white/5 hover:text-cyan-400 transition-colors border-b border-white/5">
                  ACCESS DASHBOARD
                </Link>
                <button onClick={() => { setOpen(false); signOut({ callbackUrl:'/' }) }} className="block w-full text-left px-5 py-4 text-xs font-mono text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors">
                  TERMINATE SESSION
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center">
            {/* 👈 BUTTON FIXED: Ab wapas click karne par Google Login popup khulega */}
            <button 
              onClick={() => signIn('google')} 
              className="relative px-8 py-3 rounded-full text-[11px] font-bold tracking-[0.2em] text-white uppercase transition-all overflow-hidden group border border-white/20 shadow-[0_0_20px_rgba(56,189,248,0.2)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10">Sign In</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}