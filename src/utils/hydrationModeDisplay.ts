import {
  CLASSIC_BOTTLE_15_ML,
  CLASSIC_BOTTLE_ML,
  GLASS_ML,
  WATER_CONTAINER_CAPACITY_ML,
  type HydrationMode,
  type WaterContainerKind,
} from '../shared/hydration'

/** Shell PNG sous public/assets/hydration/. */
export function shellForMode(mode: HydrationMode): string {
  switch (mode) {
    case 'glasses_250':
      return '/assets/hydration/shell_glass.png'
    case 'classic_15':
      return '/assets/hydration/shell_bottle_15.png'
    case 'classic_2l':
      return '/assets/hydration/shell_bottle_15.png'
    case 'my_bottle':
      return '/assets/hydration/shell_gourde.png'
    default:
      return '/assets/hydration/shell_bottle_15.png'
  }
}

/** Kind LiveBottleVisual — classic_2l réutilise le shell 1,5 L avec capacité 2 L. */
export function kindForMode(mode: HydrationMode): WaterContainerKind {
  switch (mode) {
    case 'glasses_250':
      return 'glass_25'
    case 'my_bottle':
      return 'gourd'
    case 'classic_15':
    case 'classic_2l':
    default:
      return 'plastic_15'
  }
}

export function capacityForMode(
  mode: HydrationMode,
  myBottleVolumeMl?: number | null,
): number {
  if (mode === 'glasses_250') return GLASS_ML
  if (mode === 'classic_15') return CLASSIC_BOTTLE_15_ML
  if (mode === 'classic_2l') return CLASSIC_BOTTLE_ML
  if (mode === 'my_bottle' && myBottleVolumeMl != null && myBottleVolumeMl > 0) {
    return myBottleVolumeMl
  }
  return WATER_CONTAINER_CAPACITY_ML.plastic_15
}

/** Titre carrousel (court). */
export function carouselTitleForMode(mode: HydrationMode): string {
  switch (mode) {
    case 'glasses_250':
      return 'Verre'
    case 'classic_15':
      return 'Bouteille'
    case 'classic_2l':
      return 'Bouteille'
    case 'my_bottle':
      return 'Ma bouteille'
    default:
      return 'Bouteille'
  }
}

/** Sous-titre carrousel (capacité / PRO). */
export function carouselDetailForMode(mode: HydrationMode): string {
  switch (mode) {
    case 'glasses_250':
      return '250 ml'
    case 'classic_15':
      return '1,5 L'
    case 'classic_2l':
      return '2 L'
    case 'my_bottle':
      return 'PRO'
    default:
      return '2 L'
  }
}

/**
 * Libellé cohérent carte Eau / écran bouteille.
 * classic_2l → jamais « Cristaline 1,5 L ».
 */
export function bottleScreenLabelForMode(mode: HydrationMode): string {
  switch (mode) {
    case 'glasses_250':
      return 'Verre 250 ml'
    case 'classic_15':
      return 'Cristaline 1,5 L'
    case 'classic_2l':
      return 'Bouteille 2 L'
    case 'my_bottle':
      return 'Ma bouteille'
    default:
      return 'Bouteille 2 L'
  }
}

/** Ordre carrousel B v2. */
export const WATER_SETTINGS_CAROUSEL_ORDER: readonly HydrationMode[] = [
  'glasses_250',
  'classic_15',
  'classic_2l',
  'my_bottle',
] as const
