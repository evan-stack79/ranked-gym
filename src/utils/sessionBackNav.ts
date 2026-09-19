/**
 * Navigation retour séance immersive ↔ hub Train (historique PWA / Android).
 * Une seule entrée d’historique par séance — pas de copies ni de boucles.
 */

export const SESSION_HISTORY_KEY = 'rankedGymTrainSession'

export type SessionHistoryState = {
  [SESSION_HISTORY_KEY]?: true
}

export function isSessionHistoryState(state: unknown): state is SessionHistoryState {
  return Boolean(
    state &&
      typeof state === 'object' &&
      (state as SessionHistoryState)[SESSION_HISTORY_KEY] === true,
  )
}

/** Push une entrée uniquement si on n’est pas déjà sur la séance (anti-doublon). */
export function pushSessionHistory(history: History = window.history): void {
  if (isSessionHistoryState(history.state)) return
  history.pushState({ [SESSION_HISTORY_KEY]: true } satisfies SessionHistoryState, '')
}

/**
 * Soft-leave via flèche : retire l’entrée séance si présente.
 * `popstate` gérera le soft-leave côté UI — ici on ne fait que `back`.
 * Si pas d’entrée séance (ex. deep open), no-op historique.
 */
export function popSessionHistoryIfNeeded(history: History = window.history): boolean {
  if (!isSessionHistoryState(history.state)) return false
  history.back()
  return true
}

/** Après soft-leave via popstate : nettoyer un éventuel état résiduel sans re-push. */
export function replaceHubHistory(history: History = window.history): void {
  if (!isSessionHistoryState(history.state)) return
  const next = { ...(history.state as object) } as SessionHistoryState
  delete next[SESSION_HISTORY_KEY]
  history.replaceState(Object.keys(next).length ? next : {}, '')
}

/**
 * Décide si une séance active doit être rouverte automatiquement.
 * Voluntary hub leave → non. Cold start / OS resume sans flag → oui.
 */
export function shouldAutoReopenSession(opts: {
  hasActiveDraft: boolean
  lastVoluntaryRoute: string | null | undefined
}): boolean {
  if (!opts.hasActiveDraft) return false
  return opts.lastVoluntaryRoute !== 'train-hub'
}
