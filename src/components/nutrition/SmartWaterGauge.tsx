import { useCallback, useEffect, useRef, useState } from 'react'
import { Droplets } from 'lucide-react'
import {
  addTodayWaterMl,
  getTodayWaterMl,
  suggestedWaterGoalMl,
} from '../../services/nutritionStorage'

const SIP_STEP_ML = 10
const HAPTIC_EVERY_ML = 50
const MAX_SIP_ML = 1000
const MIN_SIP_ML = 0

interface SmartWaterGaugeProps {
  weightKg: number
}

function clampSip(ml: number): number {
  const stepped = Math.round(ml / SIP_STEP_ML) * SIP_STEP_ML
  return Math.min(MAX_SIP_ML, Math.max(MIN_SIP_ML, stepped))
}

function hapticTick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  } catch {
    // unsupported / blocked
  }
}

export function SmartWaterGauge({ weightKg }: SmartWaterGaugeProps) {
  const goalMl = suggestedWaterGoalMl(weightKg)
  const trackRef = useRef<HTMLDivElement>(null)
  const hapticBucketRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  const [totalMl, setTotalMl] = useState(() => getTodayWaterMl())
  const [pendingMl, setPendingMl] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [wavePulse, setWavePulse] = useState(false)

  useEffect(() => {
    const sync = () => setTotalMl(getTodayWaterMl())
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => window.removeEventListener('ranked-gym:backup-restored', sync)
  }, [])

  const fillPct = Math.min(100, (totalMl / goalMl) * 100)
  const pendingPct = (pendingMl / MAX_SIP_ML) * 100

  const mlFromClientY = useCallback((clientY: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
    return clampSip(ratio * MAX_SIP_ML)
  }, [])

  const applyPending = useCallback((ml: number) => {
    const next = clampSip(ml)
    const bucket = Math.floor(next / HAPTIC_EVERY_ML)
    if (bucket !== hapticBucketRef.current && next > 0) {
      hapticBucketRef.current = bucket
      hapticTick()
    }
    if (next === 0) hapticBucketRef.current = 0
    setPendingMl(next)
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    setAwaitingConfirm(false)
    hapticBucketRef.current = 0
    applyPending(mlFromClientY(event.clientY))
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    applyPending(mlFromClientY(event.clientY))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    setDragging(false)
    setPendingMl((current) => {
      if (current > 0) setAwaitingConfirm(true)
      else setAwaitingConfirm(false)
      return current
    })
  }

  const cancelPending = () => {
    setPendingMl(0)
    setAwaitingConfirm(false)
    hapticBucketRef.current = 0
  }

  const confirmSip = () => {
    if (pendingMl <= 0) return
    const nextJournal = addTodayWaterMl(pendingMl)
    setTotalMl(nextJournal.waterMl ?? 0)
    setPendingMl(0)
    setAwaitingConfirm(false)
    hapticBucketRef.current = 0
    setWavePulse(true)
    window.setTimeout(() => setWavePulse(false), 900)
    hapticTick()
  }

  const litersLabel = (ml: number) =>
    ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L` : `${ml} ml`

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
      style={{
        background:
          'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(0 180 255 / 0.22) 0%, transparent 55%), rgb(28 28 30 / 0.92)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-[#64D2FF]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Hydratation
            </p>
            <h2 className="text-[18px] font-bold tracking-tight text-white">Drag-to-Fill</h2>
          </div>
        </div>
        <p className="text-[13px] font-semibold text-[#64D2FF]">
          {litersLabel(totalMl)}
          <span className="text-[#8E8E93]"> / {litersLabel(goalMl)}</span>
        </p>
      </div>

      <p className="mb-3 text-[13px] text-[#8E8E93]">
        Glisse verticalement sur la jauge — pas de clavier. Pas de 10&nbsp;ml.
      </p>

      <div className="flex items-stretch gap-4">
        <div
          ref={trackRef}
          className="water-gauge relative h-[240px] w-[112px] shrink-0 touch-none select-none overflow-hidden rounded-[28px] border border-[#00B4FF]/35 bg-black/40"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={MAX_SIP_ML}
          aria-valuenow={pendingMl}
          aria-label="Volume d’eau à ajouter"
          tabIndex={0}
        >
          {/* Daily fill with wave */}
          <div
            className={`water-wave absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out ${
              wavePulse ? 'water-wave--pulse' : ''
            }`}
            style={{ height: `${fillPct}%` }}
          />

          {/* Pending sip preview */}
          {(dragging || awaitingConfirm) && pendingMl > 0 && (
            <div
              className="absolute inset-x-0 bottom-0 bg-[#64D2FF]/35 transition-[height] duration-75"
              style={{ height: `${Math.max(pendingPct, (10 / MAX_SIP_ML) * 100)}%` }}
            />
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            {dragging || (awaitingConfirm && pendingMl > 0) ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8EBEFF]">
                  À ajouter
                </p>
                <p className="mt-1 text-[28px] font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
                  +{pendingMl}
                </p>
                <p className="text-[13px] font-semibold text-[#64D2FF]">ml</p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  Aujourd’hui
                </p>
                <p className="mt-1 text-[26px] font-black tracking-tight text-white">
                  {Math.round(fillPct)}%
                </p>
                <p className="text-[12px] text-[#8E8E93]">glisse ↑↓</p>
              </>
            )}
          </div>

          {/* Tick marks every 250ml */}
          <div className="pointer-events-none absolute inset-y-3 right-2 flex flex-col justify-between">
            {[1000, 750, 500, 250, 0].map((mark) => (
              <span key={mark} className="text-[9px] font-medium text-white/35">
                {mark}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
          <div className="space-y-2">
            <p className="text-[14px] leading-snug text-[#AEAEB2]">
              Objectif du jour basé sur ton poids (~35&nbsp;ml/kg) :{' '}
              <span className="font-semibold text-white">{goalMl} ml</span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00B4FF] to-[#64D2FF] transition-all duration-700"
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <p className="text-[12px] text-[#8E8E93]">
              Vibration à chaque +50&nbsp;ml pendant le glissement.
            </p>
          </div>

          <div className="space-y-2">
            {awaitingConfirm && pendingMl > 0 ? (
              <>
                <button
                  type="button"
                  onClick={confirmSip}
                  className="water-validate-btn ios-press btn-brand w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
                >
                  Valider +{pendingMl} ml
                </button>
                <button
                  type="button"
                  onClick={cancelPending}
                  className="ios-press w-full rounded-2xl border border-white/10 bg-black/25 py-2.5 text-[13px] font-medium text-[#8E8E93]"
                >
                  Annuler
                </button>
              </>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-[12px] leading-relaxed text-[#8E8E93]">
                Touche la jauge et glisse vers le haut pour plus d’eau. Relâche, puis valide.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
