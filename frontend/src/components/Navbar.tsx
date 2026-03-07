'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import { usePathname } from 'next/navigation' // 👈 Active page track karne ke liye

export default function Navbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const pathname = usePathname() // 👈 Pathname hook

  // Helper function for active link highlighting
  const getLinkStyle = (path: string) => {
    return pathname === path 
      ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" 
      : "text-slate-400 hover:text-white transition-colors";
  };

  return (
    // 'fixed' ko 'sticky' kiya taaki gap ka issue na aaye aur layout ke saath manage ho
    <nav className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20 bg-[#020617]/90 backdrop-blur-md border-b border-slate-800/80 shadow-2xl">
      
      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-4 group">
        <div className="relative flex items-center justify-center w-10 h-10 bg-[#0a0f1d] border border-slate-700 shadow-[0_0_15px_rgba(255,255,255,0.05)] overflow-hidden group-hover:border-slate-500 transition-colors">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
          <span className="relative text-white font-black text-sm tracking-tighter">OP</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold text-white tracking-[0.15em] leading-none mb-1 uppercase">OpenPlanet</span>
          <span className="text-[9px] font-mono text-slate-500 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
        </div>
      </Link>

      {/* Center Navigation Links - AB LINKS CONNECTED HAIN ✅ */}
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
              className="flex items-center gap-3 bg-[#0a0f1d] border border-slate-700 hover:border-slate-500 rounded-full py-1.5 px-2 pr-5 transition-colors shadow-sm"
            >
              {session.user?.image ? (
                <Image src={session.user.image} alt="Profile" width={28} height={28} className="rounded-full border border-slate-600"/>
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {session.user?.name?.[0] || 'U'}
                </div>
              )}
              <span className="font-mono text-xs text-slate-300 uppercase tracking-widest">
                {session.user?.name?.split(' ')[0] || 'Operator'}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#0a0f1d] border border-slate-700 rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-5 py-3 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800/50">
                  ACCESS DASHBOARD
                </Link>
                <button onClick={() => { setOpen(false); signOut({ callbackUrl:'/' }) }} className="block w-full text-left px-5 py-3 text-xs font-mono text-red-500 hover:bg-slate-800 transition-colors">
                  TERMINATE SESSION
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center">
            <Link href="/api/auth/signin" className="flex items-center justify-center px-8 py-3 rounded-full font-bold text-[#020617] bg-white hover:bg-slate-200 transition-colors text-[11px] tracking-[0.2em] uppercase shadow-md">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}