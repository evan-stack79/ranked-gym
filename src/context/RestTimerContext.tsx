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
import {
  cancelRestTimerSound,
  maybePlayCountdownBeep,
  onRestTimerSoundComplete,
  rescheduleRestTimerSound,
  scheduleRestTimerSound,
} from '../utils/restTimerSound'
import { vibrate } from '../utils/haptics'
import { CANONICAL_REST_SEC, clampRestSec } from '../utils/restDuration'
import {
  endRestLiveActivity,
  startRestLiveActivity,
  updateRestLiveActivity,
} from '../services/restTimerLiveActivity'
import { subscribeLiveActivityActions } from '../services/liveActivity'
import {
  getTrainingState,
  getTrainingStorageScope,
  persistActiveRestTimer,
} from '../services/trainingStorage'
import {
  remainingFromPersisted,
  type PersistedRestTimer,
} from '../utils/restTimerPersist'

export const REST_PRESETS_SEC = [45, CANONICAL_REST_SEC, 180] as const
export type RestPresetSec = (typeof REST_PRESETS_SEC)[number]

export type RestTimerTarget = {
  exerciseId: string
  setIndex: number
  exerciseName: string
  setLabel: string
  /** Nombre de séries de l’exercice (pour « Série X sur Y ensuite »). */
  setTotal?: number
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
  totalSec: CANONICAL_REST_SEC,
  remainingSec: CANONICAL_REST_SEC,
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
  addSeconds: (delta: number) => void
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
  const totalRef = useRef(CANONICAL_REST_SEC)
  const endsAtRef = useRef(0)
  const remainingRef = useRef(CANONICAL_REST_SEC)
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
    totalRef.current = CANONICAL_REST_SEC
    endsAtRef.current = 0
    remainingRef.current = CANONICAL_REST_SEC
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

  const goIdle = useCallback(() => {
    clearTick()
    finishedRef.current = false
    pausedRef.current = false
    targetRef.current = null
    remainingRef.current = CANONICAL_REST_SEC
    totalRef.current = CANONICAL_REST_SEC
    endsAtRef.current = 0
    setState(IDLE)
    persistSnap(null)
  }, [clearTick, persistSnap])

  /**
   * Fin naturelle à 0:00 — log skipped:false + son/vibration, puis IDLE
   * (ferme overlay récup sans passer par skip / addNextSet).
   */
  const complete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTick()
    pausedRef.current = false
    remainingRef.current = 0
    persistSnap(null)
    logRest(false)
    void endRestLiveActivity(true)
    // Son + haptic (mute → vibration seule) — une seule fois, pas de boucle.
    void onRestTimerSoundComplete()
    // Auto-fermeture : pas d’état « finished » bloquant ni second log via skip.
    goIdle()
  }, [clearTick, goIdle, logRest, persistSnap])

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
    // Live Activity is endDate-driven (widget Text(timerInterval:)) — never push
    // remainingSec each tick; background freezes JS and would freeze the island.
    if (target) {
      if (next === 10 || next === 5 || next === 3 || next === 1) vibrate(10)
      void maybePlayCountdownBeep(next)
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
      const startAt = endsAt - total * 1000
      // setIndex target is 0-based just-finished → « Série X ensuite » = +2 (1-based next)
      const nextSet = target.setIndex + 2
      const setTotal =
        target.setTotal != null && target.setTotal > 0
          ? Math.round(target.setTotal)
          : undefined
      void startRestLiveActivity({
        remainingSec: total,
        totalSec: total,
        startDateMs: startAt,
        endDateMs: endsAt,
        setIndex: nextSet,
        setTotal,
        exerciseName: target.exerciseName,
        subtitle: `${target.exerciseName} · ${target.setLabel}`,
      })
      void scheduleRestTimerSound(endsAt)
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
    void cancelRestTimerSound()
    void updateRestLiveActivity({
      remainingSec: remaining,
      startDateMs: 0,
      endDateMs: 0,
      subtitle: `${targetRef.current.exerciseName} · ${targetRef.current.setLabel}`,
      paused: true,
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
    const startAt = Date.now()
    endsAtRef.current = startAt + remaining * 1000
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
    void rescheduleRestTimerSound(endsAtRef.current)
    void updateRestLiveActivity({
      remainingSec: remaining,
      startDateMs: startAt,
      endDateMs: endsAtRef.current,
      subtitle: `${targetRef.current.exerciseName} · ${targetRef.current.setLabel}`,
      paused: false,
    })
    armTick()
  }, [armTick, complete, persistSnap])

  const skip = useCallback(() => {
    // Déjà terminé (course avec auto-fermeture) : fermer sans 2ᵉ rest-logged / append.
    if (finishedRef.current) {
      void cancelRestTimerSound()
      void endRestLiveActivity(true)
      goIdle()
      return
    }
    if (!targetRef.current) {
      void cancelRestTimerSound()
      void endRestLiveActivity(true)
      goIdle()
      return
    }
    clearTick()
    logRest(true)
    void cancelRestTimerSound()
    void endRestLiveActivity(true)
    vibrate(16)
    goIdle()
  }, [clearTick, goIdle, logRest])

  const dismiss = useCallback(() => {
    void cancelRestTimerSound()
    void endRestLiveActivity(true)
    goIdle()
  }, [goIdle])

  const addSeconds = useCallback(
    (delta: number) => {
      if (!targetRef.current || finishedRef.current) return
      const current = pausedRef.current
        ? remainingRef.current
        : Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
      const nextRemaining = clampRestSec(current + delta)
      remainingRef.current = nextRemaining
      totalRef.current = Math.max(totalRef.current, nextRemaining)
      if (!pausedRef.current) {
        endsAtRef.current = Date.now() + nextRemaining * 1000
        if (tickIdRef.current == null) armTick()
        void rescheduleRestTimerSound(endsAtRef.current)
      }
      setState((s) => ({
        ...s,
        remainingSec: nextRemaining,
        totalSec: totalRef.current,
        active: true,
        paused: pausedRef.current,
        finished: false,
      }))
      persistSnap({
        totalSec: totalRef.current,
        remainingSec: nextRemaining,
        endsAt: pausedRef.current ? Date.now() + nextRemaining * 1000 : endsAtRef.current,
        paused: pausedRef.current,
        target: targetRef.current,
      })
      // One-shot LA update with new start/endDate (or fixed remaining while paused).
      const startAt = pausedRef.current
        ? 0
        : endsAtRef.current - nextRemaining * 1000
      void updateRestLiveActivity({
        remainingSec: nextRemaining,
        totalSec: totalRef.current,
        startDateMs: startAt,
        endDateMs: pausedRef.current ? 0 : endsAtRef.current,
        paused: pausedRef.current,
        subtitle: `${targetRef.current.exerciseName} · ${targetRef.current.setLabel}`,
      })
    },
    [armTick, persistSnap],
  )

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
        // Expiration hydratée : une seule fois — journalisation unique (skipped:false),
        // sans son, puis IDLE (ferme overlay, pas d’état finished bloquant).
        persistEnabledRef.current = true
        scopeRef.current = nextScope
        clearTickRef.current()
        targetRef.current = snap.target
        totalRef.current = snap.totalSec
        remainingRef.current = 0
        pausedRef.current = false
        finishedRef.current = false
        writePersistedRest(null)
        lastPersistKeyRef.current = 'null'
        emitRestLogged({
          target: snap.target,
          restSec: Math.max(1, Math.round(snap.totalSec)),
          skipped: false,
        })
        void cancelRestTimerSound()
        void endRestLiveActivity(true)
        targetRef.current = null
        setState(IDLE)
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
      startDateMs: snap.paused ? 0 : endsAtRef.current - remaining * 1000,
      endDateMs: snap.paused ? 0 : endsAtRef.current,
      paused: snap.paused,
      setIndex: snap.target.setIndex + 2,
      setTotal:
        snap.target.setTotal != null && snap.target.setTotal > 0
          ? Math.round(snap.target.setTotal)
          : undefined,
      exerciseName: snap.target.exerciseName,
      subtitle: `${snap.target.exerciseName} · ${snap.target.setLabel}`,
    })
    if (!snap.paused) {
      void scheduleRestTimerSound(endsAtRef.current)
      armTickRef.current()
    } else {
      void cancelRestTimerSound()
    }

    return () => {
      cancelled = true
      clearTickRef.current()
    }
  }, [hydrateEpoch])

  // Widget App Intents → pause / stop / +15 s / validate (DI-12)
  useEffect(() => {
    let remove: (() => void) | undefined
    void subscribeLiveActivityActions((action) => {
      if (action === 'pause') {
        if (pausedRef.current) resume()
        else pause()
      } else if (action === 'stop') {
        skip()
      } else if (action === 'add15') {
        addSeconds(15)
      } else if (action === 'validate') {
        window.dispatchEvent(new CustomEvent('ranked-gym:live-validate'))
      }
    }).then((h) => {
      remove = () => h.remove()
    })
    return () => remove?.()
  }, [pause, resume, skip, addSeconds])

  useEffect(() => {
    return () => {
      clearTick()
      void cancelRestTimerSound()
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
      addSeconds,
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
      addSeconds,
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
