/** @vitest-environment jsdom */
/**
 * QA 7 / PC-06 — hors ligne : Valider grisé + message réseau (plus « marche quand même »).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  AddFoodScreenV3,
  FOOD_ADD_V3_OFFLINE_REQUIRED_MSG,
} from './AddFoodScreenV3'
import { queryByText } from './testGetByText'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

function noop() {}

describe('AddFoodScreenV3 — hors ligne requis (PC-06)', () => {
  it('forceOfflineImages : bannière + Valider sélection désactivé ; pas « marche quand même »', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="pomme"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[
            {
              barcode: '1',
              nom: 'Pomme',
              brands: '',
              calories: 52,
              proteines: 0.3,
              glucides: 14,
              lipides: 0.2,
              imageUrl: '',
              servingSize: '100 g',
              categoriesTags: [],
              provenance: 'open_food_facts',
              fetchedAt: 1,
            },
          ]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
          name=""
          onNameChange={noop}
          mealType="lunch"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
          forceOfflineImages
        />,
      )
    })

    // Portal → document.body
    const banner = document.querySelector('[data-food-offline-banner]') as HTMLElement
    expect(banner).toBeTruthy()
    expect(banner.textContent).toContain(FOOD_ADD_V3_OFFLINE_REQUIRED_MSG)
    expect(queryByText(document.body, 'marche quand même', { exact: false })).toBeNull()

    await act(async () => {
      ;(
        document.querySelector(
          '[data-food-card][aria-pressed="false"]',
        ) as HTMLButtonElement
      ).click()
    })
    const barBtn = document.querySelector(
      '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
    ) as HTMLButtonElement
    expect(barBtn).toBeTruthy()
    expect(barBtn.disabled).toBe(true)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
