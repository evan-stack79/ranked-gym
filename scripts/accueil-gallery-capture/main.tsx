import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { HomeGalleryView } from '../../src/components/home/HomeGalleryView'
import { BottomNav } from '../../src/components/layout/BottomNav'
import type { TabId } from '../../src/types'
import type { TrainingState, WorkoutNote, WorkoutRoutine } from '../../src/types/training'
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

const routines: WorkoutRoutine[] = [
  {
    id: 'push',
    label: 'Push',
    subtitle: 'Poussée',
    accent: '#FF2B2B',
    updatedAt: 1,
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 8, weightKg: 60, done: true },
          { reps: 8, weightKg: 60, done: true },
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
      },
      {
        id: 'e2',
        name: 'Développé militaire',
        sets: [
          { reps: 10, weightKg: 30 },
          { reps: 10, weightKg: 30 },
        ],
      },
    ],
  },
  {
    id: 'pull',
    label: 'Pull',
    subtitle: 'Tirage',
    accent: '#00B4FF',
    updatedAt: 1,
    exercises: [
      { id: 'e3', name: 'Tractions', sets: [{ reps: 6, weightKg: 0 }, { reps: 6, weightKg: 0 }] },
    ],
  },
  {
    id: 'legs',
    label: 'Legs',
    subtitle: 'Jambes',
    accent: '#FF9F0A',
    updatedAt: 1,
    exercises: [
      {
        id: 'e4',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }],
      },
    ],
  },
  {
    id: 'full',
    label: 'Full',
    subtitle: 'Full body',
    accent: '#FF2B2B',
    updatedAt: 1,
    exercises: [],
  },
]

const notes: WorkoutNote[] = [
  {
    id: 'n-yest',
    title: 'Squat',
    dateKey: dateKeyOffset(1),
    createdAt: atHour(1, 17, 10),
    estimatedKcal: 280,
    durationMin: 40,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e4',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }],
      },
    ],
  },
  {
    id: 'n-old',
    title: 'Tractions',
    dateKey: dateKeyOffset(3),
    createdAt: atHour(3, 12, 0),
    estimatedKcal: 180,
    durationMin: 25,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [{ id: 'e3', name: 'Tractions', sets: [{ reps: 6, weightKg: 0 }] }],
  },
  {
    id: 'n-older',
    title: 'Push',
    dateKey: dateKeyOffset(5),
    createdAt: atHour(5, 19, 0),
    estimatedKcal: 300,
    durationMin: 42,
    sessionKind: 'strength',
    sportId: 'musculation',
    routineId: 'push',
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }],
      },
    ],
  },
]

const weekday = new Date().getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

const fixtureState: TrainingState = {
  primarySportId: 'musculation',
  favoriteSportIds: ['musculation'],
  stepsToday: 0,
  stepsDateKey: todayKey(),
  healthLinked: false,
  notificationsEnabled: false,
  templates: [],
  schedule: [
    {
      id: 'sch-1',
      templateId: 'tpl-push',
      title: 'Push',
      days: [weekday],
      time: '18:00',
      enabled: true,
      sportId: 'musculation',
      sessionKind: 'strength',
    },
  ],
  completed: [],
  workoutNotes: notes,
  routines,
  lastSelectedRoutineId: 'push',
  lastSelectedSportId: 'musculation',
  activeWorkoutDraft: {
    routineId: 'push',
    sportId: 'musculation',
    startedAt: Date.now() - 20 * 60_000,
    updatedAt: Date.now(),
  },
}

localStorage.setItem('ranked-gym:training', JSON.stringify(fixtureState))
localStorage.setItem('ranked-gym:discipline', 'musculation')

function CaptureShell() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialTab = (params.get('tab') as TabId | null) ?? 'home'
  const [tab, setTab] = useState<TabId>(initialTab)

  document.documentElement.dataset.bottomNavPreview = 'floating-pill'
  document.documentElement.style.setProperty('--app-safe-area-top', '47px')
  document.documentElement.style.setProperty('--app-safe-area-bottom', '34px')

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden mesh-bg font-sans"
      data-harness-ready="1"
      data-accueil-capture="1"
    >
      <main
        className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto"
        data-app-scroll-main="1"
        style={{
          paddingBottom: 'calc(var(--app-bottom-nav) + 34px + 1.5rem)',
          paddingTop: 'max(1rem, calc(47px + 0.5rem))',
        }}
      >
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          {tab === 'home' ? (
            <HomeGalleryView
              onStartTraining={() => setTab('training')}
              onOpenTraining={() => setTab('training')}
              onOpenHistory={() => setTab('training')}
            />
          ) : (
            <div className="flex flex-col gap-4" data-train-stub>
              <h1 className="text-[28px] font-bold text-white">Train</h1>
              <p className="text-[15px] text-[#AEAEB2]">Hub entraînement (capture nav)</p>
              <div className="h-64 rounded-[24px] bg-[#1C1C1E]" />
              <div className="h-40 rounded-[24px] bg-[#1C1C1E]" />
            </div>
          )}
        </div>
      </main>
      <BottomNav
        activeTab={tab}
        onTabChange={setTab}
        hasActiveWorkout
        floatingPill
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureShell />
  </StrictMode>,
)
