/**
 * Silhouettes 2D plates (contour fin) — style BottleVisual de l’app.
 * Pas de glossy, pas de 3D, pas de reflet.
 */

export type BottleKind = 'plastic_15' | 'small_50' | 'glass_25' | 'gourd'

const WATER = 'rgba(90, 200, 250, 0.55)'
const STROKE = '#8E8E93'
const BODY = '#1C1C1E'

/** Bouteille plastique 1,5 L type eau minérale — plate. */
export function PlasticBottle15({
  fillRatio,
  large = false,
  selected = false,
}: {
  fillRatio: number
  large?: boolean
  selected?: boolean
}) {
  const h = Math.min(1, Math.max(0, fillRatio))
  const clipId = large ? 'mock-clip-15-lg' : 'mock-clip-15'
  const size = large ? 'h-[152px] w-[68px]' : 'h-11 w-6'
  return (
    <div
      className={`relative ${size}`}
      aria-hidden
      data-mockup-bottle="plastic_15"
      data-selected={selected ? '1' : undefined}
    >
      <svg viewBox="0 0 80 160" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id={clipId}>
            <path d="M30 14 h20 v8 c0 3 3 5 3 9 v100 c0 12-7 16-13 16 h0 c-6 0-13-4-13-16 V31 c0-4 3-6 3-9 z" />
          </clipPath>
        </defs>
        {/* bouchon */}
        <rect x="32" y="4" width="16" height="10" rx="2" fill={BODY} stroke={STROKE} strokeWidth="1.5" />
        {/* col */}
        <path d="M34 14 h12 v8" fill="none" stroke={STROKE} strokeWidth="1.5" />
        {/* corps */}
        <path
          d="M30 22 c0 3 3 5 3 9 v100 c0 12-7 16-13 16 h0 c-6 0-13-4-13-16 V31 c0-4 3-6 3-9 c2-4 8-6 14-6 s12 2 14 6z"
          fill={BODY}
          stroke={STROKE}
          strokeWidth="1.6"
        />
        {/* rainures légères (plats) */}
        <path d="M28 55 h24 M28 75 h24 M28 95 h24" stroke="#8E8E93" strokeOpacity="0.35" strokeWidth="1" />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y={160 - 160 * h} width="80" height={160 * h} fill={WATER} />
        </g>
      </svg>
    </div>
  )
}

/** Petite bouteille 50 cl. */
export function SmallBottle50({
  selected = false,
}: {
  selected?: boolean
}) {
  return (
    <div className="relative h-11 w-6" aria-hidden data-mockup-bottle="small_50" data-selected={selected ? '1' : undefined}>
      <svg viewBox="0 0 56 120" className="absolute inset-0 h-full w-full">
        <rect x="20" y="4" width="16" height="9" rx="2" fill={BODY} stroke={STROKE} strokeWidth="1.5" />
        <path
          d="M18 16 h20 v6 c0 3 2 4 2 7 v70 c0 9-5 12-10 12 h0 c-5 0-10-3-10-12 V29 c0-3 2-4 2-7z"
          fill={BODY}
          stroke={STROKE}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

/** Verre 25 cl — miniature picker. */
export function GlassPickerIcon({ selected = false }: { selected?: boolean }) {
  return (
    <div className="relative h-10 w-7" aria-hidden data-mockup-bottle="glass_25" data-selected={selected ? '1' : undefined}>
      <svg viewBox="0 0 40 48" className="absolute inset-0 h-full w-full">
        <path
          d="M8 4h24l-2.5 36a5 5 0 0 1-5 4.5H15.5a5 5 0 0 1-5-4.5L8 4Z"
          fill={BODY}
          stroke={STROKE}
          strokeWidth="1.5"
        />
        <path d="M7 4h26" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/**
 * Gourde plate « Exemple » pour Ma bouteille Pro — silhouette détourée 2D,
 * sans photo réelle ni visage.
 */
export function GourdExample({ fillRatio }: { fillRatio: number }) {
  const h = Math.min(1, Math.max(0, fillRatio))
  return (
    <div className="relative h-[160px] w-[76px]" aria-hidden data-mockup-bottle="gourd">
      <svg viewBox="0 0 100 220" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="mock-clip-gourd">
            <path d="M38 28 c0-10 8-16 12-16 s12 6 12 16 v8 c8 4 14 14 14 28 v110 c0 18-12 28-26 28 s-26-10-26-28 V64 c0-14 6-24 14-28z" />
          </clipPath>
        </defs>
        {/* bouchon gourde */}
        <rect x="40" y="6" width="20" height="14" rx="3" fill={BODY} stroke={STROKE} strokeWidth="1.6" />
        <path
          d="M38 28 c0-10 8-16 12-16 s12 6 12 16 v8 c8 4 14 14 14 28 v110 c0 18-12 28-26 28 s-26-10-26-28 V64 c0-14 6-24 14-28z"
          fill={BODY}
          stroke={STROKE}
          strokeWidth="1.7"
        />
        {/* anse latérale plate */}
        <path
          d="M76 78 c14 4 18 22 10 36 c-4 8-12 10-18 8"
          fill="none"
          stroke={STROKE}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <g clipPath="url(#mock-clip-gourd)">
          <rect x="0" y={220 - 220 * h} width="100" height={220 * h} fill={WATER} />
        </g>
      </svg>
      <span className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#ACB4BA]">
        Exemple
      </span>
    </div>
  )
}
