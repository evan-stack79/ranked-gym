import { Settings } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { StatusBadge, statusFromPower } from '../ui/StatusBadge'

interface FighterHeaderProps {
  username: string
  title: string
  level: number
  rank: string
}

export function FighterHeader({ username, title, level, rank }: FighterHeaderProps) {
  const status = statusFromPower(level, rank)

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <Avatar username={username} size="lg" className="ring-2 ring-[#FF2B2B]/40" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-white">{username}</h1>
            {status && <StatusBadge variant={status} />}
          </div>
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
