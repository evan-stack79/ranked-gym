import { useMemo, useState } from 'react'
import { Gauge, Route, Timer } from 'lucide-react'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { IconBadge } from '../ui/IconBadge'
import type { AppDisciplineId } from '../../data/disciplines'
import { getDiscipline } from '../../data/disciplines'

interface EnduranceSessionCardProps {
  disciplineId: AppDisciplineId
  bodyWeightKg: number
  onLog: (input: {
    title: string
    distanceKm: number
    durationMin: number
    paceSecPerKm: number
    estimatedKcal: number
  }) => void
}

/** Rough MET-based kcal for run / cycle. */
function estimateEnduranceKcal(
  disciplineId: AppDisciplineId,
  distanceKm: number,
  durationMin: number,
  bodyWeightKg: number,
): number {
  if (!(durationMin > 0) || !(bodyWeightKg > 0)) return 0
  const hours = durationMin / 60
  const speed = distanceKm > 0 ? distanceKm / hours : 0
  let met = 7
  if (disciplineId === 'course') {
    if (speed >= 12) met = 11.5
    else if (speed >= 10) met = 9.8
    else if (speed >= 8) met = 8.3
    else met = 6.5
  } else {
    // cyclisme
    if (speed >= 28) met = 12
    else if (speed >= 22) met = 10
    else if (speed >= 16) met = 8
    else met = 6
  }
  return Math.round(met * bodyWeightKg * hours)
}

function formatPace(secPerKm: number): string {
  if (!(secPerKm > 0) || !Number.isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function EnduranceSessionCard({
  disciplineId,
  bodyWeightKg,
  onLog,
}: EnduranceSessionCardProps) {
  const discipline = getDiscipline(disciplineId)
  const [distanceKm, setDistanceKm] = useState<number | null>(5)
  const [durationMin, setDurationMin] = useState<number | null>(30)

  const paceSecPerKm = useMemo(() => {
    if (!(distanceKm != null && distanceKm > 0 && durationMin != null && durationMin > 0)) {
      return 0
    }
    return (durationMin * 60) / distanceKm
  }, [distanceKm, durationMin])

  const kcal = useMemo(() => {
    if (distanceKm == null || durationMin == null) return 0
    return estimateEnduranceKcal(disciplineId, distanceKm, durationMin, bodyWeightKg)
  }, [disciplineId, distanceKm, durationMin, bodyWeightKg])

  const canSave =
    distanceKm != null && distanceKm > 0 && durationMin != null && durationMin > 0

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Séance {discipline.shortLabel}
        </p>
        <h2 className="text-[20px] font-bold text-white">Distance & allure</h2>
        <p className="mt-1 text-[12px] text-[#AEAEB2]">
          Note ta sortie — Nutri recalcule avec ton poids ({bodyWeightKg} kg).
        </p>
      </div>

      <div
        className="rounded-3xl border border-white/10 p-4"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 100% 0%, ${discipline.accent}33 0%, transparent 55%), #1C1C1E`,
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          <IconBadge icon={Route} variant="green" size="md" />
          <div>
            <p className="text-[15px] font-semibold text-white">{discipline.label}</p>
            <p className="text-[11px] text-[#8E8E93]">Suivi endurance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
              Distance (km)
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
              <ClearableNumberInput
                value={distanceKm}
                onChange={setDistanceKm}
                min={0.1}
                max={300}
                step={0.1}
                required={false}
                aria-label="Distance en km"
                className="w-full bg-transparent text-[28px] font-bold text-white outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
              Durée (min)
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
              <ClearableNumberInput
                value={durationMin}
                onChange={setDurationMin}
                min={1}
                max={600}
                step={1}
                required={false}
                aria-label="Durée en minutes"
                className="w-full bg-transparent text-[28px] font-bold text-white outline-none"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] text-[#8E8E93]">
              <Timer className="h-3.5 w-3.5" />
              Allure
            </p>
            <p className="mt-0.5 text-[18px] font-bold text-white">{formatPace(paceSecPerKm)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] text-[#8E8E93]">
              <Gauge className="h-3.5 w-3.5" />
              Énergie
            </p>
            <p className="mt-0.5 text-[18px] font-bold text-white">~{kcal} kcal</p>
          </div>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave || distanceKm == null || durationMin == null) return
            onLog({
              title: `${discipline.shortLabel} ${distanceKm} km`,
              distanceKm,
              durationMin,
              paceSecPerKm,
              estimatedKcal: kcal,
            })
          }}
          className="btn-brand ios-press mt-4 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Enregistrer la sortie
        </button>
      </div>
    </section>
  )
}
