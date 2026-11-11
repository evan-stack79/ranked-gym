import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  getSleepNightByDateKey,
  saveSleepFeeling,
  type SleepFeelingLevel,
  type SleepNightEntry,
} from '../../services/sleepStorage'
import { computeTibHours } from '../../sleep-engine'
import {
  formatClockHm,
  formatDurationHoursLabel,
  formatNightRangeLabel,
} from '../../utils/sleepTimeFormat'
import { LogSleepNightSheet } from './LogSleepNightSheet'
import { SLEEP_FEELING_LABELS, SLEEP_PANTHER_SRC } from './sleepFeeling'

const RED = '#ff0702'

export { SLEEP_FEELING_LABELS, SLEEP_PANTHER_SRC } from './sleepFeeling'

interface MorningSleepModalProps {
  open: boolean
  night: SleepNightEntry | null
  onClose: () => void
  onDone: () => void
}

/**
 * « Tu as bien dormi ? » — ressenti 1–5, facultatif.
 * Pas de score, pas de points, pas de message médical.
 */
export function MorningSleepModal({ open, night, onClose, onDone }: MorningSleepModalProps) {
  const reduced = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [level, setLevel] = useState<SleepFeelingLevel>(4)
  const [correctOpen, setCorrectOpen] = useState(false)
  const [nightLocal, setNightLocal] = useState<SleepNightEntry | null>(night)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setLevel((night?.feelingLevel as SleepFeelingLevel) || 4)
      setNightLocal(night)
      setCorrectOpen(false)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : 280)
    return () => window.clearTimeout(t)
  }, [open, night, reduced])

  useEffect(() => {
    if (!open) return
    return acquireBodyScrollLock()
  }, [open])

  const summary = useMemo(() => {
    const n = nightLocal
    if (!n) return null
    const tib = computeTibHours(n.bedtime, n.waketime)
    const tibLabel = tib != null ? formatDurationHoursLabel(tib) : '—'
    return {
      range: formatNightRangeLabel(n.bedtime, n.waketime),
      tibLabel,
      bed: formatClockHm(n.bedtime),
      wake: formatClockHm(n.waketime),
    }
  }, [nightLocal])

  if (!mounted || typeof document === 'undefined') return null

  const finish = (feeling: SleepFeelingLevel | null) => {
    if (nightLocal && feeling != null) {
      saveSleepFeeling(nightLocal.dateKey, feeling)
    }
    onClose()
    queueMicrotask(() => onDone())
  }

  const ui = (
    <div
      className={`fixed inset-0 flex h-[100dvh] w-screen flex-col ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${correctOpen ? 'z-[90]' : 'z-[120]'}`}
      style={{
        background: 'linear-gradient(180deg, #5A0504 0%, #1A0000 42%, #000000 100%)',
        transition: reduced ? undefined : 'opacity 220ms ease',
        paddingTop: 'var(--app-safe-area-top, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-sleep-title"
      data-morning-sleep-modal
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-3">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C7C7CC]">
            Ce matin
          </p>
          <button
            type="button"
            onClick={() => finish(null)}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <h1
          id="morning-sleep-title"
          className="mt-4 text-[28px] font-bold leading-tight tracking-tight text-white"
        >
          Tu as bien dormi ?
        </h1>
        <p className="mt-1.5 text-[13px] text-[#C7C7CC]">Facultatif · visible par toi seul(e)</p>

        <div className="mt-6 flex flex-1 flex-col items-center justify-center">
          <img
            key={level}
            src={SLEEP_PANTHER_SRC[level]}
            alt=""
            className="h-40 w-40 object-contain"
            style={{
              transition: reduced ? undefined : 'opacity 180ms ease',
            }}
            data-sleep-feeling-panther={level}
          />
          <p className="mt-3 text-[18px] font-semibold text-white" data-sleep-feeling-label>
            {SLEEP_FEELING_LABELS[level]}
          </p>

          <div className="mt-6 w-full max-w-sm px-2">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as SleepFeelingLevel)}
              className="sleep-feeling-slider w-full"
              aria-label="Ressenti de la nuit"
              data-sleep-feeling-slider
              style={
                {
                  '--sleep-slider-pct': `${((level - 1) / 4) * 100}%`,
                } as CSSProperties
              }
            />
            <div className="mt-2 flex justify-between text-[11px] text-[#8E8E93]">
              <span>Très mal</span>
              <span>Très bien</span>
            </div>
          </div>

          {summary ? (
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-[13px] text-white">
              <Check className="inline h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Nuit notée · {summary.range} · {summary.tibLabel}
              </span>
              <button
                type="button"
                onClick={() => setCorrectOpen(true)}
                className="ios-press font-semibold"
                style={{ color: RED }}
                data-sleep-corriger
              >
                Corriger
              </button>
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-3 pb-2 pt-4">
          <button
            type="button"
            onClick={() => finish(level)}
            className="ios-press w-full rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white"
            style={{ backgroundColor: RED }}
            data-sleep-morning-valider
          >
            Valider
          </button>
          <button
            type="button"
            onClick={() => finish(null)}
            className="ios-press w-full py-2 text-[15px] font-medium text-[#E5E5EA]"
            data-sleep-morning-passer
          >
            Passer
          </button>
        </div>
      </div>

      <LogSleepNightSheet
        open={correctOpen}
        onClose={() => setCorrectOpen(false)}
        onSaved={() => {
          if (nightLocal?.dateKey) {
            setNightLocal(getSleepNightByDateKey(nightLocal.dateKey))
          }
          setCorrectOpen(false)
        }}
        initial={nightLocal}
        dateKey={nightLocal?.dateKey}
      />
    </div>
  )

  return createPortal(ui, document.body)
}
