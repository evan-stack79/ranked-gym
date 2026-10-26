'use client';

import { isMetalFxSupported, MetalFx, MetalText, type MetalFxPreset, type MetalFxVariant } from 'metal-fx';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useFxReducedMotion, useFxTheme, type FxTheme } from './fx';
import './metal-button.css';

export type MetalProps = {
  /** Un seul élément hôte (bouton, lien, div…). */
  children: ReactNode;
  /** `button` : anneau pilule ; `circle` : anneau rond plus épais. */
  variant?: MetalFxVariant;
  /** Teinte du métal. */
  preset?: MetalFxPreset;
  /** Intensité de l'effet (0..1). */
  strength?: number;
  /** Thème forcé ; `auto` suit `data-theme` sur <html> puis le système. */
  theme?: FxTheme | 'auto';
  /** Laisser metal-fx neutraliser bordure / fond / ombre de l'enfant. */
  normalizeHost?: boolean;
  className?: string;
};

/**
 * Anneau de métal liquide autour d'un contrôle unique. Rend l'enfant brut
 * avant l'hydratation et sans WebGL2 ; se fige sous reduced motion.
 */
export function Metal({ children, variant = 'button', preset = 'chromatic', strength = 0.9, theme = 'auto', normalizeHost = false, className }: MetalProps) {
  const resolved = useFxTheme(theme);
  const reduced = useFxReducedMotion();
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(isMetalFxSupported()), []);
  if (!supported) return <span className={`tk-metal-fallback${className ? ` ${className}` : ''}`}>{children}</span>;
  return (
    <MetalFx variant={variant} preset={preset} theme={resolved} strength={strength} paused={reduced} normalizeHostStyles={normalizeHost} className={`tk-metal${className ? ` ${className}` : ''}`} style={{ display: 'inline-flex' }}>
      {children}
    </MetalFx>
  );
}

export type MetalButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Libellé du bouton. */
  children?: ReactNode;
  /** Icône facultative après le libellé (une étincelle par défaut ; `null` pour aucune). */
  icon?: ReactNode | null;
  preset?: MetalFxPreset;
  strength?: number;
  theme?: FxTheme | 'auto';
  /** `pill` (défaut) ou `circle` pour un bouton icône rond. */
  shape?: 'pill' | 'circle';
};

const Sparkle = () => (
  <svg className="tk-metal-btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.1 2.4a.6.6 0 0 0-1.14 0l-1.2 3.55a3.6 3.6 0 0 1-2.25 2.25l-3.55 1.2a.6.6 0 0 0 0 1.14l3.55 1.2a3.6 3.6 0 0 1 2.25 2.25l1.2 3.55a.6.6 0 0 0 1.14 0l1.2-3.55a3.6 3.6 0 0 1 2.25-2.25l3.55-1.2a.6.6 0 0 0 0-1.14l-3.55-1.2a3.6 3.6 0 0 1-2.25-2.25l-1.2-3.55Z" />
    <path d="M18.6 16.1a.36.36 0 0 0-.68 0l-.5 1.46a1.9 1.9 0 0 1-1.19 1.19l-1.46.5a.36.36 0 0 0 0 .68l1.46.5a1.9 1.9 0 0 1 1.19 1.19l.5 1.46a.36.36 0 0 0 .68 0l.5-1.46a1.9 1.9 0 0 1 1.19-1.19l1.46-.5a.36.36 0 0 0 0-.68l-1.46-.5a1.9 1.9 0 0 1-1.19-1.19l-.5-1.46Z" />
  </svg>
);

/** Bouton noir en pilule cerclé de métal liquide. */
export function MetalButton({ children = 'Get started', icon, preset = 'chromatic', strength = 0.9, theme = 'auto', shape = 'pill', className, type = 'button', ...rest }: MetalButtonProps) {
  return (
    <Metal preset={preset} strength={strength} theme={theme} variant={shape === 'circle' ? 'circle' : 'button'} normalizeHost className="tk-metal-btn__host">
      <button type={type} className={`tk-metal-btn tk-metal-btn--${shape}${className ? ` ${className}` : ''}`} {...rest}>
        {shape === 'circle' ? null : <span>{children}</span>}
        {icon === null ? null : icon ?? <Sparkle />}
      </button>
    </Metal>
  );
}

export type MetalWordmarkProps = {
  /** Texte du logotype. */
  children?: string;
  /** Raccourci CSS `font`, ex. `600 56px/1 Inter, sans-serif`. */
  font?: string;
  /** Couleur de base sous le métal. */
  color?: string;
  strength?: number;
  theme?: FxTheme | 'auto';
  /** Part de métal visible sur la couleur de base (0..1). */
  metalOpacity?: number;
  /** Halo autour des glyphes. */
  glow?: boolean;
  className?: string;
};

/** Logotype texte rempli de métal liquide. Texte réel, lisible et sélectionnable. */
export function MetalWordmark({ children = 'Northwind', font = '700 64px/1 ui-sans-serif, system-ui, sans-serif', color, strength = 1, theme = 'auto', metalOpacity = 0.9, glow = false, className }: MetalWordmarkProps) {
  const resolved = useFxTheme(theme);
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(isMetalFxSupported()), []);
  const base = color ?? (resolved === 'dark' ? '#e8e8ea' : '#1a1a1c');
  if (!supported) return <span className={`tk-metal-word${className ? ` ${className}` : ''}`} style={{ font, color: base }}>{children}</span>;
  return <MetalText font={font} color={base} strength={strength} theme={resolved} metalOpacity={metalOpacity} glow={glow} className={`tk-metal-word${className ? ` ${className}` : ''}`}>{children}</MetalText>;
}
