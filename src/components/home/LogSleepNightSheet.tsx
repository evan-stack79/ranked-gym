import { useEffect, useMemo, useState } from 'react'
import { computeTibHours } from '../../sleep-engine'
import { formatTstHoursLabel } from '../../services/sleepEngineAdapter'
import { saveSleepNight, type SleepNightEntry } from '../../services/sleepStorage'
import { IosSheet } from '../ui/IosSheet'

interface LogSleepNightSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Prefill when editing an existing night */
  initial?: SleepNightEntry | null
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Saisie simplifiée : coucher + lever (TIB auto).
 * TST facultatif (« Je ne sais pas ») — jamais déduit du TIB.
 */
export function LogSleepNightSheet({ open, onClose, onSaved, initial }: LogSleepNightSheetProps) {
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')
  const [tstKnown, setTstKnown] = useState(false)
  const [tstHoursPart, setTstHoursPart] = useState('7')
  const [tstMinutesPart, setTstMinutesPart] = useState('0')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setBedtime(initial.bedtime)
      setWaketime(initial.waketime)
      if (initial.tstHours == null) {
        setTstKnown(false)
        setTstHoursPart('7')
        setTstMinutesPart('0')
      } else {
        setTstKnown(true)
        const h = Math.floor(initial.tstHours)
        const m = Math.round((initial.tstHours - h) * 60)
        setTstHoursPart(String(h))
        setTstMinutesPart(String(m))
      }
    } else {
      setBedtime('23:00')
      setWaketime('07:00')
      setTstKnown(false)
      setTstHoursPart('7')
      setTstMinutesPart('0')
    }
    setError(null)
  }, [open, initial])

  const tibHours = useMemo(() => computeTibHours(bedtime, waketime), [bedtime, waketime])
  const tibLabel = tibHours != null && tibHours > 0 ? formatTstHoursLabel(tibHours) : null

  const tstPreview = useMemo(() => {
    if (!tstKnown) return null
    const h = Number(tstHoursPart)
    const m = Number(tstMinutesPart)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m >= 60) return null
    return round1(h + m / 60)
  }, [tstKnown, tstHoursPart, tstMinutesPart])

  const handleSave = () => {
    setError(null)

    if (tibHours == null || tibHours <= 0) {
      setError('Indique l’heure de coucher et l’heure de lever.')
      return
    }

    let tstHours: number | null = null
    if (tstKnown) {
      if (tstPreview == null) {
        setError('Indique le temps réellement dormi, ou choisis « Je ne sais pas ».')
        return
      }
      if (tstPreview > tibHours + 1e-6) {
        setError(
          `Le temps réellement dormi ne peut pas dépasser le temps au lit (${tibLabel}).`,
        )
        return
      }
      tstHours = tstPreview
    }

    const saved = saveSleepNight({
      bedtime,
      waketime,
      tstHours,
      dateKey: initial?.dateKey ?? todayKey(),
    })
    if (!saved) {
      setError('Impossible d’enregistrer — vérifie les horaires (et le TST ≤ temps au lit).')
      return
    }
    onClose()
    queueMicrotask(() => onSaved())
  }

  return (
    <IosSheet open={open} onClose={onClose} title="Comment s’est passée ta nuit ?">
      <div className="space-y-4 pb-2">
        <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
          Indique seulement coucher et lever — le temps au lit est calculé automatiquement.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Coucher</span>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => {
                setBedtime(e.target.value)
                setError(null)
              }}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Lever</span>
            <input
              type="time"
              value={waketime}
              onChange={(e) => {
                setWaketime(e.target.value)
                setError(null)
              }}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
            />
          </label>
        </div>

        <p className="text-center text-[18px] font-bold tabular-nums text-white">
          {tibLabel ? `${tibLabel} au lit` : '—'}
        </p>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Temps réellement dormi</p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTstKnown(true)
                setError(null)
              }}
              className={`ios-press flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
                tstKnown
                  ? 'bg-[#5E5CE6] text-white'
                  : 'border border-white/12 bg-white/5 text-[#AEAEB2]'
              }`}
            >
              Je sais
            </button>
            <button
              type="button"
              onClick={() => {
                setTstKnown(false)
                setError(null)
              }}
              className={`ios-press flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
                !tstKnown
                  ? 'bg-[#5E5CE6] text-white'
                  : 'border border-white/12 bg-white/5 text-[#AEAEB2]'
              }`}
            >
              Je ne sais pas
            </button>
          </div>

          {tstKnown ? (
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="mb-1 block text-[11px] text-[#636366]">Heures</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  step={1}
                  value={tstHoursPart}
                  onChange={(e) => {
                    setTstHoursPart(e.target.value)
                    setError(null)
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
                />
              </label>
              <span className="pb-3 text-[13px] text-[#8E8E93]">h</span>
              <label className="block flex-1">
                <span className="mb-1 block text-[11px] text-[#636366]">Minutes</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={tstMinutesPart}
                  onChange={(e) => {
                    setTstMinutesPart(e.target.value)
                    setError(null)
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
                />
              </label>
              <span className="pb-3 text-[13px] text-[#8E8E93]">min</span>
            </div>
          ) : (
            <p className="rounded-xl border border-white/8 bg-black/25 px-3.5 py-3 text-[13px] leading-relaxed text-[#AEAEB2]">
              Temps réellement dormi : inconnu — on enregistre le temps au lit sans inventer
              d&apos;heures dormies.
            </p>
          )}
        </div>

        {error && <p className="text-[13px] text-[#FF6961]">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          className="ios-press w-full rounded-2xl bg-[#5E5CE6] px-4 py-3.5 text-[15px] font-semibold text-white"
        >
          Enregistrer
        </button>

        <p className="text-[11px] leading-relaxed text-[#636366]">
          Pas de score médical. Le TST n&apos;est jamais déduit du temps au lit.
        </p>
      </div>
    </IosSheet>
  )
}
