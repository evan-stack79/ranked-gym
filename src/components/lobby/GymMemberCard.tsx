import { MapPin, Dumbbell } from 'lucide-react'
import type { GymMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { RankBadge } from '../ui/RankBadge'

interface GymMemberCardProps {
  member: GymMember
}

export function GymMemberCard({ member }: GymMemberCardProps) {
  return (
    <article className="gradient-border">
      <div className="flex items-center gap-4 rounded-2xl bg-anthracite p-4">
        <Avatar username={member.username} size="md" />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">{member.username}</h3>
          <RankBadge rank={member.rank} level={member.level} size="sm" />
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-neon-blue" />
            <span className="truncate">{member.currentExercise}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-neon-green" />
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-neon-green">
            Actif
          </span>
        </div>
      </div>
    </article>
  )
}

interface GymMemberListProps {
  members: GymMember[]
  gymName: string
}

export function GymMemberList({ members, gymName }: GymMemberListProps) {
  return (
    <section className="opacity-100 transition-opacity duration-500">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-neon-green" />
        <div>
          <h2 className="font-semibold text-white">{gymName}</h2>
          <p className="text-sm text-slate-400">
            {members.length} membre{members.length > 1 ? 's' : ''} présent{members.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {members.map((member) => (
          <li key={member.id}>
            <GymMemberCard member={member} />
          </li>
        ))}
      </ul>
    </section>
  )
}
