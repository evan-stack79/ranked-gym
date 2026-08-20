import { Zap, Trophy, ChevronRight } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'
import { StatusBadge } from '../ui/StatusBadge'

const feedItems = [
  {
    id: 1,
    user: 'IronMike',
    action: 'a battu son record au développé couché',
    xp: '+250 XP',
    time: '2 min',
    hot: true,
  },
  {
    id: 2,
    user: 'FlexQueen',
    action: 'a monté en rang Diamant',
    xp: '+500 XP',
    time: '15 min',
    hot: false,
  },
  {
    id: 3,
    user: 'BeastMode_99',
    action: 'a terminé un défi squat 5x5',
    xp: '+180 XP',
    time: '32 min',
    hot: true,
  },
]

export function HomeView() {
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-[34px] font-bold tracking-tight text-white">Accueil</h1>
        <p className="mt-2 text-[17px] text-[#8E8E93]">
          Entraîne-toi. Progresse. Domine l&apos;arène.
        </p>
      </header>

      <section className="glass-card relative overflow-hidden rounded-2xl p-5">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle, #FF2B2B55 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="ios-label">Défi du jour</p>
              <StatusBadge variant="fire" />
            </div>
            <p className="mt-1 text-[20px] font-semibold tracking-tight text-white">
              100 pompes en 10 min
            </p>
            <p className="mt-3 flex items-center gap-2 text-[15px] text-[#8E8E93]">
              <Trophy className="h-4 w-4 text-[#FFD60A]" strokeWidth={1.75} />
              <span className="font-medium text-[#FF9F0A]">500 XP</span> · Badge
            </p>
          </div>
          <IconBadge icon={Zap} variant="crimson" />
        </div>
      </section>

      <section>
        <h2 className="ios-label mb-4 px-1">Activité récente</h2>
        <ul className="space-y-2">
          {feedItems.map((item) => (
            <li
              key={item.id}
              className="glass-card flex items-center gap-3 rounded-2xl p-4"
            >
              <IconBadge icon={Trophy} variant={item.hot ? 'crimson' : 'orange'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug text-white">
                  <span className="font-semibold">{item.user}</span>{' '}
                  <span className="text-[#EBEBF5]">{item.action}</span>
                </p>
                <p className="mt-1 text-[13px] text-[#8E8E93]">
                  <span className="font-semibold text-[#FF2B2B]">{item.xp}</span> · il y a {item.time}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#48484A]" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
