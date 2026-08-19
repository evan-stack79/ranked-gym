import { Settings, Swords } from 'lucide-react'
import { Avatar } from '../ui/Avatar'

interface FighterHeaderProps {
  username: string
  title: string
}

export function FighterHeader({ username, title }: FighterHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/5 bg-anthracite p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-neon-green/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-neon-blue/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neon-green/40 to-neon-blue/40 blur-lg" />
            <Avatar username={username} size="lg" className="relative ring-2 ring-neon-green/40 ring-offset-2 ring-offset-anthracite" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-neon-green/30 bg-anthracite">
              <Swords className="h-3 w-3 text-neon-green" />
            </span>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-blue">
              Combattant
            </p>
            <h1 className="text-xl font-black tracking-tight text-white">{username}</h1>
            <p className="mt-0.5 text-sm font-medium italic text-neon-green/90">{title}</p>
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl border border-white/10 bg-anthracite-light p-2.5 text-slate-400 transition-colors hover:border-neon-blue/30 hover:text-neon-blue"
          aria-label="Paramètres"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
