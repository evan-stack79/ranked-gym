import { useEffect, useState } from 'react'
import {
  normalizeWaterGoalMl,
  setAccueilWaterGoalMl,
  saveAccueilWidgetPrefs,
  type AccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import { IosSheet } from '../ui/IosSheet'

interface WaterGoalSheetProps {
  open: boolean
  prefs: AccueilWidgetPrefs
  onClose: () => void
  onSave: (prefs: AccueilWidgetPrefs) => void
}

const PRESETS = [1500, 2000, 2500, 3000] as const

/**
 * Set / clear the Accueil water goal (stored in widget prefs only).
 * Never uses weight-based auto goals.
 */
export function WaterGoalSheet({ open, prefs, onClose, onSave }: WaterGoalSheetProps) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open) return
    const current = normalizeWaterGoalMl(prefs.waterGoalMl)
    setDraft(current != null ? String(current) : '')
  }, [open, prefs.waterGoalMl])

  const commit = (ml: number | null) => {
    const next = saveAccueilWidgetPrefs(setAccueilWaterGoalMl(prefs, ml, Date.now()))
    onSave(next)
    onClose()
  }

  const handleSave = () => {
    const parsed = draft.trim() === '' ? null : Number(draft.replace(',', '.'))
    commit(normalizeWaterGoalMl(parsed))
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Objectif d'eau"
      subtitle="Choisis un objectif journalier en ml — uniquement si tu en veux un."
      footer={
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="btn-brand ios-press min-h-11 w-full rounded-2xl border border-white/15 px-4 py-2.5 text-[15px] font-semibold text-white"
            data-accueil-water-goal-save
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => commit(null)}
            className="ios-press min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-[#AEAEB2]"
            data-accueil-water-goal-clear
          >
            Pas d&apos;objectif
          </button>
        </div>
      }
    >
      <label className="block px-1">
        <span className="text-[13px] font-medium text-[#AEAEB2]">Objectif (ml)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20000}
          step={50}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ex. 2500"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[17px] font-semibold tabular-nums text-white outline-none focus:border-[#0A84FF]/50"
          data-accueil-water-goal-input
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2 px-1">
        {PRESETS.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => setDraft(String(ml))}
            className="ios-press min-h-10 rounded-full border border-white/10 bg-white/5 px-3.5 text-[13px] font-semibold text-white"
            data-accueil-water-goal-preset={ml}
          >
            {ml} ml
          </button>
        ))}
      </div>

      <p className="mt-4 px-1 text-[12px] leading-snug text-[#8E8E93]">
        Sans objectif, la tuile affiche seulement le total du jour — pas d&apos;anneau.
      </p>
    </IosSheet>
  )
}
