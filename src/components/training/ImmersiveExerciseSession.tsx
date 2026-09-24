import { useMemo, useState } from 'react'
import { Check, ChevronLeft, Minus, Pause, Play, Plus, Timer } from 'lucide-react'
import type { ExerciseEntry, WorkoutSet } from '../../types/training'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { BRAND_MARK_COMPACT_SRC } from '../brand/BrandMark'
import {
  formatExerciseMuscles,
  resolveExerciseMedia,
} from '../../utils/exerciseMedia'
import { useRestTimerContext } from '../../context/RestTimerContext'
import { isSetReadyForAutoValidate } from '../../utils/autoValidateSet'
import { CANONICAL_REST_SEC, resolveRestDuration } from '../../utils/restDuration'
import { RecoveryTimerPanel } from './RecoveryTimerPanel'

export interface ImmersiveExerciseSessionProps {
  exercises: ExerciseEntry[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  sessionClockLabel: string
  sessionPaused: boolean
  onToggleSessionPause?: () => void
  onBack: () => void
  onUpdateSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSet>) => void
  onAddSet: (exerciseId: string) => void
  /** Ouvre le sélecteur pour ajouter un exercice à la suite. */
  onAddExercise?: () => void
  onValidateSet: (exercise: ExerciseEntry, setIndex: number, restSec: number) => void
  onFinishSession: () => void
  saving?: boolean
  /** Preferred rest length when idle (seconds). */
  restPrefSec?: number
  onRestPrefChange?: (sec: number) => void
  autoValidate?: boolean
  undoVisible?: boolean
  onUndoValidation?: () => void
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function formatEffort(set: WorkoutSet): string | null {
  if (set.rpe == null) return null
  return `${set.rpe}/10`
}

const FIELD =
  'min-h-11 w-full rounded-lg border border-white/12 bg-[#1c1c1e] px-2 text-center text-[15px] font-semibold tabular-nums text-white outline-none focus-visible:border-[#FF2B2B]/55'

/**
 * Immersive single-exercise session canvas (bench-press reference layout).
 * Interactive controls stay in normal document flow; only the hero chrome overlays the photo.
 */
export function ImmersiveExerciseSession({
  exercises,
  activeIndex,
  onActiveIndexChange,
  sessionClockLabel,
  sessionPaused,
  onToggleSessionPause,
  onBack,
  onUpdateSet,
  onAddSet,
  onAddExercise,
  onValidateSet,
  onFinishSession,
  saving = false,
  restPrefSec = CANONICAL_REST_SEC,
  onRestPrefChange,
  autoValidate = false,
  undoVisible = false,
  onUndoValidation,
}: ImmersiveExerciseSessionProps) {
  const rest = useRestTimerContext()
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, exercises.length - 1))
  const exercise = exercises[safeIndex]
  const media = useMemo(
    () =>
      resolveExerciseMedia({
        name: exercise?.name ?? '',
        canonicalExerciseId: exercise?.canonicalExerciseId,
      }),
    [exercise?.name, exercise?.canonicalExerciseId],
  )
  const muscleLine = formatExerciseMuscles(media.muscles)
  const [imgFailedFor, setImgFailedFor] = useState<string | null>(null)
  const showImage = Boolean(media.imageSrc) && imgFailedFor !== media.imageSrc

  if (!exercise) return null

  const pendingIdx = exercise.sets.findIndex((s) => !s.done)
  const validateIdx = pendingIdx >= 0 ? pendingIdx : Math.max(0, exercise.sets.length - 1)
  const progressLabel = `${safeIndex + 1}/${exercises.length}`
  const progressRatio =
    exercises.length > 0 ? Math.min(1, (safeIndex + 1) / exercises.length) : 0

  const restActive = rest.state.active || rest.state.finished
  const restSecResolved = resolveRestDuration({
    exerciseRestSec: exercise.targetRestSec,
    preferredRestSec: restPrefSec,
  })
  const restDisplaySec = rest.state.finished
    ? 0
    : rest.state.active
      ? rest.state.remainingSec
      : restSecResolved
  const showRecovery = autoValidate && restActive

  const patchSet = (idx: number, patch: Partial<WorkoutSet>) => {
    const current = exercise.sets[idx]
    if (!current) return
    onUpdateSet(exercise.id, idx, patch)
    if (!autoValidate) return
    const merged = { ...current, ...patch }
    if (isSetReadyForAutoValidate(merged)) {
      onValidateSet(exercise, idx, restSecResolved)
    }
  }

  const nudgeRest = (delta: number) => {
    if (rest.state.active && rest.state.target && !rest.state.finished) {
      const next = Math.max(15, Math.min(600, rest.state.remainingSec + delta))
      rest.start(next, rest.state.target)
      return
    }
    const next = Math.max(15, Math.min(600, restPrefSec + delta))
    onRestPrefChange?.(next)
  }

  const ringSize = 44
  const stroke = 3
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progressRatio)
  const displayName = exercise.name.trim() || 'Exercice'

  return (
    <section
      className="relative flex min-h-[100dvh] flex-col bg-black text-white"
      data-immersive-session
      data-exercise-slug={media.slug}
      data-canonical-exercise={media.canonicalExerciseId ?? ''}
      data-hero-image={showImage ? 'ready' : 'fallback'}
      data-recovery-active={showRecovery ? 'true' : 'false'}
    >
      <div
        className={`flex min-h-[100dvh] flex-col ${
          showRecovery ? 'pointer-events-none select-none' : ''
        }`}
        aria-hidden={showRecovery ? true : undefined}
        data-immersive-session-body
      >
      {/* Hero — chrome overlays photo; interactive body stays in flow below */}
      <div className="relative isolate shrink-0 overflow-hidden">
        <div className="relative h-[min(32vh,268px)] w-full overflow-hidden">
          {showImage ? (
            <img
              src={media.imageSrc!}
              alt={media.imageAlt || `Illustration — ${displayName}`}
              draggable={false}
              decoding="async"
              data-hero-photo
              className="pointer-events-none h-full w-full select-none object-cover object-[center_28%] contrast-[1.15] saturate-[0.5]"
              onError={() => setImgFailedFor(media.imageSrc)}
            />
          ) : (
            /* Discreet charcoal fallback — readable as intentional empty media, not a black void */
            <div
              className="relative h-full w-full overflow-hidden"
              data-hero-fallback
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-[#1c1c1e]" />
              <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_35%,#3a3a3c_0%,transparent_70%)] opacity-70" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#252528_0%,#141416_45%,#0c0c0d_100%)] opacity-90" />
            </div>
          )}
          {/* Bottom blend into UI only — keep athlete / bar readable */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black/55 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Top chrome over hero */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-3"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={onBack}
            className="pointer-events-auto ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/45 text-white"
            aria-label="Retour à Train"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <div className="pointer-events-none flex items-center gap-1.5">
            <img
              src={BRAND_MARK_COMPACT_SRC}
              width={22}
              height={22}
              alt=""
              aria-hidden="true"
              className="h-[22px] w-[22px] object-contain"
              draggable={false}
            />
            <p
              className="text-[15px] font-semibold tabular-nums tracking-tight text-white"
              aria-live="polite"
              data-session-clock
            >
              {sessionClockLabel}
            </p>
          </div>

          {onToggleSessionPause ? (
            <button
              type="button"
              onClick={onToggleSessionPause}
              className="pointer-events-auto ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/45 text-[#FF2B2B]"
              aria-label={sessionPaused ? 'Reprendre la séance' : 'Mettre la séance en pause'}
            >
              {sessionPaused ? (
                <Play className="h-4 w-4" strokeWidth={2.5} fill="currentColor" />
              ) : (
                <Pause className="h-4 w-4" strokeWidth={2.5} fill="currentColor" />
              )}
            </button>
          ) : (
            <span className="min-h-11 min-w-11" />
          )}
        </div>
      </div>

      {/* Interactive body — flow layout */}
      <div
        className="relative z-10 flex flex-1 flex-col px-4 pt-0.5"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <header className="mb-3">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-white">
            {displayName}
          </h1>
          {muscleLine ? (
            <p className="mt-0.5 text-[13px] font-medium text-[#8E8E93]">{muscleLine}</p>
          ) : null}
          <p className="mt-0.5 text-[12px] text-[#636366]">
            Exercice {safeIndex + 1} sur {exercises.length}
          </p>
        </header>

        {/* Sets grid — Effort 1–10 (réf. 787e6ed), facultatif, jamais Facile/OK/Dur */}
        <div className="mb-1 grid grid-cols-[2.25rem_1fr_1fr_1fr_2.5rem] items-center gap-x-2 px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
            Série
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
            kg
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
            Reps
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
            Effort
          </span>
          <span className="sr-only">Validation</span>
        </div>

        <div className="space-y-1.5" role="list" aria-label="Séries">
          {exercise.sets.map((set, idx) => {
            const done = Boolean(set.done)
            const active = !done && idx === pendingIdx
            const upcoming = !done && idx !== pendingIdx
            const effortDone = formatEffort(set)

            return (
              <div
                key={idx}
                role="listitem"
                data-set-row={done ? 'done' : active ? 'active' : 'upcoming'}
                className={`relative grid grid-cols-[2.25rem_1fr_1fr_1fr_2.5rem] items-center gap-x-2 ${
                  upcoming ? 'opacity-45' : ''
                }`}
              >
                {active ? (
                  <span
                    className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#FF2B2B]"
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`text-center text-[13px] font-bold tabular-nums ${
                    done ? 'text-white' : active ? 'text-white' : 'text-[#8E8E93]'
                  }`}
                >
                  {idx + 1}
                </span>
                <ClearableNumberInput
                  value={set.weightKg}
                  onChange={(v) => patchSet(idx, { weightKg: v ?? 0 })}
                  min={0}
                  max={500}
                  step={0.5}
                  aria-label={`Série ${idx + 1} poids`}
                  className={FIELD}
                />
                <ClearableNumberInput
                  value={set.reps}
                  onChange={(v) =>
                    patchSet(idx, { reps: v != null ? Math.round(v) : 0 })
                  }
                  min={1}
                  max={50}
                  aria-label={`Série ${idx + 1} reps`}
                  className={FIELD}
                />
                {done && effortDone ? (
                  <div
                    className={`${FIELD} flex items-center justify-center text-[13px] text-[#AEAEB2]`}
                    aria-label={`Série ${idx + 1} effort ${effortDone}`}
                  >
                    {effortDone}
                  </div>
                ) : (
                  <ClearableNumberInput
                    value={set.rpe ?? null}
                    onChange={(v) =>
                      patchSet(idx, {
                        rpe: v != null ? Math.min(10, Math.max(1, Math.round(v))) : undefined,
                      })
                    }
                    min={1}
                    max={10}
                    required={false}
                    placeholder="1–10"
                    placeholderClassName="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-[#636366]"
                    aria-label={`Série ${idx + 1} effort facultatif`}
                    className={`${FIELD} text-[13px] text-[#AEAEB2]`}
                  />
                )}
                <div className="flex items-center justify-center">
                  {done ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white"
                      aria-label={`Série ${idx + 1} validée`}
                    >
                      <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className="h-7 w-7 rounded-full border border-[#3a3a3c]"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {undoVisible && onUndoValidation ? (
          <button
            type="button"
            onClick={onUndoValidation}
            className="ios-press mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/12 text-[13px] font-semibold text-[#AEAEB2]"
            data-undo-validation
          >
            Annuler
          </button>
        ) : null}

        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={() => onAddSet(exercise.id)}
            className="ios-press flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/12 bg-[#1c1c1e] px-3 text-[13px] font-semibold text-[#AEAEB2]"
          >
            + Ajouter une série
          </button>
          {autoValidate ? null : (
            <button
              type="button"
              onClick={() => onValidateSet(exercise, validateIdx, restSecResolved)}
              disabled={Boolean(exercise.sets[validateIdx]?.done) && pendingIdx < 0}
              className="ios-press flex min-h-11 flex-[1.35] items-center justify-center rounded-xl bg-[#FF2B2B] px-3 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              Valider la série
            </button>
          )}
        </div>

        {showRecovery ? null : (
        <div
          className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3"
          role="timer"
          aria-label={
            restActive
              ? `Repos ${formatClock(restDisplaySec)}`
              : `Repos prévu ${formatClock(restDisplaySec)}`
          }
        >
          <Timer className="h-4 w-4 shrink-0 text-[#FF2B2B]" strokeWidth={2.25} />
          <p className="flex-1 text-[14px] font-semibold text-white">
            Repos{' '}
            <span className="tabular-nums tracking-tight">{formatClock(restDisplaySec)}</span>
          </p>
          <button
            type="button"
            onClick={() => nudgeRest(-15)}
            className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 text-white"
            aria-label="Réduire le repos de 15 secondes"
          >
            <Minus className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => nudgeRest(15)}
            className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 text-white"
            aria-label="Augmenter le repos de 15 secondes"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        )}

        <div className="mt-3 h-px w-full bg-white/8" aria-hidden="true" />

        {/* Progress + exercise nav — masqués pendant récup (évite fantômes sous le chrono) */}
        {showRecovery ? null : (
          <>
            <div className="mt-2.5 flex items-center gap-3">
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center"
                aria-label={`Progression ${progressLabel}`}
              >
                <svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden="true">
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#2c2c2e"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#FF2B2B"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-white">
                  {progressLabel}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">
                  {displayName}
                </p>
                <div
                  className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1"
                  role="navigation"
                  aria-label="Exercices de la séance"
                >
                  {exercises.map((ex, i) => {
                    const current = i === safeIndex
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => onActiveIndexChange(i)}
                        className={`ios-press relative min-h-9 min-w-5 px-0.5 text-[13px] font-semibold tabular-nums ${
                          current ? 'text-white' : 'text-[#636366]'
                        }`}
                        aria-current={current ? 'true' : undefined}
                        aria-label={`Exercice ${i + 1}${ex.name ? ` ${ex.name}` : ''}`}
                      >
                        {i + 1}
                        {current ? (
                          <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 w-3 rounded-full bg-[#FF2B2B]" />
                        ) : null}
                      </button>
                    )
                  })}
                  {onAddExercise ? (
                    <button
                      type="button"
                      onClick={onAddExercise}
                      className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 text-[#AEAEB2]"
                      aria-label="Ajouter un exercice"
                      data-add-exercise
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onFinishSession}
              disabled={saving}
              className="ios-press mt-3 mb-0.5 min-h-11 w-full text-center text-[13px] font-medium text-[#636366] disabled:opacity-50"
            >
              {saving ? 'Synchro…' : 'Terminer la séance'}
            </button>
          </>
        )}
      </div>
      </div>

      {showRecovery ? <RecoveryTimerPanel /> : null}
    </section>
  )
}
