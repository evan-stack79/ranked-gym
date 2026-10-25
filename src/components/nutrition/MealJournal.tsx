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
import {
  addMealToToday,
  getTodayJournal,
  getTodayWaterMl,
  removeMealFromToday,
  updateMealInToday,
} from '../../services/nutritionStorage'
import { getUserWaterGoalMl, WATER_GOAL_CHANGED_EVENT } from '../../utils/userWaterGoal'
import { HydrationProgressBar } from './HydrationProgressBar'
import { WaterGoalChooser } from './WaterGoalChooser'
import {
  listPersonalFoods,
  mapAccessError,
  mapFoodAddQuantityError,
  searchOpenFoodFacts,
  setPersonalFoodFavorite,
  type OpenFoodFactsProduct,
  type OpenFoodFactsSearchHit,
} from '../../services/alimentsService'
import {
  foodAddQuantityUserMessage,
  formatGramsCountLabel,
  formatPiecesCountLabel,
  validateFoodQuantity,
} from '../../../convex/lib/foodAddQuantity'
import { useAuth } from '../../context/AuthContext'
import { IconBadge } from '../ui/IconBadge'
import { MacroRing } from './MacroRing'
import { BarcodeScanner } from './BarcodeScanner'
import { ScannedProductSheet } from './ScannedProductSheet'
import { MealBudgetsCard } from './MealBudgetsCard'
import { EditMealSheet } from './EditMealSheet'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'
import { AddFoodScreenV3, type FoodAddV3Selection } from './AddFoodScreenV3'
import { AddFoodScreenLegacy } from './AddFoodScreenLegacy'
import { SectionSkeleton } from '../ui/AppBootScreen'
import { persistScannedProductSelection } from './persistScannedProductSelection'
import {
  primaryOffTagForCategory,
  type FoodCategoryId,
} from '../../utils/foodCategories'
import {
  buildFoodNutritionSnapshot,
  mealEntryFromSnapshot,
} from '../../utils/foodJournalSnapshot'
import { isConvexDomainActive } from '../../backend/adapter'
import { isFoodAddV3Enabled } from '../../backend/foodAddV3FeatureFlag'
import {
  canAccessFoodAdd,
  canAccessFoodAddV3,
  needsAgePrompt,
} from '../../services/foodAddAccess'
import {
  addFoodSnapshotViaConvex,
} from '../../services/convexNutritionService'
import { getCalorieProfile, saveCalorieProfile } from '../../services/nutritionStorage'
import { todayKey } from '../../utils/calories'
import { AgeRequiredPrompt } from './AgeRequiredPrompt'
import { formatMealPortionLabel } from './NutritionDayMealsCard'

interface MealJournalProps {
  targetCalories: number
  morphology: BodyMorphology
}

const MEAL_META: Record<
  MealType,
  { icon: typeof Coffee; accent: 'orange' | 'crimson' | 'violet' | 'blue'; glow: string }
> = {
  breakfast: { icon: Coffee, accent: 'orange', glow: '#FF9F0A' },
  lunch: { icon: Sun, accent: 'crimson', glow: '#FF0702' },
  dinner: { icon: Moon, accent: 'violet', glow: '#BF5AF2' },
  snack: { icon: Cookie, accent: 'blue', glow: '#00B4FF' },
}

export function MealJournal({ targetCalories, morphology }: MealJournalProps) {
  const { user, requireAuth } = useAuth()
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [waterTick, setWaterTick] = useState(0)
  const [showForm, setShowForm] = useState(false)
  /** V3 only — age prompt before Ajouter un aliment (never when flag OFF). */
  const [showV3AgeGate, setShowV3AgeGate] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<OpenFoodFactsProduct | null>(null)
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null)
  const [pendingMealType, setPendingMealType] = useState<MealType | null>(null)
  const [name, setName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [calories, setCalories] = useState(350)
  const [proteinG, setProteinG] = useState<number | ''>('')
  const [carbsG, setCarbsG] = useState<number | ''>('')
  const [fatG, setFatG] = useState<number | ''>('')
  const [manualGrams, setManualGrams] = useState<number | ''>('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [searchHits, setSearchHits] = useState<OpenFoodFactsSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foodCategory, setFoodCategory] = useState<FoodCategoryId>('all')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null,
  )
  const scanZoneRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 5200 : 3400)
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
    const onWater = () => setWaterTick((n) => n + 1)
    window.addEventListener('ranked-gym:backup-restored', onRestored)
    window.addEventListener('ranked-gym:water-changed', onWater)
    window.addEventListener(WATER_GOAL_CHANGED_EVENT, onWater)
    window.addEventListener('ranked-gym:profile-changed', onWater)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', onRestored)
      window.removeEventListener('ranked-gym:water-changed', onWater)
      window.removeEventListener(WATER_GOAL_CHANGED_EVENT, onWater)
      window.removeEventListener('ranked-gym:profile-changed', onWater)
    }
  }, [])

  useEffect(() => {
    if (!showForm) {
      setSearchHits([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const term = searchQuery.trim()
    const categoryTag = primaryOffTagForCategory(foodCategory)
    const needsRemote = term.length >= 2 || Boolean(categoryTag)

    if (!needsRemote) {
      setSearchError(null)
      setSearchLoading(false)
      let cancelled = false
      void listPersonalFoods({ limit: 12 })
        .then((items) => {
          if (cancelled) return
          setSearchHits(
            items.map((item) => ({
              barcode: item.barcode || item.foodKey,
              nom: item.nom,
              brands: item.brands ?? '',
              calories: item.calories,
              proteines: item.proteines,
              glucides: item.glucides,
              lipides: item.lipides,
              imageUrl: item.imageUrl,
              servingSize: null,
              categoriesTags: [],
              provenance: item.provenance,
              fetchedAt: item.fetchedAt,
              foodKey: item.foodKey,
              isFavorite: item.isFavorite,
            })),
          )
        })
        .catch(() => {
          if (cancelled) return
          setSearchHits([])
        })
      return () => {
        cancelled = true
      }
    }

    const controller = new AbortController()
    setSearchLoading(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void searchOpenFoodFacts(term, controller.signal, { categoryTag })
        .then((hits) => {
          if (controller.signal.aborted) return
          setSearchHits(hits)
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setSearchHits([])
          setSearchError(err instanceof Error ? err.message : 'Recherche impossible.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false)
        })
    }, term.length >= 2 ? 500 : 120)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, showForm, foodCategory])

  const pendingRemaining = useMemo(() => {
    if (!pendingMealType) return 0
    return remainingMealBudget(targetCalories, pendingMealType, meals, morphology)
  }, [pendingMealType, targetCalories, meals, morphology])

  const handleScannedProduct = useCallback(
    (product: OpenFoodFactsProduct) => {
      setScannerOpen(false)
      setScannedProduct(product)
      if (user) {
        void persistScannedProductSelection(product, user.id, (message) => {
          showToast(message, 'error')
        })
      }
    },
    [showToast, user],
  )

  const resetForm = () => {
    setName('')
    setSearchQuery('')
    setCalories(350)
    setProteinG('')
    setCarbsG('')
    setFatG('')
    setManualGrams('')
    setSearchHits([])
    setSearchError(null)
    setSearchLoading(false)
    setFoodCategory('all')
    setShowForm(false)
  }

  const foodAddV3 = isFoodAddV3Enabled()
  const calorieProfile = getCalorieProfile()
  const foodAddAllowed = foodAddV3
    ? canAccessFoodAddV3(calorieProfile)
    : canAccessFoodAdd(calorieProfile)

  const requestShowAddFood = () => {
    if (showForm) {
      setShowForm(false)
      return
    }
    if (foodAddV3 && needsAgePrompt(calorieProfile)) {
      setShowV3AgeGate(true)
      return
    }
    if (!foodAddAllowed) return
    setShowForm(true)
  }

  const handleValidateFoodSelection = (items: FoodAddV3Selection[]) => {
    if (!foodAddAllowed) {
      showToast('Ajout d’aliment indisponible pour ce compte.', 'error')
      return
    }
    const type = pendingMealType ?? mealType
    const dateKey = todayKey()
    void (async () => {
      let journal = getTodayJournal()
      let added = 0
      for (const sel of items) {
        const hit = sel.hit
        const snapshot = buildFoodNutritionSnapshot(hit)
        if (sel.unit === 'pieces' && sel.pieces != null) {
          snapshot.grams = undefined
          snapshot.portionLabel =
            sel.portionLabel?.trim() || formatPiecesCountLabel(sel.pieces)
        } else if (sel.grams != null) {
          snapshot.grams = sel.grams
          snapshot.portionLabel =
            sel.portionLabel?.trim() || formatGramsCountLabel(sel.grams)
        }
        const mealId = sel.mealId || crypto.randomUUID()
        const selectionEventId = sel.selectionEventId || crypto.randomUUID()
        const entry = {
          ...mealEntryFromSnapshot(snapshot, type),
          id: mealId,
          grams: sel.grams,
          pieces: sel.pieces,
          portionLabel: snapshot.portionLabel,
          entrySource: foodAddV3 ? ('v3' as const) : undefined,
          selectionEventId: foodAddV3 ? selectionEventId : undefined,
          calories: foodAddV3
            ? hit.calories == null
              ? null
              : snapshot.calories
            : snapshot.calories,
          proteinG: foodAddV3
            ? hit.proteines == null
              ? null
              : snapshot.proteinG
            : snapshot.proteinG,
          carbsG: foodAddV3
            ? hit.glucides == null
              ? null
              : snapshot.carbsG
            : snapshot.carbsG,
          fatG: foodAddV3
            ? hit.lipides == null
              ? null
              : snapshot.fatG
            : snapshot.fatG,
        }

        if (foodAddV3 && isConvexDomainActive() && user) {
          try {
            await addFoodSnapshotViaConvex({
              mealId,
              dateKey,
              mealType: type,
              name: snapshot.name,
              portionLabel: snapshot.portionLabel,
              offCode: snapshot.offCode,
              imageUrl: snapshot.imageStorageId ? snapshot.imageUrl : undefined,
              imageStorageId: snapshot.imageStorageId as never,
              grams: sel.unit === 'pieces' ? undefined : (sel.grams ?? snapshot.grams),
              pieces: sel.pieces,
              selectionEventId,
              updatedAt: snapshot.updatedAt,
            })
          } catch (error: unknown) {
            const qtyMsg = mapFoodAddQuantityError(error)
            if (qtyMsg) showToast(qtyMsg, 'error')
            else {
              const access = mapAccessError(error)
              if (access) showToast(access.message, 'error')
              else showToast("L'ajout n'a pas fonctionné. Réessaie.", 'error')
            }
            continue
          }
          void persistScannedProductSelection(hit, user.id, (message) => {
            showToast(message, 'error')
          })
        } else if (user) {
          void persistScannedProductSelection(hit, user.id, (message) => {
            showToast(message, 'error')
          })
        }

        journal = addMealToToday(entry)
        added += 1
      }
      setMeals(journal.meals)
      setPendingMealType(null)
      resetForm()
      if (added > 0) {
        showToast(added === 1 ? 'Aliment ajouté.' : `${added} aliments ajoutés.`)
      }
    })()
  }

  const handleScanSave = (entry: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number | null
    carbsG: number | null
    fatG: number | null
    grams: number
    pieces?: number
  }) => {
    const journal = addMealToToday({
      name: entry.name,
      mealType: entry.mealType,
      calories: entry.calories,
      proteinG: entry.proteinG ?? undefined,
      carbsG: entry.carbsG ?? undefined,
      fatG: entry.fatG ?? undefined,
      grams: entry.grams,
      pieces: entry.pieces,
    })
    setMeals(journal.meals)
    setScannedProduct(null)
    setPendingMealType(null)
    resetForm()
  }

  const openScanner = (forMeal?: MealType) => {
    if (!foodAddAllowed) return
    if (forMeal) setPendingMealType(forMeal)
    requireAuth(() => {
      setScannerOpen(true)
      if (showForm) return
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
        calories: acc.calories + (meal.calories ?? 0),
        protein: acc.protein + (meal.proteinG ?? 0),
        carbs: acc.carbs + (meal.carbsG ?? 0),
        fat: acc.fat + (meal.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [meals])

  const progress = targetCalories > 0 ? totals.calories / targetCalories : 0
  const remaining = Math.max(0, targetCalories - totals.calories)

  const hydration = useMemo(() => {
    void waterTick
    return {
      consumedMl: getTodayWaterMl(),
      goalMl: getUserWaterGoalMl(),
    }
  }, [waterTick])

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (!foodAddV3 && calories <= 0) return

    if (foodAddV3) {
      const qty = validateFoodQuantity({ unit: 'g', value: manualGrams })
      if (!qty.ok) {
        showToast(foodAddQuantityUserMessage(qty.reason, qty.unit), 'error')
        return
      }
    }

    const grams =
      foodAddV3 && typeof manualGrams === 'number' && Number.isFinite(manualGrams)
        ? manualGrams
        : undefined

    const journal = addMealToToday({
      name: trimmed,
      mealType,
      calories: foodAddV3 ? null : Math.round(calories),
      proteinG: foodAddV3 ? null : proteinG === '' ? undefined : Number(proteinG),
      carbsG: foodAddV3 ? null : carbsG === '' ? undefined : Number(carbsG),
      fatG: foodAddV3 ? null : fatG === '' ? undefined : Number(fatG),
      grams,
      portionLabel: grams != null ? `${grams} g` : undefined,
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
    // Strict V3 seulement si la ligne est déjà marquée (jamais ?? 'v3').
    const current = meals.find((m) => m.id === mealId)
    const strictV3Row =
      current?.entrySource === 'v3' || patch.entrySource === 'v3'
    if (strictV3Row && patch.grams != null) {
      const checked = validateFoodQuantity({ unit: 'g', value: patch.grams })
      if (!checked.ok) {
        showToast(foodAddQuantityUserMessage(checked.reason, checked.unit), 'error')
        return
      }
      if (checked.unit !== 'g') return
      patch = {
        ...patch,
        grams: checked.grams,
        portionLabel: formatGramsCountLabel(checked.grams),
        pieces: undefined,
        entrySource: current?.entrySource ?? patch.entrySource,
      }
    }

    // Local d’abord ; file sync. PC-08 : pas de toast « refusée » hors ligne ici.
    const journal = updateMealInToday(mealId, patch)
    setMeals(journal.meals)
    setEditingMeal(null)
  }

  if (!hydrated) {
    return <SectionSkeleton tall label="Journal" />
  }

  return (
    <section className="space-y-4 pb-6">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 90% 0%, rgb(255 159 10 / 0.2) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 0% 100%, rgb(255 7 2 / 0.14) 0%, transparent 55%), rgb(28 28 30 / 0.9)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 12px 40px rgb(0 0 0 / 0.3)',
        }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconBadge icon={UtensilsCrossed} variant="orange" size="sm" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ACB4BA]">
                Journal
              </p>
              <h2 className="whitespace-nowrap text-[20px] font-bold leading-tight tracking-tight text-white">
                Repas du jour
              </h2>
            </div>
          </div>
          {foodAddAllowed ? (
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
              {!foodAddV3 ? (
                <button
                  type="button"
                  onClick={() => openScanner()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#30D158]/35 bg-[#30D158]/15 px-3.5 py-2 text-[13px] font-semibold text-[#30D158]"
                >
                  <ScanBarcode className="h-4 w-4" />
                  Scanner
                </button>
              ) : null}
              <button
                type="button"
                onClick={requestShowAddFood}
                className="btn-brand inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-5">
          <MacroRing
            progress={progress}
            size={100}
            stroke={9}
            color={progress > 1 ? '#FF0702' : '#FF9F0A'}
          >
            <p className="text-[20px] font-black text-white">{Math.round(progress * 100)}%</p>
            <p className="text-[10px] text-[#ACB4BA]">objectif</p>
          </MacroRing>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[28px] font-black tracking-tight text-white">
                {totals.calories}
                <span className="ml-1 text-[14px] font-semibold text-[#ACB4BA]">
                  / {targetCalories} kcal
                </span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/40">
              <div
                className="motion-progress-fill h-full rounded-full"
                style={{
                  transform: `scaleX(${Math.max(0, Math.min(progress, 1))})`,
                  background:
                    progress > 1
                      ? 'linear-gradient(90deg, #FF0702, #FF0055)'
                      : 'linear-gradient(90deg, #FF9F0A, #FF0702)',
                  boxShadow: '0 0 12px rgb(255 159 10 / 0.4)',
                }}
              />
            </div>
            <p className="text-[13px] text-[#ACB4BA]">
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

        {hydration.goalMl != null && hydration.goalMl > 0 ? (
          <HydrationProgressBar
            className="mt-4 border-t border-white/8 pt-4"
            consumedMl={hydration.consumedMl}
            goalMl={hydration.goalMl}
          />
        ) : (
          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="text-[13px] font-medium tabular-nums text-[#ACB4BA]">
              {hydration.consumedMl} ml bus aujourd&apos;hui
            </p>
            <WaterGoalChooser
              className="mt-2"
              onSaved={() => setWaterTick((n) => n + 1)}
            />
          </div>
        )}
      </div>

      <div
        ref={scanZoneRef}
        className="scroll-mt-24 space-y-3"
        id="nutrition-scan-zone"
      >
        {!showForm && foodAddAllowed && !foodAddV3 ? (
          <>
            <MealPhotoAnalyzer
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
          </>
        ) : null}
      </div>

      <MealBudgetsCard
        targetCalories={targetCalories}
        morphology={morphology}
        meals={meals}
      />

      {!foodAddV3 && pendingMealType && pendingRemaining > 60 && (
        <div className="rounded-2xl border border-[#00B4FF]/30 bg-[#00B4FF]/10 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-white">
            {MEAL_TYPE_LABELS[pendingMealType]} en cours
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#ACB4BA]">
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
              className="ios-press rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12px] font-medium text-[#ACB4BA]"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {foodAddV3 && showV3AgeGate ? (
        <AgeRequiredPrompt
          onAgeSubmit={(age) => {
            const next = { ...getCalorieProfile(), age }
            saveCalorieProfile(next)
            setShowV3AgeGate(false)
            if (canAccessFoodAddV3(next)) {
              setShowForm(true)
            }
          }}
        />
      ) : null}

      {showForm && foodAddV3 && canAccessFoodAddV3(calorieProfile) ? (
        <AddFoodScreenV3
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchLoading={searchLoading}
          searchError={searchError}
          searchHits={searchHits}
          category={foodCategory}
          onCategoryChange={setFoodCategory}
          onValidateSelection={handleValidateFoodSelection}
          name={name}
          onNameChange={setName}
          mealType={mealType}
          onMealTypeChange={setMealType}
          onSubmitManual={handleAdd}
          onClose={resetForm}
          manualGrams={manualGrams}
          onManualGramsChange={setManualGrams}
        />
      ) : null}

      {showForm && !foodAddV3 ? (
        <AddFoodScreenLegacy
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchLoading={searchLoading}
          searchError={searchError}
          searchHits={searchHits}
          onSelectHit={(hit) => {
            handleScannedProduct(hit)
            setSearchQuery('')
            setSearchHits([])
          }}
          onToggleFavorite={(hit) => {
            if (!hit.foodKey) return
            requireAuth(() => {
              const next = !hit.isFavorite
              void setPersonalFoodFavorite(hit.foodKey!, next)
                .then((applied) => {
                  if (!applied) {
                    showToast('Impossible de mettre à jour le favori.', 'error')
                    return
                  }
                  setSearchHits((prev) =>
                    prev.map((item) =>
                      item.foodKey === hit.foodKey ? { ...item, isFavorite: next } : item,
                    ),
                  )
                  showToast(next ? 'Ajouté aux favoris.' : 'Retiré des favoris.')
                })
                .catch(() => {
                  showToast('Impossible de mettre à jour le favori.', 'error')
                })
            })
          }}
          onOpenScanner={() => openScanner()}
          scannerSlot={
            scannerOpen ? (
              <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onProduct={handleScannedProduct}
              />
            ) : null
          }
          onToast={showToast}
          onPhotoAnalyzed={(result) => {
            const journal = addMealToToday({
              name: result.name,
              mealType: result.mealType,
              calories: result.calories,
              proteinG: result.proteinG,
              carbsG: result.carbsG,
              fatG: result.fatG,
            })
            setMeals(journal.meals)
            resetForm()
          }}
          name={name}
          onNameChange={setName}
          calories={calories}
          onCaloriesChange={setCalories}
          proteinG={proteinG}
          onProteinChange={setProteinG}
          carbsG={carbsG}
          onCarbsChange={setCarbsG}
          fatG={fatG}
          onFatChange={setFatG}
          mealType={mealType}
          onMealTypeChange={setMealType}
          onSubmitManual={handleAdd}
          onClose={resetForm}
        />
      ) : null}

      {meals.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#34C759]/25 bg-[#34C759]/15"
          >
            <UtensilsCrossed className="h-7 w-7 text-[#30D158]" strokeWidth={1.75} />
          </div>
          <p className="text-[16px] font-semibold text-white">Aucun repas pour l&apos;instant</p>
          <p className="max-w-xs text-[13px] text-[#ACB4BA]">
            {foodAddV3
              ? 'Ajoute un aliment pour suivre ta journée.'
              : 'Scanne un produit ou ajoute un repas pour suivre ta journée.'}
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
                    <p className="mt-0.5 text-[13px] text-[#ACB4BA]">
                      {foodAddV3 ? (
                        <>
                          {formatMealPortionLabel(meal) || MEAL_TYPE_LABELS[meal.mealType]}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-[#FF9F0A]">{meal.calories} kcal</span>
                          {meal.pieces != null && <> · {meal.pieces} pc</>}
                          {meal.grams != null && <> · {meal.grams} g</>}
                          {meal.proteinG != null && <> · {meal.proteinG} g P</>}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMeal(meal)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-[#ACB4BA] active:text-white"
                    aria-label="Modifier l’aliment"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(meal.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-[#ACB4BA] active:text-[#FF453A]"
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

      {!foodAddV3 ? (
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
      ) : null}

      <EditMealSheet
        open={editingMeal != null}
        meal={editingMeal}
        onClose={() => setEditingMeal(null)}
        onSave={handleEditSave}
        onDelete={handleRemove}
        hideNutritionNumbers={foodAddV3}
      />

      {toast ? (
        <div
          className={`fixed left-1/2 z-[120] max-w-[92%] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-[13px] font-medium shadow-lg ${
            toast.variant === 'error'
              ? 'bottom-[calc(var(--app-bottom-nav)+env(safe-area-inset-bottom,0px)+1rem)] border-[#FF453A]/40 bg-[#2C1014]/95 text-[#FF907F]'
              : 'bottom-[calc(var(--app-bottom-nav)+env(safe-area-inset-bottom,0px)+1rem)] border-[#30D158]/35 bg-[#102C18]/95 text-white'
          }`}
          role={toast.variant === 'error' ? 'alert' : 'status'}
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}
