'use client';
import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'op_cookies_v1';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => { localStorage.setItem(STORAGE_KEY, '1'); setVisible(false); };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9000] border-t border-white/[0.05] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      style={{ background: 'var(--panel)' }}
    >
      <p className="font-mono text-[9px] text-slate-400 leading-relaxed max-w-2xl uppercase tracking-wide">
        OpenPlanet uses <span className="text-white">localStorage only</span> — no third-party cookies.
        Session state persists locally for scenario recall.
        Climate data © Copernicus C3S. Open-source educational instrument — not financial advice.
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 px-6 py-2 bg-white/[0.04] border border-white/[0.09] text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em] hover:text-white hover:border-white/20 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
