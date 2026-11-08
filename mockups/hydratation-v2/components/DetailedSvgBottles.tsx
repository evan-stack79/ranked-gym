/** Illustration vectorielle soignée (transparence, rainures, bouchon, base pétaloide). */

export function SvgBottle15({
  fillRatio,
  large = false,
}: {
  fillRatio: number
  large?: boolean
}) {
  const h = Math.min(1, Math.max(0, fillRatio))
  const waterY = 168 - 168 * h
  const size = large ? 'h-[220px] w-[96px]' : 'h-14 w-7'
  const uid = large ? 'svg15lg' : 'svg15sm'
  return (
    <div className={`relative ${size}`} aria-hidden data-mockup-svg-bottle="15">
      <svg viewBox="0 0 90 190" className="h-full w-full">
        <defs>
          <linearGradient id={`${uid}-plastic`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9eb6c4" stopOpacity="0.35" />
            <stop offset="18%" stopColor="#d7e6ef" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#f2f8fb" stopOpacity="0.18" />
            <stop offset="70%" stopColor="#c5d8e4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7f97a6" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a84ff" stopOpacity="0.5" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <path d="M33 22c0 4 3 7 3 11v118c0 11-7 16-13 16h0c-6 0-13-5-13-16V33c0-4 3-7 3-11 2-5 9-8 16-8s14 3 16 8z" />
          </clipPath>
        </defs>
        {/* bouchon à vis */}
        <rect x="36" y="4" width="18" height="12" rx="2.5" fill="#2F80ED" />
        <path d="M37 7h16M37 10h16M37 13h16" stroke="#1B4F9C" strokeWidth="0.8" opacity="0.55" />
        <rect x="38" y="15" width="14" height="4" rx="1" fill="#1C1C1E" stroke="#8E8E93" strokeWidth="0.8" />
        {/* col + épaules */}
        <path
          d="M33 22c0 4 3 7 3 11v8c8 2 14 6 14 14v96c0 11-7 16-13 16h0c-6 0-13-5-13-16V55c0-8 6-12 14-14v-8c0-4 3-7 3-11 2-5 9-8 16-8s14 3 16 8z"
          fill={`url(#${uid}-plastic)`}
          stroke="#9AA8B2"
          strokeWidth="1.4"
        />
        {/* eau */}
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x="20" y={waterY} width="50" height={190 - waterY} fill={`url(#${uid}-water)`} />
        </g>
        {/* rainures */}
        <path
          d="M28 58h34M27 70h36M27 82h36M29 102h32M28 114h34M28 126h34M29 138h32"
          stroke="#ffffff"
          strokeOpacity="0.22"
          strokeWidth="1.1"
        />
        {/* étiquette vierge */}
        <rect x="30" y="88" width="30" height="22" rx="2" fill="#f7fafc" fillOpacity="0.55" stroke="#c9d4dc" strokeWidth="0.8" />
        {/* base pétaloide */}
        <path
          d="M30 162c2 6 6 10 10 10s8-4 10-10c2 6 6 10 10 10 2 0 4-1 5-3"
          fill="none"
          stroke="#8E8E93"
          strokeWidth="1.2"
        />
        {/* reflet fin */}
        <path d="M34 30c0 20 0 90 0 120" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function SvgGlass25({ fillRatio = 0 }: { fillRatio?: number }) {
  const h = Math.min(1, Math.max(0, fillRatio))
  return (
    <div className="relative h-14 w-9" aria-hidden data-mockup-svg-bottle="glass">
      <svg viewBox="0 0 60 80" className="h-full w-full">
        <defs>
          <linearGradient id="gglass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
          </linearGradient>
          <clipPath id="gclip">
            <path d="M14 8h32l-3 52c-1 8-5 12-13 12s-12-4-13-12L14 8z" />
          </clipPath>
        </defs>
        <path
          d="M14 8h32l-3 52c-1 8-5 12-13 12s-12-4-13-12L14 8z"
          fill="url(#gglass)"
          stroke="#C7C7CC"
          strokeWidth="1.6"
        />
        {/* fond épais */}
        <path d="M17 62h26c0 6-4 10-13 10s-13-4-13-10z" fill="#E5E5EA" fillOpacity="0.35" stroke="#C7C7CC" strokeWidth="1" />
        <g clipPath="url(#gclip)">
          <rect x="10" y={80 - 80 * h} width="40" height={80 * h} fill="rgba(90,200,250,0.45)" />
        </g>
      </svg>
    </div>
  )
}
