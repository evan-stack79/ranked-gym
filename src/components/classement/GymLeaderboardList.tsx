import { frenchOrdinalRank } from '../../../convex/gymLeaderboardLogic'

export type LeaderboardRow = {
  userId: string
  pseudo: string
  points: number
  rank: number
  isMe?: boolean
}

function initials(pseudo: string): string {
  return (pseudo.trim().slice(0, 1) || '?').toUpperCase()
}

export function GymLeaderboardList({
  rows,
  /** Skip ranks already shown on the podium (1–3). */
  skipRanksUpTo = 0,
}: {
  rows: LeaderboardRow[]
  skipRanksUpTo?: number
}) {
  const visible = rows.filter((r) => r.rank > skipRanksUpTo)
  if (visible.length === 0) return null

  return (
    <ul className="mt-4 space-y-2" data-classement-list>
      {visible.map((row) => (
        <li
          key={row.userId}
          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
            row.isMe
              ? 'border-[#FF2B2B]/70 bg-[#1C1C1E]'
              : 'border-transparent bg-[#1C1C1E]'
          }`}
          data-classement-row={row.isMe ? 'me' : 'other'}
        >
          <span className="w-8 shrink-0 text-[14px] font-semibold tabular-nums text-[#AEAEB2]">
            {frenchOrdinalRank(row.rank)}
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3A3A3C] text-[13px] font-bold text-white">
            {initials(row.pseudo)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
            {row.isMe ? 'Toi' : row.pseudo}
          </span>
          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white">
            {row.points} pts
          </span>
        </li>
      ))}
    </ul>
  )
}
