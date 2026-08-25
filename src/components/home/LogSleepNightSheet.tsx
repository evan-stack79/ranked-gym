import { useEffect, useMemo, useState } from 'react'
import { computeTibHours } from '../../sleep-engine'
import { IosSheet } from '../ui/IosSheet'
import { saveSleepNight } from '../../services/sleepStorage'
import { formatTstHoursLabel } from '../../services/sleepEngineAdapter'

interface LogSleepNightSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function LogSleepNightSheet({ open, onClose, onSaved }: LogSleepNightSheetProps) {
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')
  const [tstHours, setTstHours] = useState('8')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBedtime('23:00')
    setWaketime('07:00')
    setTstHours('8')
    setError(null)
  }, [open])

  const tibHours = useMemo(() => computeTibHours(bedtime, waketime), [bedtime, waketime])
  const tibLabel = tibHours != null && tibHours > 0 ? formatTstHoursLabel(tibHours) : null

  const handleSave = () => {
    setError(null)
    const tst = Number(String(tstHours).replace(',', '.'))

    if (!Number.isFinite(tst) || tst < 0 || tst > 24) {
      setError('Indique un temps réellement dormi (TST) entre 0 et 24 h.')
      return
    }
    if (tibHours == null || tibHours <= 0) {
      setError('Horaires de coucher / lever invalides.')
      return
    }
    if (tst > tibHours + 1e-6) {
      setError(
        `Le temps réellement dormi (TST) ne peut pas dépasser le temps au lit (${tibLabel}).`,
      )
      return
    }

    const saved = saveSleepNight({
      bedtime,
      waketime,
      tstHours: tst,
      dateKey: todayKey(),
    })
    if (!saved) {
      setError('Impossible d’enregistrer — vérifie les horaires et le TST (≤ temps au lit).')
      return
    }
    // Fermer d’abord pour libérer le scroll lock, puis rafraîchir la carte.
    onClose()
    queueMicrotask(() => onSaved())
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Enregistrer ma nuit"
      subtitle="Coucher, lever, puis temps réellement dormi"
    >
      <div className="space-y-4 pb-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            Heure du coucher
          </span>
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
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            Heure du lever
          </span>
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

        <div className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-[#8E8E93]">Temps au lit</p>
          <p className="mt-1 text-[20px] font-bold tabular-nums text-white">
            {tibLabel ?? '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#636366]">Calculé automatiquement (TIB)</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            Temps réellement dormi (TST)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={tstHours}
              onChange={(e) => {
                setTstHours(e.target.value)
                setError(null)
              }}
              placeholder="ex. 7.5"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
            />
            <span className="shrink-0 text-[13px] text-[#8E8E93]">heures</span>
          </div>
        </label>

        <p className="text-[12px] leading-relaxed text-[#AEAEB2]">
          Le temps au lit est calculé entre ton coucher et ton lever. Le temps réellement dormi
          peut être inférieur si tu as mis du temps à t&apos;endormir ou été réveillé pendant la
          nuit.
        </p>

        {error && <p className="text-[13px] text-[#FF6961]">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          className="ios-press w-full rounded-2xl bg-[#5E5CE6] px-4 py-3.5 text-[15px] font-semibold text-white"
        >
          Enregistrer
        </button>

        <p className="text-[11px] leading-relaxed text-[#636366]">
          Pas de score médical, pas de stades REM/profond. Seulement ce que tu saisis.
        </p>
      </div>
    </IosSheet>
  )
}
