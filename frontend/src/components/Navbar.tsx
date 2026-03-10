'use client'

import Link from 'next/link'
import { useSession, signOut, signIn } from 'next-auth/react' 
import { usePathname } from 'next/navigation' 

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname() 

  const getLinkStyle = (path: string) => {
    return pathname === path 
      ? "text-indigo-600 font-extrabold drop-shadow-sm" 
      : "text-slate-500 hover:text-indigo-600 transition-colors";
  };

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      
      <Link href="/" className="flex items-center gap-4 group">
        <div className="relative flex items-center justify-center w-10 h-10 bg-slate-50 border border-slate-300 shadow-sm overflow-hidden group-hover:border-indigo-500 transition-colors">
          <span className="relative text-slate-900 font-black text-sm tracking-tighter">OP</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold text-slate-900 tracking-[0.15em] leading-none mb-1 uppercase">OpenPlanet</span>
          <span className="text-[9px] font-mono text-slate-500 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
        </div>
      </Link>

      <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
        <Link href="/" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/')}`}>Home</Link>
        <Link href="/discover" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/discover')}`}>Discover</Link>
        <Link href="/about" className={`text-[11px] font-bold uppercase tracking-[0.2em] ${getLinkStyle('/about')}`}>About</Link>
      </div>

      <div className="flex items-center gap-6">
        {session?.user ? (
          <div className="flex items-center gap-5">
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className="text-[10px] font-mono text-slate-500 hover:text-red-600 uppercase tracking-widest transition-colors"
            >
              Logout
            </button>
            <div className="bg-slate-100 border border-slate-200 px-5 py-2 rounded-lg flex items-center justify-center shadow-inner cursor-default">
              <span className="text-xs font-mono text-slate-800 tracking-[0.2em] uppercase">
                {session.user.name?.split(' ')[0] || 'USER'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button 
              onClick={() => signIn('google')} 
              className="bg-indigo-600 px-5 py-2 rounded-lg text-xs font-mono text-white tracking-[0.2em] uppercase hover:bg-indigo-700 transition-all shadow-md"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}