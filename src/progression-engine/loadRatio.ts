import {
  ATL_DAYS,
  CTL_DAYS,
  LOAD_RATIO_HIGH,
  LOAD_RATIO_LOW,
  LOAD_RATIO_MIN_ACTIVE_DAYS,
} from './constants.ts'
import type { LoadStatus } from './types.ts'

/** EWMA, le plus ancien en premier. λ = 2 / (fenêtre + 1). */
export function ewma(valuesOldestFirst: number[], window: number): number | null {
  const values = valuesOldestFirst.filter((value) => Number.isFinite(value))
  if (values.length === 0 || window <= 0) return null
  const alpha = 2 / (window + 1)
  let acc = values[0]
  for (let i = 1; i < values.length; i += 1) {
    acc = alpha * values[i] + (1 - alpha) * acc
  }
  return acc
}

export function trainingLoadRatio(dailyStrainOldestFirst: number[]): {
  ratio: number
  status: LoadStatus
  atl: number
  ctl: number
} | null {
  const active = dailyStrainOldestFirst.filter((value) => Number.isFinite(value) && value > 0)
  if (active.length < LOAD_RATIO_MIN_ACTIVE_DAYS) return null
  const atl = ewma(dailyStrainOldestFirst, ATL_DAYS)
  const ctl = ewma(dailyStrainOldestFirst, CTL_DAYS)
  if (atl == null || ctl == null || ctl <= 0) return null
  const ratio = atl / ctl
  const status: LoadStatus =
    ratio < LOAD_RATIO_LOW ? 'detraining' : ratio > LOAD_RATIO_HIGH ? 'excess' : 'productive'
  return { ratio, status, atl, ctl }
}
