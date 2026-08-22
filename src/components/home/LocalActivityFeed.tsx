import { useMemo, useState } from 'react'
import { Flame, HandMetal, Trophy } from 'lucide-react'
import { buildLocalActivityFeed, type LocalActivityItem } from '../../data/localActivityFeed'
import { formatActivityAction } from '../../utils/activityFeedPrivacy'
import { IconBadge } from '../ui/IconBadge'

interface LocalActivityFeedProps {
  areaName: string | null
  loading?: boolean
}

export function LocalActivityFeed({ areaName, loading = false }: LocalActivityFeedProps) {
  const feedArea = areaName ?? 'ta zone'
  const items = useMemo(() => buildLocalActivityFeed(feedArea), [feedArea])
  const [cheered, setCheered] = useState<Record<string, boolean>>({})

  const title = loading
    ? 'Activité récente…'
    : areaName
      ? `Activité récente autour de ${areaName}`
      : 'Activité récente autour de vous'

  const toggleCheer = (id: string) => {
    setCheered((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <section>
      <h2 className="ios-label mb-4 px-1">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <ActivityRow
            key={item.id}
            item={item}
            areaName={feedArea}
            cheered={Boolean(cheered[item.id])}
            onCheer={() => toggleCheer(item.id)}
          />
        ))}
      </ul>
    </section>
  )
}

function ActivityRow({
  item,
  areaName,
  cheered,
  onCheer,
}: {
  item: LocalActivityItem
  areaName: string
  cheered: boolean
  onCheer: () => void
}) {
  const CheerIcon = item.isPr ? HandMetal : Flame
  const actionText = formatActivityAction(item, areaName)

  return (
    <li className="glass-card flex items-center gap-3 rounded-2xl p-4">
      <IconBadge icon={Trophy} variant={item.hot ? 'crimson' : 'orange'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug text-white">
          <span className="font-semibold">{item.user}</span>{' '}
          <span className="text-[#EBEBF5]">{actionText}</span>
        </p>
        <p className="mt-1 text-[13px] text-[#8E8E93]">
          <span className="font-semibold text-[#FF2B2B]">{item.xp}</span> · il y a {item.time}
        </p>
      </div>
      <button
        type="button"
        onClick={onCheer}
        aria-pressed={cheered}
        aria-label={cheered ? 'Félicitations envoyées' : 'Féliciter'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
          cheered
            ? 'border-[#FF2B2B]/50 bg-[#FF2B2B]/25 text-[#FF5C5C] shadow-[0_0_14px_rgb(255_43_43_/_0.35)]'
            : 'border-white/10 bg-black/25 text-[#8E8E93] hover:border-white/20'
        }`}
      >
        <CheerIcon className={`h-4.5 w-4.5 ${cheered ? 'fill-current' : ''}`} strokeWidth={2.25} />
      </button>
    </li>
  )
}
