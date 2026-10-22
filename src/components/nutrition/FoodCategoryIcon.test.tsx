/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { FoodCategoryIcon } from './FoodCategoryIcon'
import { FoodProductCard } from './FoodProductCard'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

describe('FoodCategoryIcon / cartes V3', () => {
  it('rend une icône SVG locale (pas d’img externe)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FoodCategoryIcon categoriesTags={['en:croissants']} size={64} />)
    })
    const el = document.querySelector('[data-food-category-icon="viennoiserie"]')
    expect(el).toBeTruthy()
    expect(el?.querySelector('svg')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('FoodProductCard : icône catégorie, jamais imageUrl OFF', async () => {
    const hit: OpenFoodFactsSearchHit = {
      barcode: '1',
      nom: 'Croissant test',
      brands: '',
      calories: 375,
      proteines: null,
      glucides: null,
      lipides: null,
      imageUrl: 'https://images.openfoodfacts.org/fake.jpg',
      servingSize: '60 g',
      categoriesTags: ['en:croissants'],
      provenance: 'open_food_facts',
      fetchedAt: 1,
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FoodProductCard hit={hit} selected={false} onToggle={() => {}} />)
    })
    expect(document.querySelector('[data-food-icon-category="viennoiserie"]')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('[data-off-image]')).toBeNull()
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
