import { useCallback, useEffect, useRef, useState } from 'react'
import { playRestCompleteChime } from '../utils/restTimerSound'
import { vibrate } from '../utils/haptics'

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

const IDLE: RestTimerState = {
  active: false,
  totalSec: 90,
  remainingSec: 90,
  target: null,
  finished: false,
}

type Options = {
  onRestLogged?: (info: {
    target: RestTimerTarget
    restSec: number
    skipped: boolean
  }) => void
}

export function useRestTimer(options: Options = {}) {
  const [state, setState] = useState<RestTimerState>(IDLE)
  const onRestLoggedRef = useRef(options.onRestLogged)
  onRestLoggedRef.current = options.onRestLogged
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

  const logRest = useCallback((skipped: boolean) => {
    const target = targetRef.current
    if (!target) return
    const elapsed = Math.max(0, totalRef.current - remainingRef.current)
    const restSec = skipped ? elapsed : totalRef.current
    onRestLoggedRef.current?.({
      target,
      restSec: Math.max(1, Math.round(restSec)),
      skipped,
    })
  }, [])

  const complete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTick()
    remainingRef.current = 0
    setState((s) => ({ ...s, remainingSec: 0, active: false, finished: true }))
    logRest(false)
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
      vibrate(10)

      tickRef.current = window.setInterval(() => {
        remainingRef.current -= 1
        const next = remainingRef.current
        if (next <= 0) {
          complete()
          return
        }
        setState((s) => ({ ...s, remainingSec: next, active: true, finished: false }))
        if (next === 10 || next === 5 || next === 3 || next === 1) vibrate(10)
      }, 1000)
    },
    [clearTick, complete],
  )

  const skip = useCallback(() => {
    if (!targetRef.current) {
      clearTick()
      setState(IDLE)
      return
    }
    clearTick()
    logRest(true)
    finishedRef.current = false
    targetRef.current = null
    setState(IDLE)
    vibrate(16)
  }, [clearTick, logRest])

  const dismiss = useCallback(() => {
    clearTick()
    finishedRef.current = false
    targetRef.current = null
    setState(IDLE)
  }, [clearTick])

  useEffect(() => () => clearTick(), [clearTick])

  return { state, start, skip, dismiss, presets: REST_PRESETS_SEC }
}
