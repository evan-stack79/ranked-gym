import { Settings, Flame, Target, Award } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { RankBadge } from '../ui/RankBadge'
import { XPProgressBar } from '../ui/XPProgressBar'
import { currentUser } from '../../data/mockData'

export function ProfileView() {
  const stats = [
    { icon: Flame, label: 'Série', value: '12 jours' },
    { icon: Target, label: 'Séances', value: '847' },
    { icon: Award, label: 'Victoires', value: '156' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Profil</h1>
          <p className="text-sm text-slate-400">Ton parcours compétitif</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-anthracite-light p-2.5 text-slate-400 transition-colors hover:border-neon-blue/30 hover:text-neon-blue"
          aria-label="Paramètres"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <section className="gradient-border">
        <div className="rounded-2xl bg-anthracite p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-green to-neon-blue blur-xl opacity-40" />
              <Avatar username={currentUser.username} size="xl" className="relative ring-4 ring-neon-green/30" />
            </div>

            <h2 className="text-xl font-bold text-white">{currentUser.username}</h2>
            <div className="mt-3">
              <RankBadge rank={currentUser.rank} level={currentUser.level} size="lg" />
            </div>
          </div>

          <div className="mt-6">
            <XPProgressBar
              currentXp={currentUser.currentXp}
              xpToNextLevel={currentUser.xpToNextLevel}
              level={currentUser.level}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Statistiques
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-white/5 bg-anthracite-light p-4 text-center"
            >
              <Icon className="mx-auto mb-2 h-5 w-5 text-neon-blue" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
