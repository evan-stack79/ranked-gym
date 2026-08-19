import { useState, type FormEvent } from 'react'
import { Plus, Sparkles, ArrowRight } from 'lucide-react'

interface CreateLobbyPanelProps {
  onCreate: (gymName: string) => void
  disabled?: boolean
}

export function CreateLobbyPanel({ onCreate, disabled = false }: CreateLobbyPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [gymName, setGymName] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = gymName.trim()
    if (trimmed.length < 2 || disabled) return
    onCreate(trimmed)
    setGymName('')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className="group w-full rounded-2xl border border-dashed border-neon-purple/40 bg-neon-purple/5 px-4 py-4 text-left transition-all hover:border-neon-purple/60 hover:bg-neon-purple/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-purple/15 transition-colors group-hover:bg-neon-purple/25">
            <Plus className="h-5 w-5 text-neon-purple" />
          </span>
          <span>
            <span className="block font-semibold text-neon-purple">Ma salle n&apos;y est pas ? Créer un Lobby</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Lance un lobby perso et affronte 3 rivaux fictifs
            </span>
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="gradient-border neon-glow-blue">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-anthracite p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon-blue" />
          <p className="text-sm font-semibold text-white">Nomme ta salle</p>
        </div>

        <input
          type="text"
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="Ex : Iron Box Tergnier, CrossFit Local..."
          disabled={disabled}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-anthracite-light px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-neon-blue/50 focus:outline-none disabled:opacity-50"
          aria-label="Nom de ta salle"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setExpanded(false)
              setGymName('')
            }}
            className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-400 hover:text-white"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={disabled || gymName.trim().length < 2}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-neon-blue/15 py-3 text-sm font-semibold text-neon-blue transition-all hover:bg-neon-blue/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Créer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
