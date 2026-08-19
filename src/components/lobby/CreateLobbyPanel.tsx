import { useState, type FormEvent } from 'react'
import { Plus, ArrowRight } from 'lucide-react'

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
        className="flex w-full items-center gap-3 rounded-2xl bg-ios-surface p-4 text-left transition-colors active:bg-ios-inset disabled:opacity-50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ios-inset">
          <Plus className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
        </span>
        <span>
          <span className="block text-[15px] font-semibold text-white">
            Ma salle n&apos;y est pas ? Créer un Lobby
          </span>
          <span className="mt-0.5 block text-[13px] text-[#8E8E93]">
            Lance un lobby perso avec des rivaux simulés
          </span>
        </span>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-ios-surface p-4">
      <p className="mb-3 text-[15px] font-semibold text-white">Nomme ta salle</p>

      <input
        type="text"
        value={gymName}
        onChange={(e) => setGymName(e.target.value)}
        placeholder="Iron Box, CrossFit Local…"
        disabled={disabled}
        autoFocus
        className="w-full rounded-xl bg-ios-inset px-4 py-3 text-[17px] text-white placeholder:text-[#48484A] focus:outline-none disabled:opacity-50"
        aria-label="Nom de ta salle"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setExpanded(false)
            setGymName('')
          }}
          className="flex-1 rounded-xl bg-ios-inset py-3 text-[15px] font-medium text-[#8E8E93]"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={disabled || gymName.trim().length < 2}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#0A84FF] py-3 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Créer
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
