/**
 * Programme Débutant ouvert — liste d’exercices, gainage (timer in-card), « Machine prise ».
 * Stable sticky programme header (Débutant + Fermer) — no BrandMark swap / layout jump.
 */
import {
  BEGINNER_EXERCISES,
  BEGINNER_PROGRAMME_TITLE,
  GAINAGE_HOLD_TEXT,
  MACHINE_BUSY_LABEL,
} from '../../data/beginnerProgramme'
import { buildBeginnerExerciseEntry } from '../../services/beginnerProgramme'
import { GainageHoldPanel } from './GainageHoldPanel'

export function TrainBeginnerSessionView({
  machineBusyIds = ['leg_press'],
  onClose,
}: {
  /** Catalog ids marked « Machine prise » → show swap exercise. */
  machineBusyIds?: string[]
  onClose?: () => void
}) {
  const busy = new Set(machineBusyIds)
  const rows = BEGINNER_EXERCISES.map((slot) => {
    const entry = buildBeginnerExerciseEntry(slot, { machineBusy: busy.has(slot.catalogId) })
    return { slot, entry, busy: busy.has(slot.catalogId) }
  }).filter((r) => r.entry != null)

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="train-beginner-session"
      data-programme-open="1"
    >
      <header
        className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0C0C0E]/95 px-5 py-3 backdrop-blur-md"
        data-testid="train-beginner-session-header"
      >
        <h2 className="text-[20px] font-bold text-white">{BEGINNER_PROGRAMME_TITLE}</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ios-press text-[14px] font-semibold text-[#AEAEB2]"
            data-testid="train-beginner-session-close"
          >
            Fermer
          </button>
        ) : (
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E8E93]">
            Programme
          </span>
        )}
      </header>

      <ol
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-5 py-4"
        data-testid="train-beginner-exercise-list"
      >
        {rows.map(({ slot, entry, busy: isBusy }, index) => {
          if (!entry) return null
          const isGainage = slot.kind === 'gainage'
          return (
            <li
              key={entry.canonicalExerciseId ?? entry.id}
              className="rounded-2xl border border-white/10 bg-[#141416] px-3.5 py-3"
              data-testid={`train-beginner-ex-${entry.canonicalExerciseId ?? index}`}
              data-machine-busy={isBusy || undefined}
              data-swapped={isBusy || undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold tabular-nums text-[#8E8E93]">
                    {index + 1}
                  </p>
                  <p className="text-[15px] font-semibold text-white">
                    {isBusy ? slot.name : entry.name}
                  </p>
                </div>
                {isBusy ? (
                  <span
                    className="shrink-0 rounded-lg border border-brand/40 bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-[#FF8A8A]"
                    data-testid="train-machine-busy-badge"
                  >
                    {MACHINE_BUSY_LABEL}
                  </span>
                ) : null}
              </div>
              {isBusy && slot.machineBusySwapName ? (
                <p className="mt-1 text-[12px] text-[#AEAEB2]" data-testid="train-machine-busy-swap">
                  Remplacement : {slot.machineBusySwapName}
                </p>
              ) : null}
              {isGainage ? (
                <>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#E5E5EA]">{GAINAGE_HOLD_TEXT}</p>
                  <GainageHoldPanel embedded />
                </>
              ) : (
                <p className="mt-1 text-[12px] text-[#8E8E93]">
                  1 série · 8 à 12 répétitions · repos{' '}
                  {slot.size === 'big' ? '2 à 3' : '1 à 2'} min
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
