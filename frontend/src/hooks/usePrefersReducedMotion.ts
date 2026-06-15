'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the user has requested reduced motion at the OS level
 * (prefers-reduced-motion: reduce). SSR-safe — defaults to false on the server
 * and the first client render, then syncs after mount.
 *
 * Use this to skip JS-driven motion (auto-rotating carousels, timed transitions)
 * that CSS media queries cannot reach. CSS-only motion is already handled in
 * globals.css.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
