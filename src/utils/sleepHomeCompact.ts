import type { SleepHomeViewModel } from '../services/sleepEngineAdapter'
import type { SleepQuantityStatus } from '../sleep-engine'

export type SleepHomeCompactAction = 'log' | 'details'

export interface SleepHomeCompactView {
  action: SleepHomeCompactAction
  actionLabel: 'Enregistrer' | 'Voir'
  secondaryLine: string
}

/** Libellé court Accueil dérivé du statut moteur — pas de « Bon » inventé. */
export function compactHomeQuantityStatusLabel(status: SleepQuantityStatus): string {
  switch (status) {
    case 'optimal':
      return 'Récupération optimale'
    case 'deficit':
      return 'Nuit courte'
    case 'excess':
      return 'Au-dessus de la plage recommandée'
  }
}

export function sleepHomeStatusColorClass(status: SleepQuantityStatus | null): string {
  switch (status) {
    case 'optimal':
      return 'text-[#A78BFA]'
    case 'deficit':
      return 'text-[#FF9F0A]'
    case 'excess':
      return 'text-[#AEAEB2]'
    default:
      return 'text-[#AEAEB2]'
  }
}

export function getSleepHomeCompactView(
  snapshot: Pick<
    SleepHomeViewModel,
    'hasData' | 'tstKnown' | 'tstLabel' | 'tibLabel' | 'statusKey' | 'statusLabel'
  >,
): SleepHomeCompactView {
  if (!snapshot.hasData) {
    return {
      action: 'log',
      actionLabel: 'Enregistrer',
      secondaryLine: 'Comment était ta nuit ?',
    }
  }

  if (snapshot.tstKnown && snapshot.tstLabel) {
    const statusPart = snapshot.statusKey
      ? compactHomeQuantityStatusLabel(snapshot.statusKey)
      : snapshot.statusLabel
    return {
      action: 'details',
      actionLabel: 'Voir',
      secondaryLine: statusPart
        ? `${snapshot.tstLabel} dormies · ${statusPart}`
        : `${snapshot.tstLabel} dormies`,
    }
  }

  const tibPart = snapshot.tibLabel ? `${snapshot.tibLabel} au lit` : '—'
  return {
    action: 'details',
    actionLabel: 'Voir',
    secondaryLine: `${tibPart} · Sommeil non estimé`,
  }
}
