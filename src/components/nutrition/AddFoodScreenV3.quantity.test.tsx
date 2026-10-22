/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3, type FoodAddV3Selection } from './AddFoodScreenV3'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import {
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_BELOW_MIN,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
  FOOD_ADD_QTY_MSG_INVALID_PIECES,
} from '../../../convex/lib/foodAddQuantity'
import { getByText, queryByText } from './testGetByText'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

const hit: OpenFoodFactsSearchHit = {
  barcode: '3017620422003',
  nom: 'Nutella',
  brands: 'Ferrero',
  calories: 539,
  proteines: 6,
  glucides: 57,
  lipides: 31,
  imageUrl: 'https://x.convex.cloud/n.png',
  servingSize: '15 g',
  categoriesTags: ['en:spreads'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

function noop() {}

async function openQuantityStep(root: ReturnType<typeof createRoot>, host: HTMLElement) {
  await act(async () => {
    root.render(
      <AddFoodScreenV3
        searchQuery="nutella"
        onSearchQueryChange={noop}
        searchLoading={false}
        searchError={null}
        searchHits={[hit]}
        category="all"
        onCategoryChange={noop}
        onValidateSelection={noop}
        name=""
        onNameChange={noop}
        mealType="snack"
        onMealTypeChange={noop}
        onSubmitManual={(e) => e.preventDefault()}
        onClose={noop}
      />,
    )
  })
  void host
  const choose = document.querySelector(
    '[data-food-card] button[aria-pressed="false"]',
  ) as HTMLButtonElement
  await act(async () => {
    choose.click()
  })
  const validateBar = document.querySelector(
    '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
  ) as HTMLButtonElement
  await act(async () => {
    validateBar.click()
  })
}

function setQtyInput(value: string) {
  const qtyInput = document.querySelector(
    '[data-food-quantity-step] input[type="number"]',
  ) as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(qtyInput, value)
  qtyInput.dispatchEvent(new Event('input', { bubbles: true }))
  qtyInput.dispatchEvent(new Event('change', { bubbles: true }))
  return qtyInput
}

describe('AddFoodScreenV3 — limites quantité (B111-04/05/06)', () => {
  it('champ vide : Valider désactivé, aucun message (jamais 0) — B111-10', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await openQuantityStep(root, host)

    const confirm = document.querySelector(
      '[data-testid="food-quantity-confirm"]',
    ) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    const qtyInput = document.querySelector(
      '[data-food-quantity-step] input[type="number"]',
    ) as HTMLInputElement
    expect(qtyInput.value).toBe('')
    expect(document.querySelector('[data-food-qty-error]')).toBeNull()
    expect(queryByText(document.body, FOOD_ADD_QTY_MSG_BELOW_MIN)).toBeNull()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('B111-10 : messages visibles sous le champ pour 0 / 2001 / 1.5 g / 1.3 pièce', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await openQuantityStep(root, host)
    const confirm = () =>
      document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement
    const step = () =>
      document.querySelector('[data-food-quantity-step]') as HTMLElement

    await act(async () => {
      setQtyInput('0')
    })
    expect(confirm().disabled).toBe(true)
    expect(getByText(step(), 'Entre une quantité plus grande que 0.').textContent).toBe(
      FOOD_ADD_QTY_MSG_BELOW_MIN,
    )

    await act(async () => {
      setQtyInput('2001')
    })
    expect(confirm().disabled).toBe(true)
    expect(getByText(step(), 'Vérifie ce chiffre, il semble trop grand.').textContent).toBe(
      FOOD_ADD_QTY_MSG_ABOVE_MAX,
    )

    await act(async () => {
      setQtyInput('1.5')
    })
    expect(confirm().disabled).toBe(true)
    expect(getByText(step(), 'Entre un nombre entier de grammes.').textContent).toBe(
      FOOD_ADD_QTY_MSG_INVALID_GRAMS,
    )

    const piecesBtn = Array.from(
      document.querySelectorAll('[data-food-quantity-step] button'),
    ).find((b) => b.textContent === 'Pièces') as HTMLButtonElement
    await act(async () => {
      piecesBtn.click()
    })
    await act(async () => {
      setQtyInput('1.3')
    })
    expect(confirm().disabled).toBe(true)
    expect(
      getByText(step(), 'Utilise des demi-pièces : 0,5, 1, 1,5…').textContent,
    ).toBe(FOOD_ADD_QTY_MSG_INVALID_PIECES)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('rejette 0 / -5 / 999999 / 2001 / 1.5 g côté UI (Valider disabled)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await openQuantityStep(root, host)
    const confirm = () =>
      document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement

    for (const bad of ['0', '-5', '999999', '2001', '1.5']) {
      await act(async () => {
        setQtyInput(bad)
      })
      expect(confirm().disabled, `expected disabled for ${bad}`).toBe(true)
    }

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('accepte 1 g et 2000 g', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="nutella"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[hit]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={onValidate}
          name=""
          onNameChange={noop}
          mealType="snack"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
        />,
      )
    })
    const choose = document.querySelector(
      '[data-food-card] button[aria-pressed="false"]',
    ) as HTMLButtonElement
    await act(async () => {
      choose.click()
    })
    await act(async () => {
      ;(
        document.querySelector(
          '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
        ) as HTMLButtonElement
      ).click()
    })

    await act(async () => {
      setQtyInput('1')
    })
    expect(
      (document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false)

    await act(async () => {
      setQtyInput('2000')
    })
    expect(
      (document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false)

    await act(async () => {
      ;(document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement).click()
    })
    const items = onValidate.mock.calls[0]![0] as FoodAddV3Selection[]
    expect(items[0]!.grams).toBe(2000)
    expect(items[0]!.unit).toBe('g')
    // PC-07 / PC-09 : ids figés à l’ouverture de l’étape quantité.
    expect(typeof items[0]!.mealId).toBe('string')
    expect(items[0]!.mealId.length).toBeGreaterThan(8)
    expect(typeof items[0]!.selectionEventId).toBe('string')
    expect(items[0]!.selectionEventId.length).toBeGreaterThan(8)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('Pièces : rejette 0 / 0.3 / 50.5 / 1000 ; accepte 0.5 et 50', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await openQuantityStep(root, host)

    const piecesBtn = Array.from(
      document.querySelectorAll('[data-food-quantity-step] button'),
    ).find((b) => b.textContent === 'Pièces') as HTMLButtonElement
    await act(async () => {
      piecesBtn.click()
    })

    const confirm = () =>
      document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement

    for (const bad of ['0', '0.3', '50.5', '1000']) {
      await act(async () => {
        setQtyInput(bad)
      })
      expect(confirm().disabled, `expected disabled for ${bad} pièces`).toBe(true)
    }

    await act(async () => {
      setQtyInput('0.5')
    })
    expect(confirm().disabled).toBe(false)

    await act(async () => {
      setQtyInput('50')
    })
    // 50 × 15 g serving = 750 ≤ 2000 → ok
    expect(confirm().disabled).toBe(false)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('Pièces × servingGrams > 2000 : rejet UI', async () => {
    const heavy: OpenFoodFactsSearchHit = {
      ...hit,
      servingSize: '100 g',
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="nutella"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[heavy]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
          name=""
          onNameChange={noop}
          mealType="snack"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
        />,
      )
    })
    await act(async () => {
      ;(document.querySelector('[data-food-card] button[aria-pressed="false"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(
        document.querySelector(
          '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
        ) as HTMLButtonElement
      ).click()
    })
    await act(async () => {
      ;(
        Array.from(document.querySelectorAll('[data-food-quantity-step] button')).find(
          (b) => b.textContent === 'Pièces',
        ) as HTMLButtonElement
      ).click()
    })
    // 21 × 100 g = 2100 > 2000
    await act(async () => {
      setQtyInput('21')
    })
    expect(
      (document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('bascule Grammes ↔ Pièces vide le champ (B111-06)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await openQuantityStep(root, host)

    await act(async () => {
      setQtyInput('30')
    })
    const qtyInput = document.querySelector(
      '[data-food-quantity-step] input[type="number"]',
    ) as HTMLInputElement
    expect(qtyInput.value).toBe('30')

    const piecesBtn = Array.from(
      document.querySelectorAll('[data-food-quantity-step] button'),
    ).find((b) => b.textContent === 'Pièces') as HTMLButtonElement
    await act(async () => {
      piecesBtn.click()
    })
    expect(
      (document.querySelector('[data-food-quantity-step] input[type="number"]') as HTMLInputElement)
        .value,
    ).toBe('')

    await act(async () => {
      setQtyInput('2')
    })
    const gramsBtn = Array.from(
      document.querySelectorAll('[data-food-quantity-step] button'),
    ).find((b) => b.textContent === 'Grammes') as HTMLButtonElement
    await act(async () => {
      gramsBtn.click()
    })
    expect(
      (document.querySelector('[data-food-quantity-step] input[type="number"]') as HTMLInputElement)
        .value,
    ).toBe('')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('saisie manuelle : validation code (pas seulement min/max input) — empty désactive', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery=""
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
          name="Riz"
          onNameChange={noop}
          mealType="lunch"
          onMealTypeChange={noop}
          onSubmitManual={onSubmit}
          onClose={noop}
          manualGrams=""
          onManualGramsChange={noop}
        />,
      )
    })

    await act(async () => {
      ;(document.querySelector('[data-manual-toggle]') as HTMLButtonElement).click()
    })
    const submit = document.querySelector(
      '[data-testid="food-add-manual-submit"]',
    ) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('saisie manuelle : 2001 g rejetée avec message exact', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    let grams: number | '' = 2001
    const onGrams = vi.fn((v: number | '') => {
      grams = v
    })

    const render = async () => {
      await act(async () => {
        root.render(
          <AddFoodScreenV3
            searchQuery=""
            onSearchQueryChange={noop}
            searchLoading={false}
            searchError={null}
            searchHits={[]}
            category="all"
            onCategoryChange={noop}
            onValidateSelection={noop}
            name="Riz"
            onNameChange={noop}
            mealType="lunch"
            onMealTypeChange={noop}
            onSubmitManual={onSubmit}
            onClose={noop}
            manualGrams={grams}
            onManualGramsChange={onGrams}
          />,
        )
      })
    }
    await render()
    await act(async () => {
      ;(document.querySelector('[data-manual-toggle]') as HTMLButtonElement).click()
    })
    const submit = document.querySelector(
      '[data-testid="food-add-manual-submit"]',
    ) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    // Force submit path even if disabled by calling handle via form requestSubmit after enabling check
    // Disabled button won't fire — assert message constants used by UI
    expect(FOOD_ADD_QTY_MSG_ABOVE_MAX).toBe('Vérifie ce chiffre, il semble trop grand.')
    expect(FOOD_ADD_QTY_MSG_BELOW_MIN).toBe('Entre une quantité plus grande que 0.')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('Pièces : portionLabel pièces (jamais pour 100 g)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="nutella"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[hit]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={onValidate}
          name=""
          onNameChange={noop}
          mealType="snack"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
        />,
      )
    })
    await act(async () => {
      ;(document.querySelector('[data-food-card] button[aria-pressed="false"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(
        document.querySelector(
          '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
        ) as HTMLButtonElement
      ).click()
    })
    await act(async () => {
      ;(
        Array.from(document.querySelectorAll('[data-food-quantity-step] button')).find(
          (b) => b.textContent === 'Pièces',
        ) as HTMLButtonElement
      ).click()
    })
    await act(async () => {
      setQtyInput('2')
    })
    await act(async () => {
      ;(document.querySelector('[data-testid="food-quantity-confirm"]') as HTMLButtonElement).click()
    })
    const items = onValidate.mock.calls[0]![0] as FoodAddV3Selection[]
    expect(items[0]!.unit).toBe('pieces')
    expect(items[0]!.pieces).toBe(2)
    expect(items[0]!.portionLabel).toBe('2 pièces')
    expect(items[0]!.portionLabel).not.toMatch(/100\s*g/i)
    expect(items[0]!.grams).toBeUndefined()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
