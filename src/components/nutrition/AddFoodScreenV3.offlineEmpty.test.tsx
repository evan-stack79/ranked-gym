/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3 } from './AddFoodScreenV3'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

function noop() {}

describe('AddFoodScreenV3 — vide hors ligne', () => {
  it('affiche un message hors ligne clair (pas « Aucun produit trouvé »)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="banane"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
          onOpenScanner={noop}
          onToast={noop}
          onPhotoAnalyzed={noop}
          name=""
          onNameChange={noop}
          calories={0}
          onCaloriesChange={noop}
          proteinG=""
          onProteinChange={noop}
          carbsG=""
          onCarbsChange={noop}
          fatG=""
          onFatChange={noop}
          mealType="lunch"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
          forceOfflineImages
        />,
      )
    })

    const empty = document.querySelector('[data-food-empty-state]')
    expect(empty?.textContent).toMatch(/Pas de connexion/i)
    expect(empty?.textContent).not.toMatch(/Aucun produit trouvé/i)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
