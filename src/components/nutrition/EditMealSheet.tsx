import { useEffect, useState } from 'react'
import type { MealEntry, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import { IosSheet } from '../ui/IosSheet'
import { ClearableNumberInput } from './ClearableNumberInput'

interface EditMealSheetProps {
  open: boolean
  meal: MealEntry | null
  onClose: () => void
  onSave: (mealId: string, patch: Partial<MealEntry>) => void
  onDelete: (mealId: string) => void
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function EditMealSheet({ open, meal, onClose, onSave, onDelete }: EditMealSheetProps) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [calories, setCalories] = useState<number | null>(0)
  const [proteinG, setProteinG] = useState<number | null>(null)
  const [carbsG, setCarbsG] = useState<number | null>(null)
  const [fatG, setFatG] = useState<number | null>(null)
  const [grams, setGrams] = useState<number | null>(null)

  useEffect(() => {
    if (!meal) return
    setName(meal.name)
    setMealType(meal.mealType)
    setCalories(meal.calories)
    setProteinG(meal.proteinG ?? null)
    setCarbsG(meal.carbsG ?? null)
    setFatG(meal.fatG ?? null)
    setGrams(meal.grams ?? null)
  }, [meal])

  if (!meal) return null

  const canSave = name.trim().length > 0 && calories != null && calories > 0

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Modifier l’aliment"
      subtitle="Change le repas, les calories ou les grammes"
    >
      <div className="space-y-4 pb-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Nom</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#34C759]/40"
          />
        </label>

        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-[#8E8E93]">Repas</p>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                  mealType === type
                    ? 'border-[#34C759]/45 bg-[#34C759]/20 text-[#30D158]'
                    : 'border-white/10 bg-black/25 text-[#8E8E93]'
                }`}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Calories</span>
            <ClearableNumberInput
              value={calories}
              onChange={setCalories}
              min={1}
              max={5000}
              aria-label="Calories"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Grammes</span>
            <ClearableNumberInput
              value={grams}
              onChange={setGrams}
              min={0.01}
              max={5000}
              step={0.01}
              required={false}
              placeholder="Optionnel"
              placeholderClassName="pointer-events-none absolute inset-0 flex items-center px-3.5 text-[15px] text-[#636366]"
              aria-label="Grammes"
              className="relative z-[1] w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Protéines</span>
            <ClearableNumberInput
              value={proteinG}
              onChange={setProteinG}
              min={0}
              max={400}
              step={0.1}
              required={false}
              placeholder="—"
              placeholderClassName="pointer-events-none absolute inset-0 flex items-center px-3.5 text-[15px] text-[#636366]"
              aria-label="Protéines"
              className="relative z-[1] w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Glucides</span>
            <ClearableNumberInput
              value={carbsG}
              onChange={setCarbsG}
              min={0}
              max={400}
              step={0.1}
              required={false}
              placeholder="—"
              placeholderClassName="pointer-events-none absolute inset-0 flex items-center px-3.5 text-[15px] text-[#636366]"
              aria-label="Glucides"
              className="relative z-[1] w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Lipides</span>
            <ClearableNumberInput
              value={fatG}
              onChange={setFatG}
              min={0}
              max={400}
              step={0.1}
              required={false}
              placeholder="—"
              placeholderClassName="pointer-events-none absolute inset-0 flex items-center px-3.5 text-[15px] text-[#636366]"
              aria-label="Lipides"
              className="relative z-[1] w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave || calories == null) return
            onSave(meal.id, {
              name: name.trim(),
              mealType,
              calories: Math.round(calories),
              proteinG: proteinG ?? undefined,
              carbsG: carbsG ?? undefined,
              fatG: fatG ?? undefined,
              grams: grams ?? undefined,
            })
          }}
          className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
        >
          Enregistrer
        </button>

        <button
          type="button"
          onClick={() => onDelete(meal.id)}
          className="ios-press w-full rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/10 py-3 text-[14px] font-semibold text-[#FF6961]"
        >
          Supprimer
        </button>
      </div>
    </IosSheet>
  )
}
