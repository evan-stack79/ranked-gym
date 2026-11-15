import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import {
  AIDE,
  LIGNE_PRO,
  etat,
  etatTexts,
  fmtDur,
} from '../../../sleep-week-engine'
import type { SleepNightEntry } from '../../../services/sleepStorage'
import { SLEEP_PANTHER_SRC } from '../sleepFeeling'
import type { SleepFeelingLevel } from '../../../services/sleepStorage'
import { ConseilLottie } from '../../conseil/ConseilLottie'
import { buildSleepWeekModel, fmtDurParts } from './sleepWeekModel'

const RED = '#ff0702'
const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'

function monotonePath(points: Array<[number, number]>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0]![0]} ${points[0]![1]}`
  const n = points.length
  const dx = (points[n - 1]![0] - points[0]![0]) / Math.max(1, n - 1)
  const sl = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / dx)
  const m = points.map((_, i) =>
    i === 0
      ? sl[0]!
      : i === n - 1
        ? sl[n - 2]!
        : sl[i - 1]! * sl[i]! <= 0
          ? 0
          : (sl[i - 1]! + sl[i]!) / 2,
  )
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i]! / sl[i]!
    const b = m[i + 1]! / sl[i]!
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * sl[i]!
      m[i + 1] = t * b * sl[i]!
    }
  }
  let d = `M${points[0]![0]} ${points[0]![1]}`
  for (let i = 0; i < n - 1; i++) {
    d += ` C${[
      points[i]![0] + dx / 3,
      points[i]![1] + m[i]! * (dx / 3),
      points[i + 1]![0] - dx / 3,
      points[i + 1]![1] + m[i + 1]! * (dx / 3),
      points[i + 1]![0],
      points[i + 1]![1],
    ]
      .map((v) => v.toFixed(1))
      .join(' ')}`
  }
  return d
}

function PantherHeads({ half }: { half: number }) {
  const level = Math.min(5, Math.max(1, Math.round(half) || 3)) as SleepFeelingLevel
  const src = SLEEP_PANTHER_SRC[level]
  const full = Math.floor(half)
  const frac = half - full
  return (
    <span className="inline-flex items-center gap-0.5" data-sleep-week-heads>
      {([1, 2, 3, 4, 5] as const).map((lvl) => {
        const on = lvl <= full
        const halfOn = lvl === full + 1 && frac >= 0.5
        return (
          <span key={lvl} className="relative inline-block h-5 w-5 overflow-hidden">
            <img src={src} alt="" className="absolute inset-0 h-5 w-5 opacity-25" />
            {(on || halfOn) && (
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-5 w-5"
                style={halfOn ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
              />
            )}
          </span>
        )
      })}
    </span>
  )
}

interface SleepWeekBlockProps {
  nights: SleepNightEntry[]
  age: number
}

export function SleepWeekBlock({ nights, age }: SleepWeekBlockProps) {
  const reduced = usePrefersReducedMotion()
  const model = useMemo(() => buildSleepWeekModel(nights, age), [nights, age])
  const [selected, setSelected] = useState<number | null>(null)
  const [appeared, setAppeared] = useState(reduced)
  const [aideOpen, setAideOpen] = useState(false)

  const tip = useMemo(() => {
    if (!model || model.provisional) return null
    const r = etat(model.nights, age > 0 ? age : 24, {})
    if (r.id < 1 || r.id > 12) return null
    const texts = etatTexts(r.id, r)
    if (!texts) return null
    return {
      id: r.id,
      texts,
      aide: AIDE[r.id as keyof typeof AIDE] as string | undefined,
    }
  }, [model, age])

  useEffect(() => {
    if (reduced) {
      setAppeared(true)
      return
    }
    setAppeared(false)
    const t = window.setTimeout(() => setAppeared(true), 40)
    return () => window.clearTimeout(t)
  }, [model?.weekStart, reduced])

  if (!model || model.validCount === 0) return null

  const W = 327
  const H = 126
  const bot = 104
  const lo = 4.5 * 60
  const hi = 8.5 * 60
  const X = (i: number) => 22 + (i * (W - 44)) / 6
  const Y = (m: number) => bot - ((m - lo) / (hi - lo)) * (bot - 8)

  const points: Array<[number, number]> = model.days.map((d, i) => [
    X(i),
    Y(d.durationMin ?? model.avgMin ?? 7 * 60),
  ])
  const path = monotonePath(points)
  const yR = Y(model.Bb)
  const focus = selected != null ? model.days[selected] : null
  const showDay = Boolean(focus?.night && focus.durationMin != null)
  const displayMin = showDay ? focus!.durationMin! : model.avgMin!
  const parts = fmtDurParts(displayMin)
  const title = showDay ? `Nuit du ${focus!.label}` : 'Moyenne de la semaine'
  const subtitle = showDay ? focus!.hoursLabel : 'par nuit'
  const filledIdx = model.days
    .map((d, i) => (d.durationMin != null ? i : -1))
    .filter((i) => i >= 0)
  const dotI = showDay ? selected! : (filledIdx.at(-1) ?? 0)
  const dot = points[dotI] ?? points[0]!

  return (
    <section className="mt-4 shrink-0 pb-2" data-sleep-week-block>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h2 className="text-[17px] font-semibold text-white">Ta semaine</h2>
        <span className="text-[13px]" style={{ color: GRAY }}>
          {model.weekLabel}
          {model.provisional ? ' · provisoire' : ''}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-2xl px-3 pb-3 pt-3"
        style={{ backgroundColor: CARD }}
        data-sleep-week-card
      >
        <div className="flex justify-between gap-1">
          {model.days.map((d) => {
            const on =
              selected === d.index ||
              (selected == null && d.index === (filledIdx.at(-1) ?? -1))
            return (
              <button
                key={d.nightDateKey}
                type="button"
                className="ios-press flex flex-1 flex-col items-center gap-1"
                onClick={() => {
                  if (!d.night) return
                  setSelected((cur) => (cur === d.index ? null : d.index))
                }}
                data-sleep-week-day={d.index}
                style={{
                  opacity: appeared ? 1 : 0,
                  transform: appeared ? 'none' : 'translateY(8px)',
                  transition: reduced
                    ? undefined
                    : `opacity 380ms ${d.index * 70}ms, transform 380ms ${d.index * 70}ms`,
                }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{
                    backgroundColor: on ? RED : 'transparent',
                    color: on ? '#fff' : GRAY,
                    boxShadow: on ? `0 0 0 1.5px ${RED}` : undefined,
                  }}
                >
                  {d.letter}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: GRAY }}>
                  {d.dateNum}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative mt-3 flex min-h-[88px] flex-col items-center justify-center">
          <p className="text-[12px]" style={{ color: GRAY }} data-sleep-week-title>
            {title}
          </p>
          <div className="relative">
            <p
              className="mt-0.5 text-[44px] font-bold leading-none tabular-nums text-white"
              style={{
                opacity: appeared ? 1 : 0,
                transform: appeared ? 'none' : 'translateY(6px)',
                transition: reduced
                  ? undefined
                  : 'opacity 700ms 900ms, transform 700ms 900ms',
              }}
              data-sleep-week-avg
            >
              <span>{parts.h}</span>
              <span className="mx-0.5 text-[28px] font-semibold" style={{ color: GRAY }}>
                h
              </span>
              <span>{parts.m}</span>
            </p>
            {!reduced ? (
              <>
                <span
                  className="pointer-events-none absolute -left-3 top-1 text-[10px]"
                  style={{ color: RED, opacity: 0.55 }}
                  aria-hidden
                >
                  ✦
                </span>
                <span
                  className="pointer-events-none absolute -right-4 bottom-1 text-[9px]"
                  style={{ color: GRAY, opacity: 0.7 }}
                  aria-hidden
                >
                  +
                </span>
                <span
                  className="pointer-events-none absolute -right-1 -top-1 text-[8px]"
                  style={{ color: RED, opacity: 0.4 }}
                  aria-hidden
                >
                  ✦
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-[13px]" style={{ color: GRAY }} data-sleep-week-sub>
            {subtitle}
          </p>
        </div>

        <div className="relative mt-1">
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block"
            aria-hidden
            data-sleep-week-curve
          >
            <defs>
              <linearGradient id="sleepWeekFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={RED} stopOpacity="0.28" />
                <stop offset="1" stopColor={RED} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line
              x1={0}
              x2={W}
              y1={yR}
              y2={yR}
              stroke={GRAY}
              strokeOpacity={0.55}
              strokeWidth={1.2}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            {path ? (
              <>
                <path
                  d={`${path} L${points[points.length - 1]![0]} ${bot + 2} L${points[0]![0]} ${bot + 2} Z`}
                  fill="url(#sleepWeekFill)"
                  style={{
                    opacity: appeared ? 1 : 0,
                    transition: reduced ? undefined : 'opacity 500ms 1.3s',
                  }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={RED}
                  strokeWidth={3}
                  strokeLinecap="round"
                  pathLength={1}
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: appeared ? 0 : 1,
                    transition: reduced ? undefined : 'stroke-dashoffset 1100ms 450ms ease-out',
                  }}
                />
              </>
            ) : null}
            <circle
              cx={dot[0]}
              cy={dot[1]}
              r={5.5}
              fill={RED}
              stroke="#fff"
              strokeWidth={2}
              style={{
                filter: `drop-shadow(0 0 6px ${RED})`,
                opacity: appeared ? 1 : 0,
                transition: reduced ? undefined : 'opacity 400ms 1.4s',
              }}
            />
          </svg>
          <span
            className="pointer-events-none absolute rounded bg-[#2A2A2E] px-1.5 py-0.5 text-[10px] font-medium text-[#ECEEEF]"
            style={{ top: Math.max(4, yR + 8), right: 12 }}
            data-sleep-week-repere
          >
            Ton repère {model.repereHours}&nbsp;h
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <div>
            <div className="text-[11px]" style={{ color: GRAY }}>
              Nuit (au lit)
            </div>
            <div className="mt-0.5 text-[14px] font-semibold text-white">
              {showDay ? fmtDur(focus!.durationMin!) : model.avgLabel}
            </div>
          </div>
          <div>
            <div className="text-[11px]" style={{ color: GRAY }}>
              Coucher
            </div>
            <div className="mt-0.5 text-[14px] font-semibold text-white">
              <span className="text-[11px] font-normal" style={{ color: GRAY }}>
                vers{' '}
              </span>
              {model.coucherLabel}
            </div>
          </div>
          <div>
            <div className="text-[11px]" style={{ color: GRAY }}>
              Ressenti
            </div>
            <div className="mt-0.5">
              <PantherHeads half={model.ressentiHalf} />
            </div>
          </div>
        </div>
      </div>

      {tip ? (
        <div
          className="mt-3 overflow-hidden rounded-2xl px-3.5 py-3"
          style={{ backgroundColor: CARD }}
          data-sleep-conseil={tip.id}
        >
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0">
              <ConseilLottie kind="sleep" etatId={tip.id} className="h-14 w-14" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium" style={{ color: RED }}>
                Ton conseil de la semaine
              </p>
              <p className="mt-0.5 text-[16px] font-semibold text-white">{tip.texts.nom}</p>
            </div>
          </div>
          <p className="mt-2 text-[14px] leading-snug text-white/90">{tip.texts.texte}</p>
          <ul className="mt-2 space-y-1.5">
            {tip.texts.actions.slice(0, 3).map((a) => (
              <li key={a} className="flex gap-2 text-[13px] text-white/85">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: RED }}
                />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          {(tip.aide || tip.texts.aide) && (
            <>
              <button
                type="button"
                className="ios-press mt-3 flex w-full items-center justify-between border-t border-white/10 pt-2.5 text-left"
                onClick={() => setAideOpen((v) => !v)}
                data-sleep-conseil-aide
              >
                <span className="text-[13px]" style={{ color: GRAY }}>
                  Pourquoi ce conseil ?
                </span>
                <ChevronRight className="h-4 w-4" style={{ color: GRAY }} />
              </button>
              {aideOpen ? (
                <div
                  className="mt-2 rounded-xl bg-black/35 px-3 py-2.5 text-[13px] leading-snug text-white/85"
                  data-sleep-conseil-aide-body
                >
                  {tip.aide ? <p>{tip.aide}</p> : null}
                  {(tip.id === 3 || tip.id === 5 || tip.id === 9) && (
                    <p className="mt-2" style={{ color: GRAY }}>
                      {LIGNE_PRO}
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
