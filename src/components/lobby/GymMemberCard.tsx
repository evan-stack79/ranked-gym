import { MapPin, Dumbbell } from 'lucide-react'
import type { GymMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { RankBadge } from '../ui/RankBadge'

interface GymMemberCardProps {
  member: GymMember
}

export function GymMemberCard({ member }: GymMemberCardProps) {
  return (
    <article className="rounded-2xl bg-ios-surface p-4">
      <div className="flex items-center gap-4">
        <Avatar username={member.username} size="md" />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold tracking-tight text-white">{member.username}</h3>
          <RankBadge rank={member.rank} level={member.level} size="sm" />
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#8E8E93]">
            <Dumbbell className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{member.currentExercise}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#30D158]" />
          <span className="text-[10px] font-medium text-[#8E8E93]">Actif</span>
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
    <section>
      <div className="mb-4 flex items-center gap-2 px-1">
        <MapPin className="h-4 w-4 text-[#8E8E93]" />
        <div>
          <h2 className="font-semibold tracking-tight text-white">{gymName}</h2>
          <p className="text-[13px] text-[#8E8E93]">
            {members.length} membre{members.length > 1 ? 's' : ''} actif{members.length > 1 ? 's' : ''}
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
