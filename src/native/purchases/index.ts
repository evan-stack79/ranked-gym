import { Capacitor } from '@capacitor/core'
import { createCapgoPurchasesAdapter } from './capgoAdapter'
import { createFakeStoreAdapter } from './fakeStore'
import type { PurchasesAdapter } from './types'

export type { PurchasesAdapter, PurchaseResult, StoreOffer } from './types'

/**
 * Sélection adaptateur :
 * - Natif (iOS/Android) → Capgo
 * - Web / tests → faux store (jamais un grant Pro client)
 *
 * Interdit : argument joueur pour forcer un faux store en build production native.
 */
export function getPurchasesAdapter(): PurchasesAdapter {
  const native = Capacitor.isNativePlatform()
  if (native) return createCapgoPurchasesAdapter()
  return createFakeStoreAdapter()
}

export { createFakeStoreAdapter, createCapgoPurchasesAdapter }
