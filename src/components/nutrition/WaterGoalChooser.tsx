import { useState, type FormEvent } from 'react'
import {
  parseWaterGoalInput,
  setUserWaterGoalMl,
  WATER_GOAL_CHOICE_ADVICE,
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
} from '../../utils/userWaterGoal'

interface WaterGoalChooserProps {
  /** Called after a valid goal is saved. */
  onSaved?: (goalMl: number) => void
  /** Start with the input open (screenshot / deep-link). */
  defaultOpen?: boolean
  className?: string
}

/**
 * « Choisir mon objectif » — no weight-based suggestion or prefill.
 */
export function WaterGoalChooser({
  onSaved,
  defaultOpen = false,
  className = '',
}: WaterGoalChooserProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const ml = parseWaterGoalInput(raw)
    if (ml == null || !setUserWaterGoalMl(ml)) {
      setError(`Entre un objectif entre ${WATER_GOAL_MIN_ML} et ${WATER_GOAL_MAX_ML} ml`)
      return
    }
    setError(null)
    setOpen(false)
    setRaw('')
    onSaved?.(ml)
  }

  return (
    <div className={className}>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setError(null)
          }}
          className="ios-press min-h-11 rounded-2xl border border-cyan-500/25 bg-cyan-500/8 px-3.5 py-2.5 text-[13px] font-semibold text-[#7DD3FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35"
        >
          Choisir mon objectif
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-[12px] font-medium text-[#AEAEB2]" htmlFor="water-goal-input">
            Objectif (ml ou L)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="water-goal-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value)
                setError(null)
              }}
              placeholder="ex. 2000 ou 2 L"
              className="min-h-11 flex-1 rounded-xl border border-white/12 bg-black/35 px-3 text-[15px] text-white placeholder:text-[#636366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
            <button
              type="submit"
              className="ios-press min-h-11 shrink-0 rounded-xl bg-[#FF2B2B] px-3.5 py-2.5 text-[13px] font-semibold text-white"
            >
              OK
            </button>
          </div>
          {error ? (
            <p className="text-[12px] font-medium text-[#FF6961]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setRaw('')
              setError(null)
            }}
            className="text-[12px] font-medium text-[#8E8E93] underline-offset-2 hover:underline"
          >
            Annuler
          </button>
        </form>
      )}
      <p className="mt-2 text-[12px] leading-snug text-[#8E8E93]">{WATER_GOAL_CHOICE_ADVICE}</p>
    </div>
  )
}
