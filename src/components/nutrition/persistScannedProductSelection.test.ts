import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveAliment = vi.fn()

vi.mock('../../services/alimentsService', () => ({
  saveAliment,
}))

describe('persistScannedProductSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns false without writing when user is missing', async () => {
    const { persistScannedProductSelection } = await import('./persistScannedProductSelection')
    const onError = vi.fn()
    const result = await persistScannedProductSelection(
      {
        barcode: '123',
        nom: 'Riz',
        calories: 350,
        proteines: 7,
        glucides: 78,
        lipides: 1,
        provenance: 'open_food_facts',
        fetchedAt: Date.now(),
      },
      null,
      onError,
    )
    expect(result).toBe(false)
    expect(saveAliment).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('surfaces a visible french error when saveAliment fails', async () => {
    saveAliment.mockRejectedValue(new Error('convex save failed'))
    const { persistScannedProductSelection } = await import('./persistScannedProductSelection')
    const onError = vi.fn()
    const result = await persistScannedProductSelection(
      {
        barcode: '123',
        nom: 'Riz',
        calories: 350,
        proteines: 7,
        glucides: 78,
        lipides: 1,
        provenance: 'open_food_facts',
        fetchedAt: Date.now(),
      },
      'user-1',
      onError,
    )
    expect(result).toBe(false)
    expect(onError).toHaveBeenCalledWith('Impossible d’enregistrer cet aliment.')
  })
})
