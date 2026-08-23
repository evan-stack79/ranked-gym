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
   * Masque Tab Bar + timer (Pump Check / modales plein écran).
   * Quand true : dismiss le timer zombie et coupe la ready bar.
   */
  chromeHidden: boolean
  setChromeHidden: (hidden: boolean) => void
  start: (seconds: number, target: RestTimerTarget) => void
  skip: () => void
  dismiss: () => void
  presets: typeof REST_PRESETS_SEC
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null)

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(IDLE)
  const [readyBarEnabled, setReadyBarEnabled] = useState(false)
  const [chromeHidden, setChromeHiddenState] = useState(false)

  const targetRef = useRef<RestTimerTarget | null>(null)
  const totalRef = useRef(90)
  const remainingRef = useRef(90)
  const tickRef = useRef<number | null>(null)
  const finishedRef = useRef(false)

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
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
    remainingRef.current = 0
    setState((s) => ({ ...s, remainingSec: 0, active: false, finished: true }))
    logRest(false)
    void endRestLiveActivity(true)
    vibrate([40, 60, 40, 60, 80])
    playRestCompleteChime()
  }, [clearTick, logRest])

  const start = useCallback(
    (seconds: number, target: RestTimerTarget) => {
      clearTick()
      finishedRef.current = false
      const total = Math.max(1, Math.round(seconds))
      targetRef.current = target
      totalRef.current = total
      remainingRef.current = total
      setState({
        active: true,
        totalSec: total,
        remainingSec: total,
        target,
        finished: false,
      })
      void startRestLiveActivity({
        remainingSec: total,
        totalSec: total,
        subtitle: `${target.exerciseName} · ${target.setLabel}`,
      })
      vibrate(10)

      tickRef.current = window.setInterval(() => {
        remainingRef.current -= 1
        const next = remainingRef.current
        if (next <= 0) {
          complete()
          return
        }
        setState((s) => ({ ...s, remainingSec: next, active: true, finished: false }))
        void updateRestLiveActivity({
          remainingSec: next,
          subtitle: `${target.exerciseName} · ${target.setLabel}`,
        })
        if (next === 10 || next === 5 || next === 3 || next === 1) vibrate(10)
      }, 1000)
    },
    [clearTick, complete],
  )

  const skip = useCallback(() => {
    if (!targetRef.current) {
      clearTick()
      setState(IDLE)
      void endRestLiveActivity(true)
      return
    }
    clearTick()
    logRest(true)
    finishedRef.current = false
    targetRef.current = null
    setState(IDLE)
    void endRestLiveActivity(true)
    vibrate(16)
  }, [clearTick, logRest])

  const dismiss = useCallback(() => {
    clearTick()
    finishedRef.current = false
    targetRef.current = null
    setState(IDLE)
    void endRestLiveActivity(true)
  }, [clearTick])

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

  const setChromeHidden = useCallback(
    (hidden: boolean) => {
      setChromeHiddenState(hidden)
      if (hidden) {
        // Timer zombie : stop immédiat. La barre reste masquée via !chromeHidden
        // (on ne touche pas readyBarEnabled pour qu’elle réapparaisse au retour Train).
        dismiss()
      }
    },
    [dismiss],
  )

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
