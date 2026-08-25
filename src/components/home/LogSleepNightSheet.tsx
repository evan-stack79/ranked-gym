import { useEffect, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import { saveSleepNight } from '../../services/sleepStorage'

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

  const handleSave = () => {
    setError(null)
    const tst = Number(String(tstHours).replace(',', '.'))
    const saved = saveSleepNight({
      bedtime,
      waketime,
      tstHours: tst,
      dateKey: todayKey(),
    })
    if (!saved) {
      setError('Vérifie les horaires (HH:MM) et le TST (0–24 h).')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Enregistrer ma nuit"
      subtitle="Coucher, lever et temps de sommeil (TST)"
    >
      <div className="space-y-4 pb-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Coucher</span>
          <input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Lever</span>
          <input
            type="time"
            value={waketime}
            onChange={(e) => setWaketime(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            TST (heures de sommeil)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={tstHours}
            onChange={(e) => setTstHours(e.target.value)}
            placeholder="ex. 7.5"
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#5E5CE6]/40"
          />
        </label>

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
