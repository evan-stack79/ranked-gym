import { frenchOrdinalRank } from '../../../convex/gymLeaderboardLogic'

export type PodiumPerson = {
  userId: string
  pseudo: string
  points: number
}

export type PodiumSlot = {
  rank: number
  points: number
  people: PodiumPerson[]
}

function initials(pseudo: string): string {
  const t = pseudo.trim()
  if (!t) return '?'
  return t.slice(0, 1).toUpperCase()
}

function AvatarStack({ people }: { people: PodiumPerson[] }) {
  const shown = people.slice(0, 4)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center justify-center -space-x-2">
      {shown.map((p) => (
        <span
          key={p.userId}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0C0C0E] bg-[#3A3A3C] text-[12px] font-bold text-white"
          title={p.pseudo}
        >
          {initials(p.pseudo)}
        </span>
      ))}
      {extra > 0 ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0C0C0E] bg-[#48484A] text-[11px] font-bold text-white">
          +{extra}
        </span>
      ) : null}
    </div>
  )
}

function Block({
  slot,
  heightClass,
  accent,
}: {
  slot: PodiumSlot
  heightClass: string
  accent: boolean
}) {
  const label = frenchOrdinalRank(slot.rank)
  const count = slot.people.length
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <AvatarStack people={slot.people} />
      <p className="mt-2 text-center text-[12px] font-medium text-[#E5E5EA]">
        {label} · {count} personne{count > 1 ? 's' : ''}
      </p>
      <p className="text-[13px] font-semibold tabular-nums text-white">{slot.points} pts</p>
      <div
        className={`mt-3 flex w-full items-end justify-center rounded-t-2xl ${heightClass} ${
          accent ? 'bg-[#7A1218]' : 'bg-[#2C2C2E]'
        }`}
      >
        <span className="pb-4 text-[40px] font-bold tabular-nums leading-none text-[#8E8E93]">
          {slot.rank}
        </span>
      </div>
    </div>
  )
}

/** Top-3 dense ranks for « Mois » — ties share a step (« 1er · 12 personnes »). */
export function GymLeaderboardPodium({ slots }: { slots: PodiumSlot[] }) {
  const first = slots.find((s) => s.rank === 1)
  const second = slots.find((s) => s.rank === 2)
  const third = slots.find((s) => s.rank === 3)
  if (!first) return null

  return (
    <section
      className="flex items-end gap-2 px-1 pt-2"
      aria-label="Podium"
      data-classement-podium
    >
      {second ? (
        <Block slot={second} heightClass="h-24" accent={false} />
      ) : (
        <div className="flex-1" />
      )}
      <Block slot={first} heightClass="h-32" accent />
      {third ? (
        <Block slot={third} heightClass="h-20" accent={false} />
      ) : (
        <div className="flex-1" />
      )}
    </section>
  )
}

export function buildPodiumSlots(
  entries: Array<{ userId: string; pseudo: string; points: number; rank: number }>,
): PodiumSlot[] {
  const byRank = new Map<number, PodiumSlot>()
  for (const e of entries) {
    if (e.rank > 3) continue
    const slot = byRank.get(e.rank) ?? { rank: e.rank, points: e.points, people: [] }
    slot.people.push({ userId: e.userId, pseudo: e.pseudo, points: e.points })
    byRank.set(e.rank, slot)
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank)
}
