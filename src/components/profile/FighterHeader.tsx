import { Settings } from 'lucide-react'
import { Avatar } from '../ui/Avatar'

interface FighterHeaderProps {
  username: string
  title: string
}

export function FighterHeader({ username, title }: FighterHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <Avatar username={username} size="lg" className="ring-2 ring-white/10" />
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-white">{username}</h1>
          <p className="mt-0.5 text-[15px] text-[#8E8E93]">{title}</p>
        </div>
      </div>

      <button
        type="button"
        className="glass-card flex h-10 w-10 items-center justify-center rounded-full text-[#8E8E93] transition-colors active:opacity-80"
        aria-label="Paramètres"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  )
}
