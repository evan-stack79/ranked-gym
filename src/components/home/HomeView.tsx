import { TrendingUp, Zap, Trophy, ChevronRight } from 'lucide-react'

const feedItems = [
  {
    id: 1,
    user: 'IronMike',
    action: 'a battu son record au développé couché',
    xp: '+250 XP',
    time: '2 min',
  },
  {
    id: 2,
    user: 'FlexQueen',
    action: 'a monté en rang Diamant',
    xp: '+500 XP',
    time: '15 min',
  },
  {
    id: 3,
    user: 'BeastMode_99',
    action: 'a terminé un défi squat 5x5',
    xp: '+180 XP',
    time: '32 min',
  },
]

export function HomeView() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-green">
          Bienvenue
        </p>
        <h1 className="text-2xl font-bold text-white">
          Ranked <span className="neon-text-green text-neon-green">Gym</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Entraîne-toi. Monte en rank. Domine.
        </p>
      </header>

      <section className="gradient-border">
        <div className="rounded-2xl bg-anthracite p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Défi du jour</p>
              <p className="mt-1 font-semibold text-white">100 pompes en 10 min</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-green/10">
              <Zap className="h-6 w-6 text-neon-green" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-neon-green">
            <Trophy className="h-4 w-4" />
            <span>Récompense : 500 XP + Badge</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <TrendingUp className="h-5 w-5 text-neon-blue" />
            Fil d&apos;activité
          </h2>
        </div>

        <ul className="space-y-3">
          {feedItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-anthracite-light p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{item.user}</span>{' '}
                  {item.action}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-neon-green">{item.xp}</span>
                  <span>·</span>
                  <span>il y a {item.time}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
