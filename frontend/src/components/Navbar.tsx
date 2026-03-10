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
          
          /* 👇 FIXED: Sirf Name aur Logout button (No image, no dropdown) */
          <div className="flex items-center gap-5 bg-white/5 border border-white/10 px-5 py-2 rounded-full shadow-inner">
            <span className="text-[11px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
              {session.user?.name?.split(' ')[0] || 'OPERATOR'}
            </span>
            <div className="w-[1px] h-3 bg-white/20"></div> {/* Divider */}
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className="text-[10px] font-mono text-slate-400 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Logout
            </button>
          </div>

        ) : (
          <div className="flex items-center">
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