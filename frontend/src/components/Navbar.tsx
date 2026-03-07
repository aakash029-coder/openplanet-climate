'use client'

import Link from 'next/link'
import Image from 'next/image' 
import { useSession, signOut, signIn } from 'next-auth/react' 
import { useState, useEffect } from 'react' 
import { usePathname } from 'next/navigation' 

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname() 

  // Helper function for active link highlighting
  const getLinkStyle = (path: string) => {
    return pathname === path 
      ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" 
      : "text-slate-400 hover:text-white transition-colors";
  };

  return (
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

      {/* Center Navigation Links */}
      <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
        <Link href="/" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/')}`}>Home</Link>
        <Link href="/discover" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/discover')}`}>Discover</Link>
        <Link href="/about" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/about')}`}>About</Link>
      </div>

      {/* Extreme Right Auth Actions */}
      <div className="flex items-center gap-6">
        {session?.user ? (
          
          <div className="flex items-center gap-5">
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className="text-[10px] font-mono text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Logout
            </button>
            
            <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-lg flex items-center justify-center shadow-inner cursor-default">
              <span className="text-xs font-mono text-white tracking-[0.2em] uppercase">
                {session.user.name?.split(' ')[0] || 'USER'}
              </span>
            </div>
          </div>

        ) : (
          
          <div className="flex items-center gap-4">
            {/* Ab button active hai, user chahe toh sign in kare, warna bina sign in ke website use kare */}
            <button 
              onClick={() => signIn('google')} 
              className="bg-white/5 border border-white/10 px-5 py-2 rounded-lg text-xs font-mono text-white tracking-[0.2em] uppercase hover:bg-white/10 transition-colors shadow-md"
            >
              Sign in with Google
            </button>
          </div>

        )}
      </div>
    </nav>
  )
}