import { useCallback, useRef, useState } from 'react'
import type { RankInfo } from '../../utils/rank'
import { rankVisuals } from '../../utils/rankVisuals'

interface RankShowcaseProps {
  rank: RankInfo
  level: number
}

function CardWatermark({ dark }: { dark: boolean }) {
  const stroke = dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)'
  return (
    <svg
      className="pointer-events-none absolute -right-4 -top-2 h-44 w-44"
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="52" fill="none" stroke={stroke} strokeWidth="1.25" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={stroke} strokeWidth="1.25" />
      <circle cx="60" cy="60" r="20" fill="none" stroke={stroke} strokeWidth="1.25" />
      <path d="M20 60 H100 M60 20 V100" stroke={stroke} strokeWidth="1" />
    </svg>
  )
}

/**
 * Carte de rang holographique (trading card) — isolée du reste de l’UI :
 * shine diagonal ~3s, tilt 3D doigt/souris, halo de rang dynamique.
 */
export function RankShowcase({ rank, level }: RankShowcaseProps) {
  const visual = rankVisuals[rank.tier]
  const isGoldFace = rank.tier === 'Or'
  const isLegend = rank.tier === 'Légende'
  const cardRef = useRef<HTMLElement>(null)
  const [tilt, setTilt] = useState({
    rx: 0,
    ry: 0,
    glareX: 50,
    glareY: 50,
    active: false,
  })

  const resetTilt = useCallback(() => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false })
  }, [])

  const applyPointer = useCallback((clientX: number, clientY: number) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (clientX - rect.left) / Math.max(rect.width, 1)
    const py = (clientY - rect.top) / Math.max(rect.height, 1)
    // Inclinaison douce vers le doigt (profondeur trading card)
    const ry = (px - 0.5) * 12
    const rx = (0.5 - py) * 10
    setTilt({
      rx,
      ry,
      glareX: px * 100,
      glareY: py * 100,
      active: true,
    })
  }, [])

  const haloStrength = tilt.active ? 0.58 : 0.42
  const haloSpread = tilt.active ? 48 : 40
  const dynamicGlow = [
    `0 0 ${haloSpread}px rgba(${visual.haloRgb}, ${haloStrength})`,
    `0 0 ${haloSpread * 1.5}px rgba(${visual.haloRgb}, ${haloStrength * 0.28})`,
    `0 18px 40px rgba(0, 0, 0, 0.4)`,
    `inset 0 1px 0 rgba(255, 255, 255, 0.28)`,
  ].join(', ')

  return (
    <div className="rank-trading-stage" style={{ perspective: '1000px' }}>
      <section
        ref={cardRef}
        className="rank-trading-card relative overflow-hidden rounded-3xl border-2 p-6"
        style={{
          background: visual.background,
          boxShadow: dynamicGlow,
          borderColor: 'transparent',
          transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${
            tilt.active ? 1.015 : 1
          })`,
          transition: tilt.active
            ? 'transform 140ms ease-out, box-shadow 280ms ease-out'
            : 'transform 650ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 550ms ease-out',
          transformStyle: 'preserve-3d',
          willChange: 'transform, box-shadow',
        }}
        onMouseMove={(e) => applyPointer(e.clientX, e.clientY)}
        onMouseLeave={resetTilt}
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) applyPointer(t.clientX, t.clientY)
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]
          if (t) applyPointer(t.clientX, t.clientY)
        }}
        onTouchEnd={resetTilt}
        onTouchCancel={resetTilt}
        aria-label={`Rang ${rank.label}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl border-2 ${visual.border}`}
        />

        <CardWatermark dark={isGoldFace} />

        {/* Foil holographique subtil (réagit au tilt) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-28 mix-blend-soft-light"
          style={{
            background: `
              linear-gradient(
                ${115 + tilt.ry * 1.5}deg,
                transparent 22%,
                rgba(255,255,255,0.05) 42%,
                rgba(255,200,150,0.08) 50%,
                rgba(180,220,255,0.06) 58%,
                transparent 78%
              )
            `,
            transition: 'background 200ms ease-out',
          }}
          aria-hidden
        />

        {/* Shine diagonal ~7s, lent et discret */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
          aria-hidden
        >
          <div className="rank-holo-shine" />
        </div>

        {/* Glare sous le doigt / curseur */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300 ease-out"
          style={{
            opacity: tilt.active ? 0.45 : 0,
            background: `radial-gradient(
              circle at ${tilt.glareX}% ${tilt.glareY}%,
              rgba(255, 255, 255, 0.22) 0%,
              rgba(255, 255, 255, 0.05) 30%,
              transparent 58%
            )`,
          }}
          aria-hidden
        />

        {isLegend && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ boxShadow: 'inset 0 0 0 1px #FFD700' }}
            aria-hidden
          />
        )}

        <div className="relative" style={{ transform: 'translateZ(24px)' }}>
          <p className={`text-[13px] font-semibold uppercase tracking-wider ${visual.sublabel}`}>
            Muscu Classée
          </p>

          <h2 className={`mt-3 text-[34px] font-black tracking-tight ${visual.label}`}>
            {rank.label}
          </h2>

          <p className={`mt-1 text-[15px] font-semibold ${visual.sublabel}`}>{rank.tier}</p>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className={`text-[13px] font-medium ${visual.sublabel}`}>Niveau</p>
              <p className={`text-[26px] font-black tracking-tight ${visual.label}`}>{level}</p>
            </div>
            <p className={`text-right text-[13px] font-semibold ${visual.sublabel}`}>
              Division {rank.division}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
