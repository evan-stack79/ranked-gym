'use client';

import { useEffect, useState } from 'react';

export type FxTheme = 'dark' | 'light';

/**
 * Thème résolu : attribut `data-theme` de <html> s'il existe, sinon la
 * préférence système. Suit les changements en direct.
 */
export function useFxTheme(forced?: FxTheme | 'auto'): FxTheme {
  const [theme, setTheme] = useState<FxTheme>('light');
  useEffect(() => {
    if (forced && forced !== 'auto') { setTheme(forced); return; }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const read = () => {
      const attr = document.documentElement.dataset.theme;
      setTheme(attr === 'light' ? 'light' : attr === 'dark' ? 'dark' : mq.matches ? 'dark' : 'light');
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    mq.addEventListener('change', read);
    return () => { observer.disconnect(); mq.removeEventListener('change', read); };
  }, [forced]);
  return theme;
}

/** Vrai une fois monté si l'utilisateur demande moins d'animations. */
export function useFxReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return reduced;
}
