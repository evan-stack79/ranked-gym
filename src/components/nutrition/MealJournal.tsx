import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Coffee,
  Moon,
  Plus,
  Sun,
  Cookie,
  Trash2,
  UtensilsCrossed,
  ScanBarcode,
  Pencil,
  ScanLine,
} from 'lucide-react'
import type { BodyMorphology, MealEntry, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import { remainingMealBudget } from '../../utils/portionGuide'
import type { PortionMode } from '../../utils/morphology'
import {
  addMealToToday,
  getTodayJournal,
  removeMealFromToday,
  updateMealInToday,
} from '../../services/nutritionStorage'
import { saveAliment, type OpenFoodFactsProduct } from '../../services/alimentsService'
import { useAuth } from '../../context/AuthContext'
import { IconBadge } from '../ui/IconBadge'
import { MacroRing } from './MacroRing'
import { BarcodeScanner } from './BarcodeScanner'
import { ScannedProductSheet } from './ScannedProductSheet'
import { MealBudgetsCard } from './MealBudgetsCard'
import { EditMealSheet } from './EditMealSheet'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'

interface MealJournalProps {
  targetCalories: number
  morphology: BodyMorphology
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

export function MealJournal({ targetCalories, morphology }: MealJournalProps) {
  const { user, requireAuth } = useAuth()
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<OpenFoodFactsProduct | null>(null)
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null)
  const [pendingMealType, setPendingMealType] = useState<MealType | null>(null)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState(350)
  const [proteinG, setProteinG] = useState<number | ''>('')
  const [carbsG, setCarbsG] = useState<number | ''>('')
  const [fatG, setFatG] = useState<number | ''>('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [toast, setToast] = useState<string | null>(null)
  const scanZoneRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const scrollToScanZone = useCallback(() => {
    scanZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    setMeals(getTodayJournal().meals)
    setHydrated(true)
  }, [])

  useEffect(() => {
    const onRestored = () => setMeals(getTodayJournal().meals)
    window.addEventListener('ranked-gym:backup-restored', onRestored)
    return () => window.removeEventListener('ranked-gym:backup-restored', onRestored)
  }, [])

  const pendingRemaining = useMemo(() => {
    if (!pendingMealType) return 0
    return remainingMealBudget(targetCalories, pendingMealType, meals, morphology)
  }, [pendingMealType, targetCalories, meals, morphology])

  const handleScannedProduct = useCallback(
    (product: OpenFoodFactsProduct) => {
      setScannerOpen(false)
      setScannedProduct(product)
      if (user) {
        void saveAliment(product, user.id).catch(() => undefined)
      }
    },
    [user],
  )

  const handleScanSave = (entry: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    grams: number
    pieces?: number
    portionMode: PortionMode
  }) => {
    const journal = addMealToToday({
      name: entry.name,
      mealType: entry.mealType,
      calories: entry.calories,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      grams: entry.grams,
      pieces: entry.pieces,
      portionMode: entry.portionMode,
    })
    setMeals(journal.meals)
    setScannedProduct(null)

    const remain = remainingMealBudget(
      targetCalories,
      entry.mealType,
      journal.meals,
      morphology,
    )
    if (entry.portionMode === 'with_sides' && remain > 60) {
      setPendingMealType(entry.mealType)
    } else if (remain <= 60) {
      setPendingMealType(null)
    }
  }

  const resetForm = () => {
    setName('')
    setCalories(350)
    setProteinG('')
    setCarbsG('')
    setFatG('')
    setShowForm(false)
  }

  const openScanner = (forMeal?: MealType) => {
    if (forMeal) setPendingMealType(forMeal)
    requireAuth(() => {
      setScannerOpen(true)
      // Wait for the scanner panel to mount, then smooth-scroll it into view.
      requestAnimationFrame(() => {
        scrollToScanZone()
        window.setTimeout(scrollToScanZone, 80)
        window.setTimeout(scrollToScanZone, 220)
      })
    })
  }

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
      carbsG: carbsG === '' ? undefined : Number(carbsG),
      fatG: fatG === '' ? undefined : Number(fatG),
    })
    setMeals(journal.meals)
    resetForm()
  }

  const handleRemove = (id: string) => {
    const journal = removeMealFromToday(id)
    setMeals(journal.meals)
    setEditingMeal(null)
  }

  const handleEditSave = (mealId: string, patch: Partial<MealEntry>) => {
    const journal = updateMealInToday(mealId, patch)
    setMeals(journal.meals)
    setEditingMeal(null)
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openScanner()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#30D158]/35 bg-[#30D158]/15 px-3.5 py-2 text-[13px] font-semibold text-[#30D158]"
            >
              <ScanBarcode className="h-4 w-4" />
              Scanner
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="btn-brand inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
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
                  Il reste{' '}
                  <span className="font-semibold text-[#30D158]">{remaining} kcal</span> sur ta
                  cible du jour ({targetCalories} kcal)
                </>
              ) : (
                <span className="font-semibold text-[#FF9F0A]">Objectif du jour atteint</span>
              )}
              {' · '}
              {meals.length} aliments
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scanZoneRef}
        className="scroll-mt-24 space-y-3"
        id="nutrition-scan-zone"
      >
        <MealPhotoAnalyzer
          mealType={mealType}
          onToast={showToast}
          onAnalyzed={(result) => {
            const journal = addMealToToday({
              name: result.name,
              mealType: result.mealType,
              calories: result.calories,
              proteinG: result.proteines,
              carbsG: result.glucides,
              fatG: result.lipides,
            })
            setMeals(journal.meals)
          }}
        />
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onProduct={handleScannedProduct}
        />
      </div>

      <MealBudgetsCard
        targetCalories={targetCalories}
        morphology={morphology}
        meals={meals}
      />

      {pendingMealType && pendingRemaining > 60 && (
        <div className="rounded-2xl border border-[#00B4FF]/30 bg-[#00B4FF]/10 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-white">
            {MEAL_TYPE_LABELS[pendingMealType]} en cours
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#AEAEB2]">
            Il manque encore environ{' '}
            <span className="font-semibold text-[#64D2FF]">{pendingRemaining} kcal</span> pour un
            bon repas. Scanne l’accompagnement (ex. frites) — on calcule la portion pour toi.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => openScanner(pendingMealType)}
              className="ios-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#00B4FF]/40 bg-[#00B4FF]/20 py-2.5 text-[13px] font-semibold text-[#64D2FF]"
            >
              <ScanLine className="h-4 w-4" />
              Scanner l’accompagnement
            </button>
            <button
              type="button"
              onClick={() => setPendingMealType(null)}
              className="ios-press rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12px] font-medium text-[#8E8E93]"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="glass-card space-y-4 rounded-3xl p-4"
          style={{ boxShadow: '0 10px 30px rgb(0 0 0 / 0.25)' }}
        >
          <p className="text-[15px] font-semibold text-white">Nouveau repas (manuel)</p>

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
                inputMode="decimal"
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
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                Glucides (g)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={400}
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Optionnel"
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF9F0A]/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                Lipides (g)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={400}
                value={fatG}
                onChange={(e) => setFatG(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Optionnel"
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#00B4FF]/40"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
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
            Scanne un produit ou ajoute un repas pour suivre ta journée.
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
                      {meal.pieces != null && <> · {meal.pieces} pc</>}
                      {meal.grams != null && <> · {meal.grams} g</>}
                      {meal.proteinG != null && <> · {meal.proteinG} g P</>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMeal(meal)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-[#8E8E93] active:text-white"
                    aria-label="Modifier l’aliment"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
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

      <ScannedProductSheet
        open={scannedProduct != null}
        product={scannedProduct}
        targetCalories={targetCalories}
        morphology={morphology}
        meals={meals}
        preferredMealType={pendingMealType}
        onClose={() => setScannedProduct(null)}
        onSave={handleScanSave}
      />

      <EditMealSheet
        open={editingMeal != null}
        meal={editingMeal}
        onClose={() => setEditingMeal(null)}
        onSave={handleEditSave}
        onDelete={handleRemove}
      />

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[80] max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </section>
  )
}
