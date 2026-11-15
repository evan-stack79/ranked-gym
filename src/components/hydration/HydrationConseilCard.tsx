import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  AIDE_02,
  AIDE_05,
  AIDE_07_ADULT,
  AIDE_07_MINOR,
  AIDE_07_PRIVACY,
  AIDE_07_SWAPS_ADULT,
  AIDE_07_SWAPS_MINOR,
  detectHydrationEtat,
  drinkRepereRange,
  estimatedTotalWaterRange,
  getEtatActions,
  getEtatTexte,
  getEtatTitle,
  type HydrationDay,
  type HydrationEtatInput,
  type HydrationSex,
} from '../../hydration-week-engine'
import { ConseilLottie } from '../conseil/ConseilLottie'

const RED = '#ff0702'
const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'

interface HydrationConseilCardProps {
  age: number
  sex: HydrationSex
  days: HydrationDay[]
  moduleHidden?: boolean
  caffeineDrinksToday?: number
  caffeineBreakdown?: Array<{ label: string; count: number }>
}

export function HydrationConseilCard({
  age,
  sex,
  days,
  moduleHidden = false,
  caffeineDrinksToday = 0,
  caffeineBreakdown = [],
}: HydrationConseilCardProps) {
  const [aideOpen, setAideOpen] = useState(false)
  const result = useMemo(() => {
    const input: HydrationEtatInput = {
      age,
      sex,
      days,
      moduleHidden,
    }
    return detectHydrationEtat(input)
  }, [age, sex, days, moduleHidden])

  if (!result || result.id < 1) return null
  const id = result.id
  const variant = result.variant
  const title = getEtatTitle(id)
  const texte = getEtatTexte(id)
  const actions = getEtatActions(id, variant).slice(0, 3)
  const showAide = id === 2 || id === 5 || id === 7
  const swaps =
    id === 7
      ? variant === 'minor'
        ? AIDE_07_SWAPS_MINOR
        : AIDE_07_SWAPS_ADULT
      : []

  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl px-3.5 py-3"
      style={{ backgroundColor: CARD }}
      data-hydration-conseil={id}
    >
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0">
          <ConseilLottie kind="hydration" etatId={id} className="h-14 w-14" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium" style={{ color: RED }}>
            Ton conseil de la semaine
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-white">{title}</p>
        </div>
      </div>
      <p className="mt-2 text-[14px] leading-snug text-white/90">{texte}</p>
      <ul className="mt-2 space-y-1.5">
        {actions.map((a) => (
          <li key={a} className="flex gap-2 text-[13px] text-white/85">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: RED }}
            />
            <span>{a}</span>
          </li>
        ))}
      </ul>
      {caffeineDrinksToday > 0 && id === 7 ? (
        <p className="mt-2 text-[13px]" style={{ color: GRAY }} data-hydration-caffeine>
          Caféine aujourd’hui : {caffeineDrinksToday} boisson
          {caffeineDrinksToday > 1 ? 's' : ''}
        </p>
      ) : null}
      {showAide ? (
        <>
          <button
            type="button"
            className="ios-press mt-3 flex w-full items-center justify-between border-t border-white/10 pt-2.5 text-left"
            onClick={() => setAideOpen((v) => !v)}
            data-hydration-conseil-aide
          >
            <span className="text-[13px]" style={{ color: GRAY }}>
              Pourquoi ce conseil ?
            </span>
            <ChevronRight className="h-4 w-4" style={{ color: GRAY }} />
          </button>
          {aideOpen ? (
            <div
              className="mt-2 space-y-2.5 rounded-xl bg-black/35 px-3 py-2.5 text-[13px] leading-snug text-white/85"
              data-hydration-conseil-aide-body
            >
              {id === 2 ? <p>{AIDE_02}</p> : null}
              {id === 5 ? <p>{AIDE_05}</p> : null}
              {id === 7 ? (
                <>
                  {caffeineDrinksToday > 0 ? (
                    <div className="rounded-xl bg-black/30 px-3 py-2.5" data-hydration-aide-caffeine>
                      <p className="text-[12px]" style={{ color: GRAY }}>
                        Caféine aujourd’hui
                      </p>
                      <p className="mt-0.5 text-[28px] font-bold tabular-nums leading-none text-white">
                        {caffeineDrinksToday} boisson{caffeineDrinksToday > 1 ? 's' : ''}
                      </p>
                      {caffeineBreakdown.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {caffeineBreakdown.map((row) => (
                            <li
                              key={row.label}
                              className="flex items-center justify-between text-[13px] text-white/85"
                            >
                              <span>{row.label}</span>
                              <span className="inline-flex gap-1">
                                {Array.from({ length: Math.min(8, row.count) }).map((_, i) => (
                                  <span
                                    key={i}
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: RED }}
                                  />
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <div>
                    <p className="text-[12px] font-medium" style={{ color: GRAY }}>
                      Un échange par jour, si tu veux
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {swaps.map((s) => (
                        <li key={`${s.from}-${s.to}`} className="text-[13px] text-white/85">
                          {s.from}{' '}
                          <span style={{ color: RED }} aria-hidden>
                            →
                          </span>{' '}
                          <span className="font-medium text-white">{s.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p>{variant === 'minor' ? AIDE_07_MINOR : AIDE_07_ADULT}</p>
                  <p className="text-[12px]" style={{ color: GRAY }}>
                    {AIDE_07_PRIVACY}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** Compact repère strip for the Eau card. */
export function HydrationRepereStrip({
  age,
  sex,
  drunkMl,
}: {
  age: number
  sex: HydrationSex
  drunkMl: number
}) {
  if (age > 0 && age < 15) return null
  const ageSafe = age > 0 ? age : 30
  const repere = drinkRepereRange(ageSafe, sex)
  const total = estimatedTotalWaterRange(drunkMl / 1000)
  const fmt = (n: number) => n.toFixed(1).replace('.', ',')
  const rangeLabel =
    Math.abs(repere.highL - repere.lowL) < 0.05
      ? `au moins ${fmt(repere.lowL)} L`
      : `environ ${fmt(repere.lowL)} à ${fmt(repere.highL)} L`
  return (
    <div className="mt-2 space-y-1" data-hydration-repere>
      <p className="text-[13px] text-white">
        <span style={{ color: GRAY }}>Ton repère du jour </span>
        <span className="font-semibold">{rangeLabel}</span>
      </p>
      <p className="text-[12px]" style={{ color: GRAY }}>
        Eau totale estimée : environ {fmt(total.lowL)} à {fmt(total.highL)}&nbsp;L
      </p>
      <p className="text-[11px]" style={{ color: GRAY }}>
        C’est une estimation : tes autres boissons et tes repas apportent aussi de l’eau.
      </p>
    </div>
  )
}
