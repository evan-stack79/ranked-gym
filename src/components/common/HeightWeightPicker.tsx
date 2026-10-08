import { useMemo, useState } from 'react'
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  KG_PER_LB,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  clampHeightCm,
  clampWeightKg,
  kgToLbDisplay,
  lbToKgStorage,
  sanitizeHeightCm,
  sanitizeWeightKg,
} from '../../services/nutritionSafetyRules'
import { NumberWheel } from './NumberWheel'

export type WeightUnit = 'kg' | 'lb'

export interface HeightWeightValue {
  /** Always kg in storage units, or null when empty. */
  weightKg: number | null
  /** Always cm, or null when empty. */
  heightCm: number | null
}

export interface HeightWeightPickerProps {
  value: HeightWeightValue
  onChange: (next: HeightWeightValue) => void
  /** Called when user taps Continuer with valid (non-null) values. */
  onSave?: (next: { weightKg: number; heightCm: number }) => void
  /** Called when user taps « Plus tard » — must save nothing. */
  onSkip?: () => void
  /** Called when user taps « Effacer » (profile mode). */
  onErase?: () => void
  /** Show confirmation « C'est noté. » after save. */
  confirmMessage?: string | null
  /** Profile mode: show Effacer when values present. */
  allowErase?: boolean
  /** Hide title/sentence (embed in a denser screen). */
  compact?: boolean
  className?: string
}

const LB_MIN = Math.ceil(WEIGHT_KG_MIN / KG_PER_LB)
const LB_MAX = Math.floor(WEIGHT_KG_MAX / KG_PER_LB)

/**
 * Shared taille + poids picker with rolling wheels, kg/lb toggle, skip & erase.
 * Storage is always kg/cm; lb is display-only and never drifts the stored kg.
 */
export function HeightWeightPicker({
  value,
  onChange,
  onSave,
  onSkip,
  onErase,
  confirmMessage = null,
  allowErase = false,
  compact = false,
  className = '',
}: HeightWeightPickerProps) {
  const [unit, setUnit] = useState<WeightUnit>('kg')
  const [activeField, setActiveField] = useState<'weight' | 'height'>('weight')

  const weightKg = sanitizeWeightKg(value.weightKg)
  const heightCm = sanitizeHeightCm(value.heightCm)

  const weightDisplay = useMemo(() => {
    if (weightKg == null) return null
    return unit === 'kg' ? Math.round(weightKg) : kgToLbDisplay(weightKg)
  }, [weightKg, unit])

  const weightWheelMin = unit === 'kg' ? WEIGHT_KG_MIN : LB_MIN
  const weightWheelMax = unit === 'kg' ? WEIGHT_KG_MAX : LB_MAX

  const handleWeightDisplayChange = (display: number | null) => {
    if (display == null) {
      onChange({ weightKg: null, heightCm })
      return
    }
    const nextKg =
      unit === 'kg' ? clampWeightKg(display) : clampWeightKg(lbToKgStorage(display))
    // Keep exact stored kg when toggling didn't change the snapped display.
    if (weightKg != null) {
      const sameDisplay =
        unit === 'kg'
          ? Math.round(weightKg) === Math.round(nextKg)
          : kgToLbDisplay(weightKg) === display
      if (sameDisplay) {
        onChange({ weightKg, heightCm })
        return
      }
    }
    onChange({ weightKg: nextKg, heightCm })
  }

  const handleHeightChange = (cm: number | null) => {
    onChange({
      weightKg,
      heightCm: cm == null ? null : clampHeightCm(cm),
    })
  }

  const canSave = weightKg != null && heightCm != null
  const hasAny = weightKg != null || heightCm != null

  if (confirmMessage) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}
        data-testid="height-weight-noted"
      >
        <p className="text-[22px] font-semibold text-white">{confirmMessage}</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`} data-testid="height-weight-picker">
      {!compact ? (
        <div className="space-y-2">
          <h2 className="text-[22px] font-bold tracking-tight text-white">
            Ta taille et ton poids
          </h2>
          <p className="text-[14px] leading-relaxed text-[#AEAEB2]">
            On s&apos;en sert seulement pour estimer ce que ton corps dépense au repos. Personne
            d&apos;autre ne les voit. Tu peux les changer ou les effacer quand tu veux dans Profil.
          </p>
        </div>
      ) : null}

      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
        {(
          [
            { id: 'weight' as const, label: 'Poids' },
            { id: 'height' as const, label: 'Taille' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveField(tab.id)}
            className={`ios-press flex-1 rounded-lg py-2 text-[13px] font-semibold ${
              activeField === tab.id ? 'bg-white text-black' : 'text-[#8E8E93]'
            }`}
            data-testid={`height-weight-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeField === 'weight' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {(
              [
                { id: 'kg' as const, label: 'kg' },
                { id: 'lb' as const, label: 'lb' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUnit(opt.id)}
                className={`ios-press flex-1 rounded-lg py-1.5 text-[13px] font-semibold ${
                  unit === opt.id ? 'bg-brand text-white' : 'text-[#8E8E93]'
                }`}
                data-testid={`weight-unit-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <NumberWheel
            min={weightWheelMin}
            max={weightWheelMax}
            step={1}
            value={weightDisplay}
            onChange={handleWeightDisplayChange}
            unit={unit}
            aria-label={`Poids en ${unit}`}
            validateParsed={(display) => {
              // Bounds always validated in kg (lb is display-only).
              const kg = unit === 'kg' ? display : lbToKgStorage(display)
              return sanitizeWeightKg(kg) != null
            }}
          />
          <p className="text-center text-[12px] text-[#636366]">
            {weightKg == null
              ? 'Fais glisser ou tape pour choisir'
              : unit === 'lb'
                ? `${kgToLbDisplay(weightKg)} lb`
                : Number.isInteger(weightKg)
                  ? `${weightKg} kg`
                  : `${weightKg.toFixed(1).replace(/\.0$/, '')} kg`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <NumberWheel
            min={HEIGHT_CM_MIN}
            max={HEIGHT_CM_MAX}
            step={1}
            value={heightCm == null ? null : Math.round(heightCm)}
            onChange={handleHeightChange}
            unit="cm"
            aria-label="Taille en cm"
            validateParsed={(cm) => sanitizeHeightCm(cm) != null}
          />
          <p className="text-center text-[12px] text-[#636366]">
            {heightCm == null ? 'Fais glisser ou tape pour choisir' : `${Math.round(heightCm)} cm`}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        {onSave ? (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave || weightKg == null || heightCm == null) return
              onSave({ weightKg, heightCm })
            }}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
            data-testid="height-weight-continue"
          >
            Continuer
          </button>
        ) : null}

        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="ios-press w-full py-2.5 text-[14px] font-medium text-[#8E8E93]"
            data-testid="height-weight-later"
          >
            Plus tard
          </button>
        ) : null}

        {allowErase && hasAny && onErase ? (
          <button
            type="button"
            onClick={onErase}
            className="ios-press w-full py-2.5 text-[14px] font-semibold text-[#FF6961]"
            data-testid="height-weight-erase"
          >
            Effacer
          </button>
        ) : null}
      </div>
    </div>
  )
}
