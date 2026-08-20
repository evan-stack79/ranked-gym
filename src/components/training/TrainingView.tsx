import { useState } from 'react'
import { Dumbbell, Clock, Plus, Play } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'
import { useAuth } from '../../context/AuthContext'

const quickExercises = [
  { name: 'Développé couché', muscle: 'Pectoraux', sets: '4 × 8', accent: 'crimson' as const },
  { name: 'Squat barre', muscle: 'Jambes', sets: '5 × 5', accent: 'orange' as const },
  { name: 'Tractions', muscle: 'Dos', sets: '3 × 10', accent: 'blue' as const },
  { name: 'Curl biceps', muscle: 'Bras', sets: '3 × 12', accent: 'violet' as const },
]

export function TrainingView() {
  const { requireAuth } = useAuth()
  const [sessionStarted, setSessionStarted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const handleStartSession = () => {
    requireAuth(() => {
      setSessionStarted(true)
      showToast('Séance démarrée · +XP en cours')
    })
  }

  const handleAddExercise = () => {
    requireAuth(() => {
      showToast('Exercice ajouté à ta séance')
    })
  }

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
        onClick={handleStartSession}
        className="btn-brand flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-4 text-[17px] font-semibold tracking-tight text-white transition-opacity active:opacity-80"
      >
        <Play className="h-5 w-5 fill-current" />
        {sessionStarted ? 'Séance en cours' : 'Démarrer une séance'}
      </button>

      <section>
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="ios-label">Exercices rapides</h2>
          <button
            type="button"
            onClick={handleAddExercise}
            className="flex items-center gap-1 text-[15px] font-medium text-[#FF2B2B]"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        <ul className="space-y-2">
          {quickExercises.map((exercise) => (
            <li
              key={exercise.name}
              className="glass-card flex items-center gap-4 rounded-2xl p-4"
            >
              <IconBadge icon={Dumbbell} variant={exercise.accent} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold tracking-tight text-white">{exercise.name}</p>
                <p className="text-[13px] text-[#8E8E93]">{exercise.muscle}</p>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
                <IconBadge icon={Clock} variant="white" size="sm" />
                {exercise.sets}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
