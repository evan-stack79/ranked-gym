import type { CSSProperties } from 'react'
import { FlatGlassIcon } from './FlatGlassIcon'

/**
 * Proposition maquette : tuile carrée Eau dans la grille Accueil
 * (même coque que `accueil-metric-tile`, accent bleu existant #0A84FF).
 * 8 verres × 25 cl — 5 remplis → 1,25 L / 2 L.
 */
const FILLED = 5
const TOTAL = 8

export function EauGlassesTile() {
  const style = { '--tile-accent': '#0A84FF' } as CSSProperties
  return (
    <div
      role="group"
      aria-label="Eau, 1,25 litre sur 2 litres"
      data-accueil-metric-tile="eau"
      data-mockup-eau-glasses="1"
      className="accueil-metric-tile accueil-metric-tile--small"
      style={style}
    >
      <span className="accueil-metric-tile__glow" aria-hidden="true" />
      <p className="accueil-metric-tile__label">Eau</p>
      <div className="mt-3 grid grid-cols-4 gap-x-1.5 gap-y-2" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className="flex items-center justify-center">
            <FlatGlassIcon filled={i < FILLED} size={20} />
          </span>
        ))}
      </div>
      <div className="accueil-metric-tile__stack mt-auto pt-3">
        <div className="accueil-metric-tile__value-row">
          <span className="accueil-metric-tile__value text-[1.35rem]">1,25</span>
          <span className="accueil-metric-tile__unit">L / 2 L</span>
        </div>
      </div>
    </div>
  )
}
