/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act, type ComponentProps } from 'react'
import type { OpenFoodFactsProduct } from '../../services/alimentsService'
import { getNutritionTarget, hasMealTargets } from '../../services/nutritionActivity'
import type { CalorieProfile, MealEntry } from '../../types/nutrition'
import { detectPieceKind } from '../../utils/piecePortion'
import { sanitizeQuantityRaw } from './ClearableNumberInput'
import { EditMealSheet } from './EditMealSheet'
import { guessMealType, ScannedProductSheet } from './ScannedProductSheet'

const PRODUCT: OpenFoodFactsProduct = {
  barcode: '3017620422003',
  nom: 'Le petit ketchup mayo',
  calories: 286,
  proteines: 1.2,
  glucides: 20,
  lipides: 22,
  provenance: 'open_food_facts',
  fetchedAt: Date.now(),
}

const ADULT: CalorieProfile = {
  weightKg: 75,
  goalWeightKg: 72,
  heightCm: 175,
  age: 28,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0,
  onboardingComplete: true,
}

async function flushPortal() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function setGramsInput(value: string) {
  const input = document.querySelector(
    'input[aria-label="Quantité en grammes"]',
  ) as HTMLInputElement | null
  expect(input).toBeTruthy()
  await act(async () => {
    input!.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input!, value)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    input!.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return input!
}

describe('refonte ajout repas — AR-05…AR-13 + mineures ciblées', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
    document.body.innerHTML = ''
  })

  async function render(
    overrides: Partial<ComponentProps<typeof ScannedProductSheet>> = {},
  ) {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <ScannedProductSheet
          open
          product={PRODUCT}
          targetCalories={0}
          hasMealTargets={false}
          morphology="mesomorph"
          meals={[]}
          onClose={() => undefined}
          onSave={onSave}
          {...overrides}
        />,
      )
    })
    await flushPortal()
    return { onSave, text: () => document.body.textContent ?? '' }
  }

  it('AR-05 : plus d’étape Uniquement ça / Avec autre chose', async () => {
    const { text } = await render()
    expect(text()).not.toContain('Uniquement ça')
    expect(text()).not.toContain('Avec autre chose')
    expect(text()).not.toContain('Tu manges comment')
    expect(text()).toContain('Repas')
    expect(text()).toContain('Quantité mangée')
  })

  it('AR-06 : bouton Ajouter dans le footer sticky du sheet', async () => {
    await render()
    const buttons = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Ajouter au journal'),
    )
    expect(buttons.length).toBe(1)
    const footer = buttons[0].closest('.shrink-0')
    expect(footer).toBeTruthy()
  })

  it('AR-07 : meals resync ne remet pas les grammes à zéro', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <ScannedProductSheet
          open
          product={PRODUCT}
          targetCalories={0}
          hasMealTargets={false}
          morphology="mesomorph"
          meals={[]}
          preferredMealType="dinner"
          onClose={() => undefined}
          onSave={onSave}
        />,
      )
    })
    await flushPortal()
    await setGramsInput('150')

    await act(async () => {
      root.render(
        <ScannedProductSheet
          open
          product={PRODUCT}
          targetCalories={0}
          hasMealTargets={false}
          morphology="mesomorph"
          meals={[{ mealType: 'dinner', calories: 10, name: 'Pain' }]}
          preferredMealType="dinner"
          onClose={() => undefined}
          onSave={onSave}
        />,
      )
    })
    await flushPortal()

    const input = document.querySelector(
      'input[aria-label="Quantité en grammes"]',
    ) as HTMLInputElement
    expect(input.value).toBe('150')
    expect(document.body.textContent).toMatch(/Dîner/)
  })

  it('AR-08 : quantité > 3000 g bloque avec message, pas d’enregistrement', async () => {
    const { onSave, text } = await render()
    await setGramsInput('5001')
    expect(text()).toMatch(/maximum 3 000 g/i)
    const add = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter au journal'),
    ) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    await act(async () => {
      add.click()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('AR-08/défaut : 100 g prérempli, résultat immédiat, pas de Balance', async () => {
    const { text } = await render()
    const input = document.querySelector(
      'input[aria-label="Quantité en grammes"]',
    ) as HTMLInputElement
    expect(input.value).toBe('100')
    expect(text()).toMatch(/≈\s*286\s*kcal/)
    expect(text()).toContain('Protéines')
    expect(text()).not.toContain('Balance')
    expect(text()).not.toContain('Grammes affichés')
  })

  it('AR-11 : produit sans kcal — message FR neutre, pas de rouge/logger/NaN', async () => {
    const missing: OpenFoodFactsProduct = {
      ...PRODUCT,
      calories: null,
      proteines: null,
      glucides: null,
      lipides: null,
    }
    const onManual = vi.fn()
    const { text } = await render({
      product: missing,
      onRequestManualEntry: onManual,
    })
    expect(text()).toContain('Les calories de ce produit ne sont pas renseignées.')
    expect(text()).toContain('Saisir les calories moi-même')
    expect(text()).not.toMatch(/logger|NaN|ne fournit pas/i)
    expect(document.querySelector('.border-\\[\\#FF453A\\]\\/35')).toBeNull()
  })

  it('AR-11 : produit 0 kcal — pas d’impasse, ajout possible', async () => {
    const zero: OpenFoodFactsProduct = { ...PRODUCT, calories: 0 }
    const { onSave, text } = await render({ product: zero })
    expect(text()).not.toContain('ne sont pas renseignées')
    const add = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter au journal'),
    ) as HTMLButtonElement
    expect(add.disabled).toBe(false)
    await act(async () => {
      add.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].calories).toBe(0)
    expect(onSave.mock.calls[0][0].portionMode).toBeUndefined()
  })

  it('AR-13 ON adulte : texte neutre, jamais manque/parfait/zone/top', async () => {
    const nutrition = getNutritionTarget(ADULT, { calorieGoalEnabled: true })
    expect(hasMealTargets(nutrition)).toBe(true)
    const { text } = await render({
      hasMealTargets: true,
      targetCalories: nutrition.targetCalories,
    })
    expect(text()).toMatch(/Repère indicatif/)
    expect(text()).not.toMatch(/manquera|parfait|bonne zone|c’est top|budget|zone/i)
  })

  it('AR-13 ON TCA/grossesse/mineur : pas de repère', async () => {
    const profiles: CalorieProfile[] = [
      { ...ADULT, declaredEatingDisorder: true },
      { ...ADULT, sex: 'female', declaredPregnancy: true },
      { ...ADULT, age: 16 },
    ]
    for (const profile of profiles) {
      const nutrition = getNutritionTarget(profile, { calorieGoalEnabled: true })
      expect(hasMealTargets(nutrition)).toBe(false)
      await act(async () => {
        root.render(
          <ScannedProductSheet
            open
            product={PRODUCT}
            targetCalories={nutrition.targetCalories}
            hasMealTargets={false}
            morphology="mesomorph"
            meals={[]}
            onClose={() => undefined}
            onSave={() => undefined}
          />,
        )
      })
      await flushPortal()
      expect(document.body.textContent ?? '').not.toMatch(
        /Repère indicatif|budget|zone|cible/i,
      )
    }
  })

  it('AR-16 : double clic n’enregistre qu’une fois', async () => {
    const { onSave } = await render()
    const add = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter au journal'),
    ) as HTMLButtonElement
    await act(async () => {
      add.click()
      add.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('AR-20 : Baileys ≠ pièces ; nuggets = pièces', () => {
    expect(detectPieceKind('Baileys crème')).toBe('generic')
    expect(detectPieceKind('Nuggets de poulet')).toBe('nugget')
    expect(detectPieceKind('Ailes de poulet')).toBe('wing')
  })

  it('AR-19/collage : sanitizeQuantityRaw accepte « 150 g »', () => {
    expect(sanitizeQuantityRaw('150 g')).toBe('150')
    expect(sanitizeQuantityRaw('61,05')).toBe('61.05')
    expect(sanitizeQuantityRaw(' 61,5 ')).toBe('61.5')
  })

  it('AR-23 : guessMealType — nuit = Collation, matin = Petit-déj', () => {
    expect(guessMealType(new Date(2026, 9, 4, 2, 0))).toBe('snack')
    expect(guessMealType(new Date(2026, 9, 4, 8, 0))).toBe('breakfast')
    expect(guessMealType(new Date(2026, 9, 4, 12, 0))).toBe('lunch')
    expect(guessMealType(new Date(2026, 9, 4, 16, 0))).toBe('snack')
    expect(guessMealType(new Date(2026, 9, 4, 20, 0))).toBe('dinner')
  })

  it('AR-14 : affiche Ajouté à', async () => {
    const { text } = await render({ dateLabel: 'Aujourd’hui' })
    expect(text()).toContain('Ajouté à : Aujourd’hui')
  })

  it('AR-25/27 : bouton Ajouter vert neutre, pas btn-brand rouge', async () => {
    await render()
    const add = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter au journal'),
    ) as HTMLButtonElement
    expect(add.className).toMatch(/30D158/)
    expect(add.className).not.toMatch(/btn-brand/)
  })

  it('AR-10 : modifier les grammes recalcule kcal/macros', async () => {
    const meal: MealEntry = {
      id: 'm1',
      name: 'Ketchup',
      mealType: 'lunch',
      calories: 286,
      proteinG: 1,
      carbsG: 20,
      fatG: 22,
      grams: 100,
      createdAt: Date.now(),
    }
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal}
          onClose={() => undefined}
          onSave={onSave}
          onDelete={() => undefined}
        />,
      )
    })
    await flushPortal()

    const gramsInput = document.querySelector(
      'input[aria-label="Quantité en grammes"]',
    ) as HTMLInputElement
    await act(async () => {
      gramsInput.focus()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(gramsInput, '200')
      gramsInput.dispatchEvent(new Event('input', { bubbles: true }))
      gramsInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const save = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Enregistrer'),
    ) as HTMLButtonElement
    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        grams: 200,
        calories: 572,
        proteinG: 2,
        carbsG: 40,
        fatG: 44,
      }),
    )
  })

  it('AR-09 : suppression demande confirmation', async () => {
    const meal: MealEntry = {
      id: 'm1',
      name: 'Ketchup',
      mealType: 'lunch',
      calories: 100,
      createdAt: Date.now(),
    }
    const onDelete = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal}
          onClose={() => undefined}
          onSave={() => undefined}
          onDelete={onDelete}
        />,
      )
    })
    await flushPortal()
    const del = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Supprimer',
    ) as HTMLButtonElement
    await act(async () => {
      del.click()
    })
    expect(onDelete).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Supprimer « Ketchup » ?')
    const confirm = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Supprimer' && b !== del,
    ) as HTMLButtonElement
    await act(async () => {
      confirm.click()
    })
    expect(onDelete).toHaveBeenCalledWith('m1')
  })
})
