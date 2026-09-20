import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { playRestCompleteChime } from '../utils/restTimerSound'
import { vibrate } from '../utils/haptics'
import {
  endRestLiveActivity,
  startRestLiveActivity,
  updateRestLiveActivity,
} from '../services/restTimerLiveActivity'
import {
  getTrainingState,
  getTrainingStorageScope,
  persistActiveRestTimer,
} from '../services/trainingStorage'
import {
  remainingFromPersisted,
  type PersistedRestTimer,
} from '../utils/restTimerPersist'

export const REST_PRESETS_SEC = [45, 90, 180] as const
export type RestPresetSec = (typeof REST_PRESETS_SEC)[number]

export type RestTimerTarget = {
  exerciseId: string
  setIndex: number
  exerciseName: string
  setLabel: string
}

export type RestTimerState = {
  active: boolean
  totalSec: number
  remainingSec: number
  target: RestTimerTarget | null
  finished: boolean
  paused: boolean
}

export type RestLoggedPayload = {
  target: RestTimerTarget
  restSec: number
  skipped: boolean
}

const IDLE: RestTimerState = {
  active: false,
  totalSec: 90,
  remainingSec: 90,
  target: null,
  finished: false,
  paused: false,
}

type RestTimerContextValue = {
  state: RestTimerState
  /** Barre « Prêt à lancer » visible uniquement sur Train muscu */
  readyBarEnabled: boolean
  setReadyBarEnabled: (enabled: boolean) => void
  /** Barre visible (décompte ou fin) — tous les onglets */
  isSessionVisible: boolean
  /** Barre affichée (session globale ou ready sur Train) — false si overlay plein écran */
  isBarVisible: boolean
  /**
   * Masque Tab Bar + chrome app (Pump Check / séance immersive / modales plein écran).
   * Ne dismiss PAS le repos : endsAt doit survivre leave→Reprendre et chrome hide immersif.
   */
  chromeHidden: boolean
  setChromeHidden: (hidden: boolean) => void
  start: (seconds: number, target: RestTimerTarget) => void
  pause: () => void
  resume: () => void
  skip: () => void
  dismiss: () => void
  presets: typeof REST_PRESETS_SEC
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null)

function readPersistedRest(): PersistedRestTimer | null {
  try {
    return getTrainingState().activeWorkoutDraft?.restTimer ?? null
  } catch {
    return null
  }
}

function writePersistedRest(snap: PersistedRestTimer | null) {
  try {
    persistActiveRestTimer(snap)
  } catch {
    // trainingStorage a déjà émis l'erreur locale unique et exploitable par l'UI.
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(IDLE)
  const [readyBarEnabled, setReadyBarEnabled] = useState(false)
  const [chromeHidden, setChromeHiddenState] = useState(false)
  /** Force un cycle d’hydratation après restore / changement d’utilisateur. */
  const [hydrateEpoch, setHydrateEpoch] = useState(0)

  const targetRef = useRef<RestTimerTarget | null>(null)
  const totalRef = useRef(90)
  const endsAtRef = useRef(0)
  const remainingRef = useRef(90)
  const pausedRef = useRef(false)
  const finishedRef = useRef(false)
  /** Portée sous laquelle le timer mémoire a été armé — anti copie invité→compte. */
  const scopeRef = useRef(getTrainingStorageScope())
  /** Intervalle local à l’instance (StrictMode-safe : clear au cleanup). */
  const tickIdRef = useRef<number | null>(null)
  /** Une seule expiration traitée par snapshot restauré. */
  const expiredHandledKeyRef = useRef<string | null>(null)
  /** Évite doubles sauvegardes concurrentes du même snapshot. */
  const lastPersistKeyRef = useRef('')
  const persistEnabledRef = useRef(true)

  const clearTick = useCallback(() => {
    if (tickIdRef.current != null) {
      window.clearInterval(tickIdRef.current)
      tickIdRef.current = null
    }
  }, [])

  const resetMemory = useCallback(() => {
    clearTick()
    targetRef.current = null
    totalRef.current = 90
    endsAtRef.current = 0
    remainingRef.current = 90
    pausedRef.current = false
    finishedRef.current = false
    lastPersistKeyRef.current = ''
    expiredHandledKeyRef.current = null
    setState(IDLE)
  }, [clearTick])

  const persistSnap = useCallback((snap: PersistedRestTimer | null) => {
    if (!persistEnabledRef.current) return
    // Ne jamais écrire dans une autre portée (ex. guest → compte).
    if (scopeRef.current !== getTrainingStorageScope()) return
    const key = snap
      ? `${snap.endsAt}|${snap.paused}|${snap.remainingSec}|${snap.target.exerciseId}|${snap.target.setIndex}`
      : 'null'
    if (key === lastPersistKeyRef.current) return
    lastPersistKeyRef.current = key
    writePersistedRest(snap)
  }, [])

  const emitRestLogged = useCallback((payload: RestLoggedPayload) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ranked-gym:rest-logged', { detail: payload }))
    }
  }, [])

  const logRest = useCallback(
    (skipped: boolean) => {
      const target = targetRef.current
      if (!target) return
      const elapsed = Math.max(0, totalRef.current - remainingRef.current)
      const restSec = skipped ? elapsed : totalRef.current
      emitRestLogged({
        target,
        restSec: Math.max(1, Math.round(restSec)),
        skipped,
      })
    },
    [emitRestLogged],
  )

  const complete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTick()
    pausedRef.current = false
    remainingRef.current = 0
    setState((s) => ({
      ...s,
      remainingSec: 0,
      active: false,
      finished: true,
      paused: false,
    }))
    persistSnap(null)
    logRest(false)
    void endRestLiveActivity(true)
    vibrate([40, 60, 40, 60, 80])
    playRestCompleteChime()
  }, [clearTick, logRest, persistSnap])

  const tickOnce = useCallback(() => {
    if (pausedRef.current || finishedRef.current) return
    const next = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
    remainingRef.current = next
    if (next <= 0) {
      complete()
      return
    }
    const target = targetRef.current
    setState((s) => ({
      ...s,
      remainingSec: next,
      active: true,
      finished: false,
      paused: false,
    }))
    if (target) {
      void updateRestLiveActivity({
        remainingSec: next,
        subtitle: `${target.exerciseName} · ${target.setLabel}`,
      })
      if (next === 10 || next === 5 || next === 3 || next === 1) vibrate(10)
    }
  }, [complete])

  const armTick = useCallback(() => {
    clearTick()
    tickIdRef.current = window.setInterval(() => tickOnce(), 250)
  }, [clearTick, tickOnce])

  const start = useCallback(
    (seconds: number, target: RestTimerTarget) => {
      clearTick()
      finishedRef.current = false
      pausedRef.current = false
      expiredHandledKeyRef.current = null
      scopeRef.current = getTrainingStorageScope()
      persistEnabledRef.current = true
      const total = Math.max(1, Math.round(seconds))
      const endsAt = Date.now() + total * 1000
      targetRef.current = target
      totalRef.current = total
      remainingRef.current = total
      endsAtRef.current = endsAt
      setState({
        active: true,
        totalSec: total,
        remainingSec: total,
        target,
        finished: false,
        paused: false,
      })
      persistSnap({
        totalSec: total,
        remainingSec: total,
        endsAt,
        paused: false,
        target,
      })
      void startRestLiveActivity({
        remainingSec: total,
        totalSec: total,
        subtitle: `${target.exerciseName} · ${target.setLabel}`,
      })
      vibrate(10)
      armTick()
    },
    [armTick, clearTick, persistSnap],
  )

  const pause = useCallback(() => {
    if (!targetRef.current || finishedRef.current || pausedRef.current) return
    pausedRef.current = true
    clearTick()
    const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
    remainingRef.current = remaining
    setState((s) => ({ ...s, remainingSec: remaining, active: true, paused: true }))
    persistSnap({
      totalSec: totalRef.current,
      remainingSec: remaining,
      endsAt: endsAtRef.current,
      paused: true,
      target: targetRef.current,
    })
    void updateRestLiveActivity({
      remainingSec: remaining,
      subtitle: `${targetRef.current.exerciseName} · ${targetRef.current.setLabel}`,
    })
  }, [clearTick, persistSnap])

  const resume = useCallback(() => {
    if (!targetRef.current || finishedRef.current || !pausedRef.current) return
    pausedRef.current = false
    const remaining = Math.max(0, remainingRef.current)
    if (remaining <= 0) {
      complete()
      return
    }
    endsAtRef.current = Date.now() + remaining * 1000
    setState((s) => ({
      ...s,
      remainingSec: remaining,
      active: true,
      paused: false,
      finished: false,
    }))
    persistSnap({
      totalSec: totalRef.current,
      remainingSec: remaining,
      endsAt: endsAtRef.current,
      paused: false,
      target: targetRef.current,
    })
    armTick()
  }, [armTick, complete, persistSnap])

  const skip = useCallback(() => {
    if (!targetRef.current) {
      clearTick()
      setState(IDLE)
      persistSnap(null)
      void endRestLiveActivity(true)
      return
    }
    clearTick()
    logRest(true)
    finishedRef.current = false
    pausedRef.current = false
    targetRef.current = null
    setState(IDLE)
    persistSnap(null)
    void endRestLiveActivity(true)
    vibrate(16)
  }, [clearTick, logRest, persistSnap])

  const dismiss = useCallback(() => {
    clearTick()
    finishedRef.current = false
    pausedRef.current = false
    targetRef.current = null
    setState(IDLE)
    persistSnap(null)
    void endRestLiveActivity(true)
  }, [clearTick, persistSnap])

  const armTickRef = useRef(armTick)
  const clearTickRef = useRef(clearTick)
  const resetMemoryRef = useRef(resetMemory)
  armTickRef.current = armTick
  clearTickRef.current = clearTick
  resetMemoryRef.current = resetMemory

  // Écoute portée / restore → re-hydratation (pas de copie mémoire cross-scope).
  useEffect(() => {
    const bump = () => setHydrateEpoch((n) => n + 1)
    window.addEventListener('ranked-gym:backup-restored', bump)
    window.addEventListener('ranked-gym:training-scope-changed', bump)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', bump)
      window.removeEventListener('ranked-gym:training-scope-changed', bump)
    }
  }, [])

  // Cycle d’hydratation idempotent (StrictMode : cleanup annule, remount réapplique).
  useEffect(() => {
    let cancelled = false
    const nextScope = getTrainingStorageScope()
    const scopeChanged = nextScope !== scopeRef.current

    // Changement d’utilisateur / guest→compte : purge mémoire sans écrire l’ancienne portée.
    if (scopeChanged) {
      persistEnabledRef.current = false
      resetMemoryRef.current()
      scopeRef.current = nextScope
      persistEnabledRef.current = true
    }

    const snap = readPersistedRest()
    if (cancelled) {
      return () => {
        cancelled = true
      }
    }

    if (!snap) {
      // Restore / scope sans repos : aligne la mémoire sans écrire cross-scope.
      // Uniquement si scope a changé ou epoch > 0 (restore) — pas un wipe au démarrage idle.
      if (scopeChanged || hydrateEpoch > 0) {
        persistEnabledRef.current = false
        resetMemoryRef.current()
        persistEnabledRef.current = true
      }
      return () => {
        cancelled = true
        clearTickRef.current()
      }
    }

    const remaining = remainingFromPersisted(snap)
    const expireKey = `${nextScope}|${snap.endsAt}|${snap.target.exerciseId}|${snap.target.setIndex}`

    if (remaining <= 0 && !snap.paused) {
      if (expiredHandledKeyRef.current !== expireKey) {
        expiredHandledKeyRef.current = expireKey
        // Expiration hydratée : une seule fois — état final observable, journalisation unique,
        // nettoyage snapshot + activité native, sans son ni double sauvegarde.
        persistEnabledRef.current = true
        scopeRef.current = nextScope
        clearTickRef.current()
        targetRef.current = snap.target
        totalRef.current = snap.totalSec
        remainingRef.current = 0
        pausedRef.current = false
        finishedRef.current = true
        setState({
          active: false,
          totalSec: snap.totalSec,
          remainingSec: 0,
          target: snap.target,
          finished: true,
          paused: false,
        })
        writePersistedRest(null)
        lastPersistKeyRef.current = 'null'
        emitRestLogged({
          target: snap.target,
          restSec: Math.max(1, Math.round(snap.totalSec)),
          skipped: false,
        })
        void endRestLiveActivity(true)
      }
      return () => {
        cancelled = true
        clearTickRef.current()
      }
    }

    scopeRef.current = nextScope
    targetRef.current = snap.target
    totalRef.current = snap.totalSec
    remainingRef.current = remaining
    endsAtRef.current = snap.paused ? Date.now() + remaining * 1000 : snap.endsAt
    pausedRef.current = snap.paused
    finishedRef.current = false
    setState({
      active: true,
      totalSec: snap.totalSec,
      remainingSec: remaining,
      target: snap.target,
      finished: false,
      paused: snap.paused,
    })
    void startRestLiveActivity({
      remainingSec: remaining,
      totalSec: snap.totalSec,
      subtitle: `${snap.target.exerciseName} · ${snap.target.setLabel}`,
    })
    if (!snap.paused) armTickRef.current()

    return () => {
      cancelled = true
      clearTickRef.current()
    }
  }, [hydrateEpoch])

  useEffect(() => {
    return () => {
      clearTick()
      void endRestLiveActivity(true)
    }
  }, [clearTick])

  const isSessionVisible = state.active || state.finished
  const idle = !state.active && !state.finished
  const isBarVisible =
    !chromeHidden && (isSessionVisible || (readyBarEnabled && idle))

  const setChromeHidden = useCallback((hidden: boolean) => {
    setChromeHiddenState(hidden)
  }, [])

  const value = useMemo<RestTimerContextValue>(
    () => ({
      state,
      readyBarEnabled,
      setReadyBarEnabled,
      isSessionVisible,
      isBarVisible,
      chromeHidden,
      setChromeHidden,
      start,
      pause,
      resume,
      skip,
      dismiss,
      presets: REST_PRESETS_SEC,
    }),
    [
      state,
      readyBarEnabled,
      isSessionVisible,
      isBarVisible,
      chromeHidden,
      setChromeHidden,
      start,
      pause,
      resume,
      skip,
      dismiss,
    ],
  )

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>
}

export function useRestTimerContext(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext)
  if (!ctx) {
    throw new Error('useRestTimerContext must be used within RestTimerProvider')
  }
  return ctx
}

/** Écoute les repos terminés / passés (ex. carnet Train). */
export function subscribeRestLogged(listener: (payload: RestLoggedPayload) => void): () => void {
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent<RestLoggedPayload>).detail
    if (detail) listener(detail)
  }
  window.addEventListener('ranked-gym:rest-logged', handler)
  return () => window.removeEventListener('ranked-gym:rest-logged', handler)
}
