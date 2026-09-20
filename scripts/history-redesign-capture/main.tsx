import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { WorkoutHistory } from '../../src/components/training/WorkoutHistory'
import type { WorkoutNote } from '../../src/types/training'
import { todayKey } from '../../src/utils/calories'

function dateKeyOffset(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return todayKey(date)
}

function atHour(daysAgo: number, hour: number, minute = 0): number {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const TODAY = dateKeyOffset(0)
const YESTERDAY = dateKeyOffset(1)
const OLDER = dateKeyOffset(4)

const notes: WorkoutNote[] = [
  {
    id: 'n-squat',
    title: 'Biceps',
    dateKey: TODAY,
    createdAt: atHour(0, 18, 30),
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
    createdAt: atHour(0, 16, 5),
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
    createdAt: atHour(0, 12, 10),
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
    createdAt: atHour(0, 9, 40),
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
  {
    id: 'n-incomplete',
    title: 'Biceps',
    dateKey: YESTERDAY,
    createdAt: atHour(1, 19, 15),
    estimatedKcal: 0,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-deadlift',
        name: 'Soulevé de terre',
        canonicalExerciseId: 'deadlift',
        sets: [{ reps: 5, weightKg: 120 }],
      },
    ],
  },
  {
    id: 'n-unknown',
    title: 'Biceps',
    dateKey: YESTERDAY,
    createdAt: atHour(1, 8, 20),
    estimatedKcal: 90,
    durationMin: 12,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-custom',
        name: 'Élévations frontales perso',
        sets: [{ reps: 12, weightKg: 8 }],
      },
    ],
  },
  {
    id: 'n-long',
    title: 'Séance du soir après le travail avec un nom volontairement trop long',
    titleSource: 'user',
    dateKey: OLDER,
    createdAt: atHour(4, 21, 5),
    estimatedKcal: 410,
    durationMin: 58,
    totalVolumeKg: 2140,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-ohp',
        name: 'Développé militaire',
        canonicalExerciseId: 'overhead_press',
        sets: [{ reps: 6, weightKg: 50 }],
      },
      {
        id: 'e-raise',
        name: 'Élévations latérales',
        canonicalExerciseId: 'lateral_raise',
        sets: [{ reps: 12, weightKg: 10 }],
      },
      {
        id: 'e-curl',
        name: 'Curl haltères',
        canonicalExerciseId: 'dumbbell_curl',
        sets: [{ reps: 10, weightKg: 14 }],
      },
    ],
  },
  {
    id: 'n-row',
    title: 'Biceps',
    dateKey: OLDER,
    createdAt: atHour(4, 18, 40),
    estimatedKcal: 240,
    durationMin: 28,
    totalVolumeKg: 720,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-row',
        name: 'Rowing barre',
        canonicalExerciseId: 'barbell_row',
        sets: [{ reps: 8, weightKg: 70 }],
      },
    ],
  },
  {
    id: 'n-pullup',
    title: 'Biceps',
    dateKey: dateKeyOffset(6),
    createdAt: atHour(6, 17, 0),
    estimatedKcal: 160,
    durationMin: 16,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-pull',
        name: 'Tractions pronation',
        canonicalExerciseId: 'pull_up',
        sets: [{ reps: 6, weightKg: 0 }],
      },
    ],
  },
  {
    id: 'n-lat',
    title: 'Biceps',
    dateKey: dateKeyOffset(6),
    createdAt: atHour(6, 10, 15),
    estimatedKcal: 190,
    durationMin: 20,
    totalVolumeKg: 480,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-lat',
        name: 'Tirage vertical',
        canonicalExerciseId: 'lat_pulldown',
        sets: [{ reps: 10, weightKg: 48 }],
      },
    ],
  },
  {
    id: 'n-press',
    title: 'Biceps',
    dateKey: dateKeyOffset(8),
    createdAt: atHour(8, 11, 45),
    estimatedKcal: 280,
    durationMin: 32,
    totalVolumeKg: 1600,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e-leg',
        name: 'Presse à cuisses',
        canonicalExerciseId: 'leg_press',
        sets: [{ reps: 10, weightKg: 160 }],
      },
    ],
  },
]

const empty = new URLSearchParams(window.location.search).has('empty')

function Harness() {
  return (
    <div
      className="min-h-[100dvh] bg-[#070708] px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white"
      data-harness-ready
      data-history-redesign
      data-history-titles
    >
      <WorkoutHistory notes={empty ? [] : notes} onDelete={() => undefined} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
