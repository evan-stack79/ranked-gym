import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Coffee,
  Moon,
  Plus,
  Sun,
  Cookie,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import type { MealEntry, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import {
  addMealToToday,
  getTodayJournal,
  removeMealFromToday,
} from '../../services/nutritionStorage'
import { IconBadge } from '../ui/IconBadge'
import { MacroRing } from './MacroRing'

interface MealJournalProps {
  targetCalories: number
}

const MEAL_META: Record<
  MealType,
  { icon: typeof Coffee; accent: 'orange' | 'crimson' | 'violet' | 'blue'; glow: string }
> = {
  breakfast: { icon: Coffee, accent: 'orange', glow: '#FF9F0A' },
  lunch: { icon: Sun, accent: 'crimson', glow: '#FF2B2B' },
  dinner: { icon: Moon, accent: 'violet', glow: '#BF5AF2' },
  snack: { icon: Cookie, accent: 'blue', glow: '#00B4FF' },
}

function MealTypeChip({
  type,
  active,
  onClick,
}: {
  type: MealType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
        active
          ? 'border-[#34C759]/45 bg-[#34C759]/20 text-[#30D158]'
          : 'border-white/10 bg-black/25 text-[#8E8E93]'
      }`}
    >
      {MEAL_TYPE_LABELS[type]}
    </button>
  )
}

export function MealJournal({ targetCalories }: MealJournalProps) {
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState(350)
  const [proteinG, setProteinG] = useState<number | ''>('')
  const [mealType, setMealType] = useState<MealType>('lunch')

  useEffect(() => {
    setMeals(getTodayJournal().meals)
    setHydrated(true)
  }, [])

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + (meal.proteinG ?? 0),
        carbs: acc.carbs + (meal.carbsG ?? 0),
        fat: acc.fat + (meal.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [meals])

  const progress = targetCalories > 0 ? totals.calories / targetCalories : 0
  const remaining = Math.max(0, targetCalories - totals.calories)

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || calories <= 0) return

    const journal = addMealToToday({
      name: trimmed,
      mealType,
      calories: Math.round(calories),
      proteinG: proteinG === '' ? undefined : Number(proteinG),
    })
    setMeals(journal.meals)
    setName('')
    setCalories(350)
    setProteinG('')
    setShowForm(false)
  }

  const handleRemove = (id: string) => {
    const journal = removeMealFromToday(id)
    setMeals(journal.meals)
  }

  if (!hydrated) return null

  return (
    <section className="space-y-4">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 90% 0%, rgb(255 159 10 / 0.2) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 0% 100%, rgb(255 43 43 / 0.14) 0%, transparent 55%), rgb(28 28 30 / 0.9)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 12px 40px rgb(0 0 0 / 0.3)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBadge icon={UtensilsCrossed} variant="orange" size="sm" />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Journal
              </p>
              <h2 className="text-[20px] font-bold tracking-tight text-white">Repas du jour</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-brand inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        <div className="flex items-center gap-5">
          <MacroRing
            progress={progress}
            size={100}
            stroke={9}
            color={progress > 1 ? '#FF2B2B' : '#FF9F0A'}
          >
            <p className="text-[20px] font-black text-white">{Math.round(progress * 100)}%</p>
            <p className="text-[10px] text-[#8E8E93]">objectif</p>
          </MacroRing>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[28px] font-black tracking-tight text-white">
                {totals.calories}
                <span className="ml-1 text-[14px] font-semibold text-[#8E8E93]">
                  / {targetCalories} kcal
                </span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/40">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  background:
                    progress > 1
                      ? 'linear-gradient(90deg, #FF2B2B, #FF0055)'
                      : 'linear-gradient(90deg, #FF9F0A, #FF2B2B)',
                  boxShadow: '0 0 12px rgb(255 159 10 / 0.4)',
                }}
              />
            </div>
            <p className="text-[13px] text-[#8E8E93]">
              {remaining > 0 ? (
                <>
                  Il reste <span className="font-semibold text-[#30D158]">{remaining} kcal</span>
                </>
              ) : (
                <span className="font-semibold text-[#FF9F0A]">Objectif atteint</span>
              )}
              {' · '}
              {meals.length} repas
            </p>
          </div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="glass-card space-y-4 rounded-3xl p-4"
          style={{ boxShadow: '0 10px 30px rgb(0 0 0 / 0.25)' }}
        >
          <p className="text-[15px] font-semibold text-white">Nouveau repas</p>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MEAL_META) as MealType[]).map((type) => (
              <MealTypeChip
                key={type}
                type={type}
                active={mealType === type}
                onClick={() => setMealType(type)}
              />
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Nom</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Poulet riz brocoli…"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#34C759]/40"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Calories</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF9F0A]/40"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                Protéines (g)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={400}
                value={proteinG}
                onChange={(e) =>
                  setProteinG(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Optionnel"
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-white/10 bg-ios-inset py-3 text-[15px] font-medium text-[#8E8E93]"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-brand flex-1 rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-white"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {meals.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#34C759]/25 bg-[#34C759]/15"
          >
            <UtensilsCrossed className="h-7 w-7 text-[#30D158]" strokeWidth={1.75} />
          </div>
          <p className="text-[16px] font-semibold text-white">Aucun repas pour l&apos;instant</p>
          <p className="max-w-xs text-[13px] text-[#8E8E93]">
            Ajoute ton premier repas pour suivre ta journée nutrition.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {meals.map((meal) => {
            const meta = MEAL_META[meal.mealType]
            const Icon = meta.icon
            return (
              <li key={meal.id}>
                <article className="glass-card flex items-center gap-3 rounded-2xl p-3.5">
                  <IconBadge icon={Icon} variant={meta.accent} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold tracking-tight text-white">
                        {meal.name}
                      </h3>
                      <span
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: `${meta.glow}22`,
                          color: meta.glow,
                        }}
                      >
                        {MEAL_TYPE_LABELS[meal.mealType]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#8E8E93]">
                      <span className="font-semibold text-[#FF9F0A]">{meal.calories} kcal</span>
                      {meal.proteinG != null && (
                        <> · {meal.proteinG} g protéines</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(meal.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-[#8E8E93] active:text-[#FF453A]"
                    aria-label="Supprimer le repas"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
