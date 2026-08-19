import { Zap, Trophy, ChevronRight } from 'lucide-react'

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
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-[34px] font-bold tracking-tight text-white">Accueil</h1>
        <p className="mt-2 text-[17px] text-[#8E8E93]">
          Entraîne-toi. Progresse. Partage ton rank.
        </p>
      </header>

      <section className="rounded-2xl bg-ios-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ios-label">Défi du jour</p>
            <p className="mt-2 text-[20px] font-semibold tracking-tight text-white">
              100 pompes en 10 min
            </p>
            <p className="mt-3 flex items-center gap-2 text-[15px] text-[#8E8E93]">
              <Trophy className="h-4 w-4" />
              500 XP · Badge
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ios-inset">
            <Zap className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="ios-label mb-4 px-1">Activité récente</h2>
        <ul className="space-y-2">
          {feedItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-ios-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug text-white">
                  <span className="font-semibold">{item.user}</span>{' '}
                  <span className="text-[#EBEBF5]">{item.action}</span>
                </p>
                <p className="mt-1 text-[13px] text-[#8E8E93]">
                  {item.xp} · il y a {item.time}
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
