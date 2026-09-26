/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatMealPortionLabel,
  NutritionDayMealsCard,
} from './NutritionDayMealsCard'
import type { MealEntry } from '../../types/nutrition'

const fixtures: MealEntry[] = [
  {
    id: 'm-scan',
    name: 'Yaourt nature OFF',
    mealType: 'breakfast',
    calories: 90,
    proteinG: 8,
    grams: 125,
    createdAt: 1,
  },
  {
    id: 'm-manual',
    name: 'Poulet riz maison',
    mealType: 'lunch',
    calories: 520,
    createdAt: 2,
  },
  {
    id: 'm-ia',
    name: 'Repas (IA)',
    mealType: 'dinner',
    calories: 610,
    proteinG: 35,
    carbsG: 55,
    fatG: 22,
    createdAt: 3,
  },
  {
    id: 'm-pieces',
    name: 'Nuggets',
    mealType: 'snack',
    calories: 280,
    pieces: 4,
    createdAt: 4,
  },
  {
    id: 'm-breakfast-2',
    name: 'Café latte',
    mealType: 'breakfast',
    calories: 120,
    createdAt: 5,
  },
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('formatMealPortionLabel', () => {
  it('préfère pièces, sinon grammes, sinon null', () => {
    expect(formatMealPortionLabel({ pieces: 4 })).toBe('4 pièces')
    expect(formatMealPortionLabel({ pieces: 1 })).toBe('1 pièce')
    expect(formatMealPortionLabel({ grams: 125 })).toBe('125 g')
    expect(formatMealPortionLabel({ grams: 12.5 })).toBe('12.5 g')
    expect(formatMealPortionLabel({})).toBeNull()
  })
})

describe('NutritionDayMealsCard', () => {
  it('replié par défaut ; déplier/replier breakfast ; filtre mealType', async () => {
    const onAdd = vi.fn()
    const onEdit = vi.fn()
    await act(async () => {
      root.render(
        <NutritionDayMealsCard meals={fixtures} onAddMeal={onAdd} onEditMeal={onEdit} />,
      )
    })

    expect(host.textContent).toContain('Petit-déjeuner')
    expect(host.textContent).toContain('Déjeuner')
    // Panels hidden by default
    expect(host.querySelector('[data-meal-panel="breakfast"]')?.closest('[hidden]')).toBeTruthy()

    const breakfastToggle = host.querySelector(
      '[data-meal-toggle="breakfast"]',
    ) as HTMLButtonElement
    expect(breakfastToggle.getAttribute('aria-expanded')).toBe('false')

    await act(async () => {
      breakfastToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(breakfastToggle.getAttribute('aria-expanded')).toBe('true')
    const panel = host.querySelector('[data-meal-panel="breakfast"]')
    expect(panel?.closest('[hidden]')).toBeNull()
    expect(panel?.textContent).toContain('Yaourt nature OFF')
    expect(panel?.textContent).toContain('Café latte')
    expect(panel?.textContent).toContain('125 g')
    expect(panel?.textContent).not.toContain('Poulet riz maison')
    expect(panel?.textContent).not.toContain('Repas (IA)')

    await act(async () => {
      breakfastToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(breakfastToggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('bouton + n’ouvre pas l’accordéon et appelle onAddMeal', async () => {
    const onAdd = vi.fn()
    await act(async () => {
      root.render(<NutritionDayMealsCard meals={fixtures} onAddMeal={onAdd} />)
    })
    const addLunch = host.querySelector('[data-meal-add="lunch"]') as HTMLButtonElement
    await act(async () => {
      addLunch.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onAdd).toHaveBeenCalledWith('lunch')
    expect(host.querySelector('[data-meal-toggle="lunch"]')?.getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('aliment sans portion : kcal seuls ; tap ouvre onEditMeal', async () => {
    const onEdit = vi.fn()
    await act(async () => {
      root.render(
        <NutritionDayMealsCard meals={fixtures} onAddMeal={vi.fn()} onEditMeal={onEdit} />,
      )
    })
    const lunchToggle = host.querySelector('[data-meal-toggle="lunch"]') as HTMLButtonElement
    await act(async () => {
      lunchToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const row = [...host.querySelectorAll('[data-meal-panel="lunch"] button')].find((b) =>
      b.textContent?.includes('Poulet riz maison'),
    ) as HTMLButtonElement
    expect(row.textContent).toContain('520 kcal')
    expect(row.textContent).not.toMatch(/\d+\s*g/)
    expect(row.textContent).not.toContain('pièce')
    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-manual', name: 'Poulet riz maison' }),
    )
  })

  it('repas vide : pas de chevron / toggle ; snack avec pièces', async () => {
    await act(async () => {
      root.render(
        <NutritionDayMealsCard
          meals={fixtures.filter((m) => m.mealType !== 'breakfast')}
          onAddMeal={vi.fn()}
        />,
      )
    })
    expect(host.querySelector('[data-meal-toggle="breakfast"]')).toBeNull()

    const snackToggle = host.querySelector('[data-meal-toggle="snack"]') as HTMLButtonElement
    await act(async () => {
      snackToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-meal-panel="snack"]')?.textContent).toContain('4 pièces')
    expect(host.querySelector('[data-meal-panel="snack"]')?.textContent).toContain('Nuggets')
  })

  it('filtre par date : n’affiche que les meals passés (selectedDateKey côté parent)', async () => {
    const dayA = fixtures.filter((m) => m.mealType === 'dinner')
    await act(async () => {
      root.render(<NutritionDayMealsCard meals={dayA} onAddMeal={vi.fn()} />)
    })
    expect(host.querySelector('[data-meal-toggle="dinner"]')).toBeTruthy()
    expect(host.querySelector('[data-meal-toggle="lunch"]')).toBeNull()
    await act(async () => {
      host
        .querySelector('[data-meal-toggle="dinner"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-meal-panel="dinner"]')?.textContent).toContain('Repas (IA)')
  })

  it('ne contient pas RPE', async () => {
    await act(async () => {
      root.render(<NutritionDayMealsCard meals={fixtures} onAddMeal={vi.fn()} />)
    })
    expect(host.textContent).not.toContain('RPE')
  })
})
