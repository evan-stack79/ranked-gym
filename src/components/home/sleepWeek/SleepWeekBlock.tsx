import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { AIDE, LIGNE_PRO, etat, etatTexts } from '../../../sleep-week-engine'
import type { SleepNightEntry } from '../../../services/sleepStorage'
import { SLEEP_PANTHER_SRC } from '../sleepFeeling'
import type { SleepFeelingLevel } from '../../../services/sleepStorage'
import { ConseilLottie } from '../../conseil/ConseilLottie'
import { buildSleepWeekModel, fmtDurParts } from './sleepWeekModel'
import {
  SLEEP_WEEK_BAR_RECORDED,
  SLEEP_WEEK_BAR_SELECTED,
  SLEEP_WEEK_CHART_H_PX,
  barHeightPx,
  chartSlotKind,
  formatBarDurationLabel,
  nightsSurSeptLabel,
  repereBottomPx,
} from './sleepWeekChart'

const RED = '#ff0702'
const CARD = '#1C1C1E'
const GRAY = '#8E8E93'
const DAY_FILL = '#2C2C2E'
const DAY_OUTLINE = '#3A3A3C'

function PantherHeads({ half }: { half: number }) {
  const level = Math.min(5, Math.max(1, Math.round(half) || 3)) as SleepFeelingLevel
  const src = SLEEP_PANTHER_SRC[level]
  const full = Math.min(5, Math.max(0, Math.floor(half)))
  return (
    <span className="inline-flex items-center gap-0.5" data-sleep-week-heads>
      {([1, 2, 3, 4, 5] as const).map((lvl) => {
        const on = lvl <= full
        return (
          <img
            key={lvl}
            src={src}
            alt=""
            className="h-6 w-6 object-contain"
            style={
              on
                ? undefined
                : { opacity: 0.45, filter: 'grayscale(1) brightness(1.5)' }
            }
            data-sleep-week-head={on ? 'on' : 'off'}
          />
        )
      })}
    </span>
  )
}

/** Local calendar « today » — refreshed on foreground + midnight, never frozen at mount. */
function useLocalTodayMs(): number {
  const [todayMs, setTodayMs] = useState(() => Date.now())

  useEffect(() => {
    const bump = () => setTodayMs(Date.now())

    const onVis = () => {
      if (document.visibilityState !== 'hidden') bump()
    }
    document.addEventListener('visibilitychange', onVis)

    let removeApp: (() => void) | undefined
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) bump()
        })
        removeApp = () => {
          void handle.remove()
        }
      } catch {
        /* web */
      }
    })()

    const scheduleMidnight = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0)
      return window.setTimeout(() => {
        bump()
        midnightTimer = scheduleMidnight()
      }, Math.max(1_000, next.getTime() - now.getTime()))
    }
    let midnightTimer = scheduleMidnight()

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      removeApp?.()
      window.clearTimeout(midnightTimer)
    }
  }, [])

  return todayMs
}

interface SleepWeekBlockProps {
  nights: SleepNightEntry[]
  age: number
}

export function SleepWeekBlock({ nights, age }: SleepWeekBlockProps) {
  const reduced = usePrefersReducedMotion()
  const todayMs = useLocalTodayMs()
  const [weekOffset, setWeekOffset] = useState<0 | -1>(0)
  const model = useMemo(
    () =>
      buildSleepWeekModel(nights, age, {}, { now: new Date(todayMs), weekOffset }),
    [nights, age, todayMs, weekOffset],
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [appeared, setAppeared] = useState(reduced)
  const [aideOpen, setAideOpen] = useState(false)

  useEffect(() => {
    setSelected(null)
  }, [model.weekStart])

  const tip = useMemo(() => {
    // SCIENCE_12 : aucun conseil / profil d'état avant 5 nuits valides (y compris état 3).
    if (!model || model.provisional || model.validCount < 5) return null
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
  }, [model.weekStart, reduced])

  const hasAnyEntry = nights.length > 0
  if (!hasAnyEntry) return null

  const showAvgFigures = model.validCount > 0
  const parts = showAvgFigures ? fmtDurParts(model.avgMin ?? 0) : null
  const sub = nightsSurSeptLabel(model.validCount)
  const refBottom = repereBottomPx(model.Bb)

  return (
    <section className="mt-4 shrink-0 pb-2" data-sleep-week-block data-sleep-week-variant="bars-v2">
      <div className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[22px] font-extrabold tracking-tight text-white">Ta semaine</h2>
        <span className="text-[13px] font-semibold" style={{ color: GRAY }} data-sleep-week-range>
          {model.weekLabel}
        </span>
      </div>

      <div className="mb-2 flex items-center justify-end px-1">
        {weekOffset === 0 ? (
          <button
            type="button"
            className="ios-press inline-flex items-center gap-0.5 text-[13px] font-semibold"
            style={{ color: RED }}
            onClick={() => setWeekOffset(-1)}
            data-sleep-week-prev
          >
            Semaine dernière
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="ios-press inline-flex items-center gap-0.5 text-[13px] font-semibold"
            style={{ color: RED }}
            onClick={() => setWeekOffset(0)}
            data-sleep-week-current
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Cette semaine
          </button>
        )}
      </div>

      <div
        className="overflow-hidden rounded-[20px] px-3.5 pt-4"
        style={{ backgroundColor: CARD }}
        data-sleep-week-card
      >
        <div className="grid grid-cols-7 text-center">
          {model.days.map((d) => {
            const hasNight = d.durationMin != null && d.durationMin > 0
            const on = selected === d.index
            return (
              <button
                key={d.nightDateKey}
                type="button"
                className="ios-press flex flex-col items-center"
                onClick={() => {
                  if (!hasNight) return
                  setSelected((cur) => (cur === d.index ? null : d.index))
                }}
                data-sleep-week-day={d.index}
                data-sleep-week-day-state={on ? 'sel' : hasNight ? 'has' : 'no'}
                data-sleep-week-day-future={d.future ? '1' : '0'}
                style={{
                  opacity: appeared ? 1 : 0,
                  transform: appeared ? 'none' : 'translateY(6px)',
                  transition: reduced
                    ? undefined
                    : `opacity 360ms ${d.index * 60}ms, transform 360ms ${d.index * 60}ms`,
                }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
                  style={
                    on
                      ? { backgroundColor: RED, color: '#fff' }
                      : hasNight
                        ? { backgroundColor: DAY_FILL, color: '#D1D1D6' }
                        : {
                            backgroundColor: 'transparent',
                            color: GRAY,
                            border: `1.5px solid ${DAY_OUTLINE}`,
                          }
                  }
                >
                  {d.letter}
                </span>
                <span
                  className="mt-1 text-[11px] font-semibold tabular-nums"
                  style={{ color: on ? '#fff' : GRAY }}
                >
                  {d.dateNum}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-[18px] text-center">
          <p className="text-[13px] font-semibold" style={{ color: '#AEAEB2' }} data-sleep-week-title>
            Moyenne de la semaine
          </p>
          <p
            className="mt-1 flex items-baseline justify-center gap-1 tabular-nums leading-none text-white"
            style={{
              opacity: appeared ? 1 : 0,
              transition: reduced ? undefined : 'opacity 600ms 500ms',
            }}
            data-sleep-week-avg
          >
            {parts ? (
              <>
                <span className="text-[56px] font-extrabold tracking-tight">{parts.h}</span>
                <span className="mr-1.5 text-[26px] font-bold" style={{ color: GRAY }}>
                  h
                </span>
                <span className="text-[56px] font-extrabold tracking-tight">{parts.m}</span>
              </>
            ) : (
              <span className="text-[56px] font-extrabold tracking-tight" style={{ color: GRAY }}>
                —
              </span>
            )}
          </p>
          <p className="mt-1.5 text-[13px] font-semibold" style={{ color: GRAY }} data-sleep-week-sub>
            {sub}
          </p>
        </div>

        <div
          className="relative mt-[22px]"
          style={{ height: SLEEP_WEEK_CHART_H_PX }}
          data-sleep-week-chart
        >
          <div className="absolute inset-0 grid grid-cols-7">
            {model.days.map((d) => {
              // Future nights: empty (no bar / stub / fake figure). Past empty: dashed stub.
              const kind = chartSlotKind(d.durationMin, { future: d.future })
              const on = selected === d.index
              const hPx = kind === 'bar' ? barHeightPx(d.durationMin!) : 0
              return (
                <div key={d.nightDateKey} className="relative" data-sleep-week-col={d.index}>
                  {kind === 'empty' ? null : kind === 'stub' ? (
                    <div
                      className="absolute bottom-0 left-1/2 -ml-[11px] w-[22px] rounded-[5px]"
                      style={{
                        height: 10,
                        border: '1.5px dashed #48484A',
                        background: 'transparent',
                      }}
                      data-sleep-week-stub={d.index}
                    />
                  ) : (
                    <div
                      className="absolute bottom-0 left-1/2 -ml-[11px] w-[22px] rounded-[7px]"
                      style={{
                        height: hPx,
                        backgroundColor: on ? SLEEP_WEEK_BAR_SELECTED : SLEEP_WEEK_BAR_RECORDED,
                        opacity: appeared ? 1 : 0,
                        transition: reduced
                          ? undefined
                          : `height 700ms ${200 + d.index * 50}ms ease-out, opacity 400ms ${200 + d.index * 50}ms`,
                      }}
                      data-sleep-week-bar={d.index}
                      data-sleep-week-bar-sel={on ? '1' : '0'}
                    />
                  )}
                  {on && kind === 'bar' ? (
                    <div
                      className="absolute left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap px-0.5 text-[12px] font-bold tabular-nums"
                      style={{
                        bottom: hPx + 6,
                        backgroundColor: CARD,
                      }}
                      data-sleep-week-bar-val
                    >
                      {formatBarDurationLabel(d.durationMin!)}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div
            className="pointer-events-none absolute left-0 right-0 z-[1]"
            style={{
              bottom: refBottom,
              borderTop: '1.5px dashed #636366',
            }}
            data-sleep-week-repere-line
          />
        </div>

        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[11px] font-semibold"
          style={{ color: GRAY }}
          data-sleep-week-legend
        >
          <span className="inline-flex items-center gap-1.5">
            <i
              className="inline-block rounded-[3px]"
              style={{ height: 10, width: 10, backgroundColor: SLEEP_WEEK_BAR_RECORDED }}
              aria-hidden
            />
            Nuit notée
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i
              className="inline-block rounded-[3px]"
              style={{ height: 10, width: 10, border: '1.5px dashed #48484A' }}
              aria-hidden
            />
            Pas de nuit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i
              className="inline-block"
              style={{
                width: 14,
                height: 0,
                borderTop: '1.5px dashed #8E8E93',
              }}
              aria-hidden
            />
            Ton repère {model.repereHours}&nbsp;h
          </span>
        </div>

        <div
          className="mt-3.5 grid grid-cols-3 border-t"
          style={{ borderColor: '#2C2C2E', marginLeft: -14, marginRight: -14 }}
          data-sleep-week-fig
        >
          <div className="px-1 py-3.5 text-center">
            <div className="text-[12px] font-semibold" style={{ color: GRAY }}>
              Nuit (au lit)
            </div>
            <div className="mt-1.5 flex h-6 items-center justify-center text-[17px] font-bold tabular-nums text-white">
              {model.avgLabel}
            </div>
          </div>
          <div className="border-l px-1 py-3.5 text-center" style={{ borderColor: '#2C2C2E' }}>
            <div className="text-[12px] font-semibold" style={{ color: GRAY }}>
              Coucher
            </div>
            <div className="mt-1.5 flex h-6 items-center justify-center gap-1 text-[17px] font-bold tabular-nums text-white">
              <span className="text-[13px] font-semibold" style={{ color: GRAY }}>
                vers
              </span>
              {model.coucherLabel}
            </div>
          </div>
          <div className="border-l px-1 py-3.5 text-center" style={{ borderColor: '#2C2C2E' }}>
            <div className="text-[12px] font-semibold" style={{ color: GRAY }}>
              Ressenti
            </div>
            <div className="mt-1.5 flex h-6 items-center justify-center">
              {showAvgFigures ? <PantherHeads half={model.ressentiHalf} /> : (
                <span style={{ color: GRAY }}>—</span>
              )}
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
