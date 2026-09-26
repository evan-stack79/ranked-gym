import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight, Ellipsis, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import type { BodyMorphology, CalorieProfile, MealEntry, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import { remainingMealBudget } from '../../utils/portionGuide'
import type { PortionMode } from '../../utils/morphology'
import {
  addMealToDate,
  getJournalForDate,
  getMealJournal,
  getWaterMlForDate,
  addWaterEntryForDate,
  removeMealFromDate,
  updateMealOnDate,
} from '../../services/nutritionStorage'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { getDailyWaterGoalMl, isTrainingDayToday } from '../../utils/waterGoal'
import {
  canSubmitHomeQuickWater,
} from '../../utils/homeNutritionQuickActions'
import {
  saveAliment,
  searchOpenFoodFacts,
  type OpenFoodFactsProduct,
  type OpenFoodFactsSearchHit,
} from '../../services/alimentsService'
import { useAuth } from '../../context/AuthContext'
import { NutritionCalorieRing } from './NutritionCalorieRing'
import { NutritionCalendarSheet } from './NutritionCalendarSheet'
import { NutritionMacrosRow } from './NutritionMacrosRow'
import { NutritionHydrationCard } from './NutritionHydrationCard'
import {
  NutritionQuickActions,
  type NutritionQuickActionId,
} from './NutritionQuickActions'
import { NutritionDayMealsCard } from './NutritionDayMealsCard'
import { NutritionPlanCard } from './NutritionPlanCard'
import { WeightPaceCard } from './WeightPaceCard'
import { SmartWaterGauge } from './SmartWaterGauge'
import { MealBudgetsCard } from './MealBudgetsCard'
import { BarcodeScanner } from './BarcodeScanner'
import { ScannedProductSheet } from './ScannedProductSheet'
import { EditMealSheet } from './EditMealSheet'
import {
  MealPhotoAnalyzer,
  type MealPhotoAnalyzerHandle,
} from './MealPhotoAnalyzer'
import { AddFoodScreen } from './AddFoodScreen'
import { IosSheet } from '../ui/IosSheet'
import { SectionSkeleton } from '../ui/AppBootScreen'
import { dateFromKey, nutritionDateLabel, shiftDateKey } from '../../utils/nutritionDate'
import { todayKey } from '../../utils/calories'

interface NutritionDashboardProps {
  profile: CalorieProfile
  onChangeProfile: (profile: CalorieProfile) => void
  onOpenSetup: () => void
}

export function NutritionDashboard({
  profile,
  onChangeProfile,
  onOpenSetup,
}: NutritionDashboardProps) {
  const { user, requireAuth } = useAuth()
  const [tick, setTick] = useState(0)
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [waterSaving, setWaterSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [journalDetailOpen, setJournalDetailOpen] = useState(false)
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [showForm, setShowForm] = useState(false)
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
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [searchHits, setSearchHits] = useState<OpenFoodFactsSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null,
  )
  const photoRef = useRef<MealPhotoAnalyzerHandle>(null)
  const journalRef = useRef<HTMLDivElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), variant === 'error' ? 5200 : 3400)
  }, [])

  useEffect(() => {
    setMeals(getJournalForDate(selectedDateKey).meals)
    setHydrated(true)
  }, [selectedDateKey])

  useEffect(() => {
    const sync = () => {
      setMeals(getJournalForDate(selectedDateKey).meals)
      setTick((n) => n + 1)
    }
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('ranked-gym:water-changed', sync)
    window.addEventListener('ranked-gym:profile-changed', sync)
    window.addEventListener('ranked-gym:training-changed', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('ranked-gym:water-changed', sync)
      window.removeEventListener('ranked-gym:profile-changed', sync)
      window.removeEventListener('ranked-gym:training-changed', sync)
      window.removeEventListener('focus', sync)
    }
  }, [selectedDateKey])

  useEffect(() => {
    if (!showForm) {
      setSearchHits([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const term = searchQuery.trim()
    if (term.length < 2) {
      setSearchHits([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    setSearchLoading(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void searchOpenFoodFacts(term, controller.signal)
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
    }, 500)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, showForm])

  const nutrition = useMemo(() => {
    void tick
    return getNutritionTarget(profile)
  }, [profile, tick])

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

  const targetCalories = nutrition.targetCalories
  const remainingCalories = targetCalories > 0 ? targetCalories - totals.calories : 0
  const calorieProgress =
    targetCalories > 0 ? totals.calories / targetCalories : 0

  const hydration = useMemo(() => {
    void tick
    const isTrainingDay = isTrainingDayToday(undefined, dateFromKey(selectedDateKey))
    return {
      consumedMl: getWaterMlForDate(selectedDateKey),
      goalMl: getDailyWaterGoalMl(profile.weightKg, isTrainingDay),
    }
  }, [tick, profile.weightKg, selectedDateKey])

  const dataDateKeys = useMemo(() => Object.keys(getMealJournal()), [tick])

  const resetForm = () => {
    setName('')
    setSearchQuery('')
    setCalories(350)
    setProteinG('')
    setCarbsG('')
    setFatG('')
    setSearchHits([])
    setSearchError(null)
    setSearchLoading(false)
    setShowForm(false)
  }

  const openAddFood = (type?: MealType) => {
    if (type) {
      setMealType(type)
      setPendingMealType(type)
    }
    setShowForm(true)
  }

  const selectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey)
    setJournalDetailOpen(false)
  }

  const handleDaySwipeStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleDaySwipeEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 56 || Math.abs(dx) <= Math.abs(dy) * 1.2) return
    selectDate(shiftDateKey(selectedDateKey, dx < 0 ? 1 : -1))
  }

  const openScanner = (forMeal?: MealType) => {
    if (forMeal) {
      setPendingMealType(forMeal)
      setMealType(forMeal)
    }
    requireAuth(() => {
      setScannerOpen(true)
    })
  }

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
    const journal = addMealToDate(selectedDateKey, {
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
    setTick((n) => n + 1)
    setScannedProduct(null)
    resetForm()

    const remain = remainingMealBudget(
      targetCalories,
      entry.mealType,
      journal.meals,
      profile.morphology,
    )
    if (entry.portionMode === 'with_sides' && remain > 60) {
      setPendingMealType(entry.mealType)
    } else if (remain <= 60) {
      setPendingMealType(null)
    }
  }

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || calories <= 0) return

    const journal = addMealToDate(selectedDateKey, {
      name: trimmed,
      mealType,
      calories: Math.round(calories),
      proteinG: proteinG === '' ? undefined : Number(proteinG),
      carbsG: carbsG === '' ? undefined : Number(carbsG),
      fatG: fatG === '' ? undefined : Number(fatG),
    })
    setMeals(journal.meals)
    setTick((n) => n + 1)
    resetForm()
  }

  const handleRemove = (id: string) => {
    const journal = removeMealFromDate(selectedDateKey, id)
    setMeals(journal.meals)
    setTick((n) => n + 1)
    setEditingMeal(null)
  }

  const handleEditSave = (mealId: string, patch: Partial<MealEntry>) => {
    const journal = updateMealOnDate(selectedDateKey, mealId, patch)
    setMeals(journal.meals)
    setTick((n) => n + 1)
    setEditingMeal(null)
  }

  const handleQuickWater = () => {
    if (!canSubmitHomeQuickWater(waterSaving)) return
    setWaterSaving(true)
    let added = false
    try {
      const before = getWaterMlForDate(selectedDateKey)
      const result = addWaterEntryForDate(selectedDateKey, {
        amountMl: 250,
        type: 'glass',
        label: 'Verre',
      })
      if (result.waterMl >= before) {
        added = true
        setTick((n) => n + 1)
        showToast('+250 ml ajoutés')
        return
      }
    } catch {
    } finally {
      setWaterSaving(false)
    }
    if (added) return
    showToast("Impossible d'ajouter l'eau", 'error')
  }

  const handleQuickAction = (id: NutritionQuickActionId) => {
    switch (id) {
      case 'scanner':
        openScanner()
        break
      case 'scan-ia':
        photoRef.current?.open()
        break
      case 'search':
        openAddFood()
        break
      case 'journal':
        setJournalDetailOpen(true)
        window.requestAnimationFrame(() => {
          journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        break
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <SectionSkeleton tall label="Nutrition" />
        <SectionSkeleton label="Hydratation" />
        <SectionSkeleton label="Repas" />
      </div>
    )
  }

  return (
    <div className="-mx-5 min-h-[70vh] overflow-hidden bg-[#0C0C0E] pb-2">
      <div className="flex flex-col gap-4 px-5 pt-1">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-[32px] font-bold tracking-tight text-white">Nutrition</h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white"
            aria-label="Menu nutrition"
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>

        <div
          onTouchStart={handleDaySwipeStart}
          onTouchEnd={handleDaySwipeEnd}
          className="touch-pan-y"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => selectDate(shiftDateKey(selectedDateKey, -1))}
              className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#AEAEB2]"
              aria-label="Jour précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="ios-press min-h-10 flex-1 text-center text-[14px] font-semibold text-white"
              aria-label="Choisir une date"
            >
              {nutritionDateLabel(selectedDateKey)} <span className="text-[#8E8E93]">⌄</span>
            </button>
            <button
              type="button"
              onClick={() => selectDate(shiftDateKey(selectedDateKey, 1))}
              className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#AEAEB2]"
              aria-label="Jour suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <NutritionCalorieRing
            remainingCalories={remainingCalories}
            consumedCalories={totals.calories}
            targetCalories={targetCalories}
            progress={calorieProgress}
            onOpenSetup={onOpenSetup}
          />
        </div>

        <NutritionMacrosRow
          protein={{
            label: 'Protéines',
            consumedG: totals.protein,
            targetG: nutrition.proteinG,
          }}
          carbs={{
            label: 'Glucides',
            consumedG: totals.carbs,
            targetG: nutrition.carbsG,
          }}
          fat={{
            label: 'Lipides',
            consumedG: totals.fat,
            targetG: nutrition.fatG,
          }}
        />

        <NutritionHydrationCard
          consumedMl={hydration.consumedMl}
          goalMl={hydration.goalMl}
          onAdd250={handleQuickWater}
          saving={waterSaving}
        />

        <NutritionQuickActions onAction={handleQuickAction} />

        <NutritionDayMealsCard
          meals={meals}
          onAddMeal={openAddFood}
          onEditMeal={setEditingMeal}
        />

        <div ref={journalRef} className="scroll-mt-4">
          {journalDetailOpen ? (
            <section className="space-y-3" aria-label="Détail du journal">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-semibold text-white">Aliments du jour</h2>
                <button
                  type="button"
                  onClick={() => setJournalDetailOpen(false)}
                  className="ios-press text-[12px] font-medium text-[#8E8E93]"
                >
                  Masquer
                </button>
              </div>
              {meals.length === 0 ? (
                <p className="rounded-2xl border border-white/[0.08] bg-[#141416]/80 px-4 py-6 text-center text-[13px] text-[#8E8E93]">
                  Aucun aliment pour l&apos;instant — utilise Scanner, Scan IA ou Recherche.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]/92">
                  {meals.map((meal, index) => (
                    <li key={meal.id}>
                      {index > 0 ? <div className="mx-4 h-px bg-white/[0.06]" /> : null}
                      <article className="flex items-center gap-2 px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-white">{meal.name}</p>
                          <p className="mt-0.5 text-[12px] text-[#8E8E93]">
                            {MEAL_TYPE_LABELS[meal.mealType]} · {meal.calories} kcal
                            {meal.proteinG != null ? ` · ${meal.proteinG} g P` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingMeal(meal)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8E8E93]"
                          aria-label="Modifier l’aliment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(meal.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8E8E93]"
                          aria-label="Supprimer le repas"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
              <MealBudgetsCard
                targetCalories={targetCalories}
                morphology={profile.morphology}
                meals={meals}
              />
            </section>
          ) : null}
        </div>

        {advancedOpen ? (
          <div className="space-y-6 border-t border-white/8 pt-6">
            <NutritionPlanCard profile={profile} onChange={onChangeProfile} />
            <WeightPaceCard profile={profile} />
            <SmartWaterGauge weightKg={profile.weightKg} />
          </div>
        ) : null}
      </div>

      <MealPhotoAnalyzer
        ref={photoRef}
        variant="headless"
        onToast={showToast}
        onAnalyzed={(result) => {
          const journal = addMealToDate(selectedDateKey, {
            name: result.name,
            mealType: result.mealType,
            calories: result.calories,
            proteinG: result.proteines,
            carbsG: result.glucides,
            fatG: result.lipides,
          })
          setMeals(journal.meals)
            setTick((n) => n + 1)
          setJournalDetailOpen(true)
        }}
      />

      <BarcodeScanner
        open={scannerOpen && !showForm}
        onClose={() => setScannerOpen(false)}
        onProduct={handleScannedProduct}
      />

      {showForm ? (
        <AddFoodScreen
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
            const journal = addMealToDate(selectedDateKey, {
              name: result.name,
              mealType: result.mealType,
              calories: result.calories,
              proteinG: result.proteinG,
              carbsG: result.carbsG,
              fatG: result.fatG,
            })
            setMeals(journal.meals)
            setTick((n) => n + 1)
            resetForm()
            setJournalDetailOpen(true)
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

      <ScannedProductSheet
        open={scannedProduct != null}
        product={scannedProduct}
        targetCalories={targetCalories}
        morphology={profile.morphology as BodyMorphology}
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

      <NutritionCalendarSheet
        open={calendarOpen}
        selectedDateKey={selectedDateKey}
        dataDateKeys={dataDateKeys}
        onClose={() => setCalendarOpen(false)}
        onSelect={selectDate}
        onToday={() => selectDate(todayKey())}
      />

      <IosSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Nutrition"
        subtitle="Réglages et outils"
      >
        <div className="space-y-2 pb-4">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onOpenSetup()
            }}
            className="ios-press flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left"
          >
            <RotateCcw className="h-4 w-4 text-[#AEAEB2]" />
            <span className="text-[15px] font-medium text-white">Refaire le setup</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setAdvancedOpen((v) => !v)
            }}
            className="ios-press flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left"
          >
            <Ellipsis className="h-4 w-4 text-[#AEAEB2]" />
            <span className="text-[15px] font-medium text-white">
              {advancedOpen ? 'Masquer plan & jauge' : 'Plan, rythme & jauge eau'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setJournalDetailOpen(true)
              window.requestAnimationFrame(() => {
                journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })
            }}
            className="ios-press flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left"
          >
            <span className="text-[15px] font-medium text-white">Ouvrir le journal détaillé</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] text-[#8E8E93]"
          >
            <X className="h-4 w-4" />
            Fermer
          </button>
        </div>
      </IosSheet>

      {toast ? (
        <div
          className={`fixed left-1/2 z-[120] max-w-[92%] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-[13px] font-medium shadow-lg ${
            toast.variant === 'error'
              ? 'bottom-[calc(var(--app-bottom-nav)+env(safe-area-inset-bottom,0px)+1rem)] border-[#FF453A]/40 bg-[#2C1014]/95 text-[#FF6961]'
              : 'bottom-[calc(var(--app-bottom-nav)+env(safe-area-inset-bottom,0px)+1rem)] border-[#30D158]/35 bg-[#102C18]/95 text-white'
          }`}
          role={toast.variant === 'error' ? 'alert' : 'status'}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
