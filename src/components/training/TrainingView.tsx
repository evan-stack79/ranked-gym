import { Dumbbell, Clock, Plus, Play } from 'lucide-react'

const quickExercises = [
  { name: 'Développé couché', muscle: 'Pectoraux', sets: '4 × 8' },
  { name: 'Squat barre', muscle: 'Jambes', sets: '5 × 5' },
  { name: 'Tractions', muscle: 'Dos', sets: '3 × 10' },
  { name: 'Curl biceps', muscle: 'Bras', sets: '3 × 12' },
]

export function TrainingView() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Entraînement</h1>
        <p className="mt-1 text-sm text-slate-400">
          Lance une séance et gagne de l&apos;XP
        </p>
      </header>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-neon-blue/50 bg-gradient-to-b from-neon-blue/20 to-neon-blue/5 py-6 font-bold text-neon-blue neon-glow-blue transition-all active:scale-[0.98]"
      >
        <Play className="h-6 w-6 fill-current" />
        Démarrer une séance
      </button>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Dumbbell className="h-5 w-5 text-neon-green" />
            Exercices rapides
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-neon-blue"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        <ul className="space-y-3">
          {quickExercises.map((exercise) => (
            <li
              key={exercise.name}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-anthracite-light p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-green/10">
                <Dumbbell className="h-5 w-5 text-neon-green" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{exercise.name}</p>
                <p className="text-sm text-slate-500">{exercise.muscle}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-400">
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
