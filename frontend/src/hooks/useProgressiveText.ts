'use client';
import { useState, useEffect } from 'react';

export function useProgressiveText(
  text: string | null,
  wordsPerSecond = 18,
): string {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    const words = text.split(' ');
    let idx = 0;
    const interval = Math.round(1000 / wordsPerSecond);
    const timer = setInterval(() => {
      idx++;
      setDisplayed(words.slice(0, idx).join(' '));
      if (idx >= words.length) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [text, wordsPerSecond]);

  return displayed;
}
