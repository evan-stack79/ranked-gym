import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import { IosSheet } from '../ui/IosSheet'
import {
  BOTTLE_CAPACITY_ML,
  clampBottleRemainingMl,
  consumedOnBottleToRemainingMl,
} from '../../utils/deriveBottleProgress'
import { WATER_BOTTLE_CAPACITY_ML } from '../../services/nutritionStorage'

const CAP = WATER_BOTTLE_CAPACITY_ML

const SHORTCUTS = [
  { label: 'Vide', remainingMl: 0 },
  { label: '500 ml', remainingMl: 500 },
  { label: '1 L', remainingMl: 1000 },
  { label: 'Pleine', remainingMl: CAP },
] as const

function formatRemaining(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(1).replace('.', ',')} L`
  }
  return `${ml} ml`
}

interface BottleCalibrationSheetProps {
  open: boolean
  initialRemainingMl: number
  isCalibrated: boolean
  onClose: () => void
  onSave: (remainingMl: number) => void
  onClearCalibration: () => void
}

export function BottleCalibrationSheet({
  open,
  initialRemainingMl,
  isCalibrated,
  onClose,
  onSave,
  onClearCalibration,
}: BottleCalibrationSheetProps) {
  const [draftRemaining, setDraftRemaining] = useState(initialRemainingMl)

  useEffect(() => {
    if (open) {
      setDraftRemaining(clampBottleRemainingMl(initialRemainingMl, CAP))
    }
  }, [open, initialRemainingMl])

  const safeRemaining = clampBottleRemainingMl(draftRemaining, CAP)

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Niveau actuel de ma bouteille"
      subtitle="Ce réglage modifie seulement l’affichage, pas la quantité d’eau enregistrée."
      leading={<Droplets className="mt-0.5 h-5 w-5 shrink-0 text-[#7DD3FC]" strokeWidth={1.75} />}
    >
      <div className="space-y-5 pb-3">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
          <p className="text-center text-[13px] text-[#8E8E93]">Liquide restant dans la bouteille</p>
          <p className="text-[32px] font-bold tabular-nums tracking-tight text-white">
            {formatRemaining(safeRemaining)}
          </p>

          <div className="flex h-[200px] w-full max-w-[120px] items-center justify-center">
            <input
              type="range"
              min={0}
              max={CAP}
              step={10}
              value={safeRemaining}
              onChange={(e) => setDraftRemaining(Number(e.target.value))}
              className="water-bottle-range h-[180px] w-11 min-h-[44px] cursor-pointer accent-[#38BDF8]"
              aria-label="Niveau restant dans la bouteille"
              aria-valuemin={0}
              aria-valuemax={CAP}
              aria-valuenow={safeRemaining}
            />
          </div>

          <div className="flex w-full justify-between text-[11px] font-medium tabular-nums text-[#636366]">
            <span>Vide</span>
            <span>Pleine</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHORTCUTS.map((shortcut) => {
            const selected = safeRemaining === shortcut.remainingMl
            return (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => setDraftRemaining(shortcut.remainingMl)}
                className={`ios-press min-h-11 rounded-xl border px-3 py-2.5 text-[13px] font-semibold ${
                  selected
                    ? 'border-[#38BDF8]/45 bg-[#38BDF8]/15 text-[#7DD3FC]'
                    : 'border-white/10 bg-white/[0.05] text-[#AEAEB2]'
                }`}
              >
                {shortcut.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onSave(safeRemaining)}
            className="ios-press min-h-11 w-full rounded-xl border border-[#38BDF8]/40 bg-[#38BDF8]/20 px-4 py-3 text-[15px] font-semibold text-white"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ios-press min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] font-medium text-[#AEAEB2]"
          >
            Annuler
          </button>
          {isCalibrated ? (
            <button
              type="button"
              onClick={onClearCalibration}
              className="ios-press min-h-11 w-full rounded-xl px-4 py-3 text-[13px] font-medium text-[#8E8E93] underline-offset-2 hover:underline"
            >
              Revenir au suivi automatique
            </button>
          ) : null}
        </div>
      </div>
    </IosSheet>
  )
}

/** Utilitaire test / affichage : ml restants depuis le niveau stocké (ml bus). */
export function remainingFromStoredLevel(levelMl: number): number {
  return consumedOnBottleToRemainingMl(levelMl, BOTTLE_CAPACITY_ML)
}
