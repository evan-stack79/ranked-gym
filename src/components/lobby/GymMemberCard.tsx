import { MapPin, Dumbbell } from 'lucide-react'
import type { GymMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { RankBadge } from '../ui/RankBadge'
import { OnlineIndicator } from '../ui/OnlineIndicator'
import { IconBadge } from '../ui/IconBadge'
import { StatusBadge, statusFromPower } from '../ui/StatusBadge'

interface GymMemberCardProps {
  member: GymMember
}

export function GymMemberCard({ member }: GymMemberCardProps) {
  const status = statusFromPower(member.level, member.rank)

  return (
    <article className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-4">
        <Avatar username={member.username} size="md" className="ring-1 ring-[#FF2B2B]/25" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold tracking-tight text-white">{member.username}</h3>
            {status && <StatusBadge variant={status} />}
          </div>
          <RankBadge rank={member.rank} level={member.level} size="sm" />
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[#8E8E93]">
            <IconBadge icon={Dumbbell} variant="crimson" size="sm" />
            <span className="truncate">{member.currentExercise}</span>
          </p>
        </div>

        <OnlineIndicator />
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
    <section>
      <div className="mb-4 flex items-center gap-3 px-1">
        <IconBadge icon={MapPin} variant="crimson" size="sm" />
        <div>
          <h2 className="font-semibold tracking-tight text-white">{gymName}</h2>
          <p className="text-[13px] text-[#8E8E93]">
            {members.length} membre{members.length > 1 ? 's' : ''} en ligne
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.id}>
            <GymMemberCard member={member} />
          </li>
        ))}
      </ul>
    </section>
  )
}
