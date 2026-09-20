import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { WorkoutHistory } from '../../src/components/training/WorkoutHistory'
import type { WorkoutNote } from '../../src/types/training'

const TODAY = '2026-09-20'
const MS = Date.parse('2026-09-20T18:30:00.000Z')

const notes: WorkoutNote[] = [
  {
    id: 'n-squat',
    title: 'Biceps',
    dateKey: TODAY,
    createdAt: MS,
    estimatedKcal: 210,
    durationMin: 22,
    totalVolumeKg: 500,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-squat',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }],
      },
    ],
  },
  {
    id: 'n-bench',
    title: 'Biceps',
    dateKey: TODAY,
    createdAt: MS - 3_600_000,
    estimatedKcal: 180,
    durationMin: 18,
    totalVolumeKg: 480,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-bench',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }],
      },
    ],
  },
  {
    id: 'n-multi',
    title: 'Biceps',
    dateKey: TODAY,
    createdAt: MS - 7_200_000,
    estimatedKcal: 320,
    durationMin: 40,
    totalVolumeKg: 980,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-squat-2',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }],
      },
      {
        id: 'e-bench-2',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }],
      },
    ],
  },
  {
    id: 'n-custom',
    title: 'Push du soir',
    titleSource: 'user',
    dateKey: TODAY,
    createdAt: MS - 10_800_000,
    estimatedKcal: 200,
    durationMin: 25,
    totalVolumeKg: 480,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-bench-3',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }],
      },
    ],
  },
]

function Harness() {
  return (
    <div
      className="min-h-[100dvh] bg-[#070708] px-4 py-6 text-white"
      data-harness-ready
      data-history-titles
    >
      <WorkoutHistory notes={notes} onDelete={() => undefined} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
