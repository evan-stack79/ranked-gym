import type { SleepFeelingLevel } from '../../services/sleepStorage'

export const SLEEP_FEELING_LABELS: Record<SleepFeelingLevel, string> = {
  1: 'Très mal',
  2: 'Mal',
  3: 'Moyen',
  4: 'Bien',
  5: 'Très bien',
}

export const SLEEP_PANTHER_SRC: Record<SleepFeelingLevel, string> = {
  1: '/sleep/tete_1.png',
  2: '/sleep/tete_2.png',
  3: '/sleep/tete_3.png',
  4: '/sleep/tete_4.png',
  5: '/sleep/tete_5.png',
}

/** Tête calme pour panthère « qui dort » (assets existants seulement). */
export const SLEEP_PANTHER_SLEEPING_SRC = SLEEP_PANTHER_SRC[3]
