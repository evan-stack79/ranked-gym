import { useEffect, useMemo, useState } from 'react'
import { Flame, HandMetal, Trophy } from 'lucide-react'
import {
  buildLocalActivityFeed,
  type LocalActivityItem,
  type LocalFeedViewer,
} from '../../data/localActivityFeed'
import { formatActivityAction } from '../../utils/activityFeedPrivacy'
import { IconBadge } from '../ui/IconBadge'

interface LocalActivityFeedProps {
  areaName: string | null
  loading?: boolean
  viewer?: LocalFeedViewer | null
}

export function LocalActivityFeed({
  areaName,
  loading = false,
  viewer = null,
}: LocalActivityFeedProps) {
  const feedArea = areaName ?? 'ta zone'
  const [feedTick, setFeedTick] = useState(0)

  useEffect(() => {
    const sync = () => setFeedTick((n) => n + 1)
    window.addEventListener('ranked-gym:ghost-mode-changed', sync)
    window.addEventListener('ranked-gym:profile-changed', sync)
    return () => {
      window.removeEventListener('ranked-gym:ghost-mode-changed', sync)
      window.removeEventListener('ranked-gym:profile-changed', sync)
    }
  }, [])

  const items = useMemo(
    () => buildLocalActivityFeed(feedArea, viewer),
    [feedArea, viewer, feedTick],
  )
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
    <section className="space-y-4">
      <div>
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
      </div>
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
    <li
      className={`glass-card flex items-center gap-3 rounded-2xl p-4 ${
        item.isSelf ? 'border border-[#BF5AF2]/30' : ''
      }`}
    >
      <IconBadge icon={Trophy} variant={item.hot ? 'crimson' : item.isSelf ? 'violet' : 'orange'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug text-white">
          <span className="font-semibold">{item.user}</span>
          {item.isSelf && (
            <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-[#BF5AF2]">
              Toi
            </span>
          )}{' '}
          <span className="text-[#EBEBF5]">{actionText}</span>
        </p>
        <p className="mt-1 text-[13px] text-[#8E8E93]">
          <span className="font-semibold text-[#FF2B2B]">{item.xp}</span> · il y a {item.time}
          {item.isSelf && item.isGhostModeEnabled && (
            <span className="ml-1.5 text-[#BF5AF2]">· Mode furtif</span>
          )}
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
