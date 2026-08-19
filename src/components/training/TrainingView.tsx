import { Dumbbell, Clock, Plus, Play } from 'lucide-react'

const quickExercises = [
  { name: 'Développé couché', muscle: 'Pectoraux', sets: '4 × 8' },
  { name: 'Squat barre', muscle: 'Jambes', sets: '5 × 5' },
  { name: 'Tractions', muscle: 'Dos', sets: '3 × 10' },
  { name: 'Curl biceps', muscle: 'Bras', sets: '3 × 12' },
]

export function TrainingView() {
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-[34px] font-bold tracking-tight text-white">Entraînement</h1>
        <p className="mt-2 text-[17px] text-[#8E8E93]">
          Lance une séance et gagne de l&apos;expérience.
        </p>
      </header>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0A84FF] py-4 text-[17px] font-semibold tracking-tight text-white transition-opacity active:opacity-80"
      >
        <Play className="h-5 w-5 fill-current" />
        Démarrer une séance
      </button>

      <section>
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="ios-label">Exercices rapides</h2>
          <button type="button" className="flex items-center gap-1 text-[15px] font-medium text-[#0A84FF]">
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        <ul className="space-y-2">
          {quickExercises.map((exercise) => (
            <li
              key={exercise.name}
              className="flex items-center gap-4 rounded-2xl bg-ios-surface p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ios-inset">
                <Dumbbell className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold tracking-tight text-white">{exercise.name}</p>
                <p className="text-[13px] text-[#8E8E93]">{exercise.muscle}</p>
              </div>
              <div className="flex items-center gap-1 text-[13px] text-[#8E8E93]">
                <Clock className="h-3.5 w-3.5" />
                {exercise.sets}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
