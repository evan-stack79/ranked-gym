import { MapPin, Dumbbell, Swords, Flame } from 'lucide-react'
import type { GymMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { RankBadge } from '../ui/RankBadge'
import { OnlineIndicator } from '../ui/OnlineIndicator'
import { IconBadge } from '../ui/IconBadge'
import { StatusBadge, statusFromPower } from '../ui/StatusBadge'

interface GymMemberCardProps {
  member: GymMember
  index: number
}

export function GymMemberCard({ member, index }: GymMemberCardProps) {
  const status = statusFromPower(member.level, member.rank)

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-white/10 p-4"
      style={{
        background:
          index === 0
            ? 'radial-gradient(ellipse 80% 100% at 0% 50%, rgb(255 43 43 / 0.18) 0%, rgb(28 28 30 / 0.92) 55%)'
            : 'rgb(28 28 30 / 0.88)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
    >
      {index === 0 && (
        <span className="absolute right-3 top-3 rounded-md border border-[#FFD60A]/35 bg-[#FFD60A]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#FFD60A]">
          Menace #1
        </span>
      )}

      <div className="flex items-center gap-3.5">
        <div className="relative">
          <Avatar
            username={member.username}
            size="md"
            className="ring-2 ring-[#FF2B2B]/35"
          />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#0C0C0E] bg-[#FF2B2B] text-[10px] font-bold text-white">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 pr-14">
            <h3 className="truncate text-[16px] font-bold tracking-tight text-white">
              {member.username}
            </h3>
            {status && <StatusBadge variant={status} />}
          </div>

          <div className="mt-1.5">
            <RankBadge rank={member.rank} level={member.level} size="sm" />
          </div>

          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-[#EBEBF5]">
            <IconBadge icon={Dumbbell} variant="crimson" size="sm" />
            <span className="min-w-0 truncate font-medium">{member.currentExercise}</span>
          </p>
          {member.disciplineLabel && (
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
              {member.disciplineLabel}
            </p>
          )}
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
      <div
        className="mb-4 overflow-hidden rounded-2xl border border-white/10 px-4 py-3.5"
        style={{
          background:
            'radial-gradient(ellipse 70% 120% at 100% 0%, rgb(255 43 43 / 0.2) 0%, transparent 55%), rgb(28 28 30 / 0.9)',
        }}
      >
        <div className="flex items-center gap-3">
          <IconBadge icon={Swords} variant="crimson" size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-bold tracking-tight text-white">{gymName}</h2>
              <Flame className="h-4 w-4 shrink-0 text-[#FF9F0A]" />
            </div>
            <p className="text-[13px] text-[#8E8E93]">
              <span className="font-semibold text-[#FF2B2B]">{members.length}</span> rival
              {members.length > 1 ? 's' : ''} en ligne · compétition active
            </p>
          </div>
          <IconBadge icon={MapPin} variant="white" size="sm" />
        </div>
      </div>

      <ul className="space-y-2.5">
        {members.map((member, index) => (
          <li key={member.id}>
            <GymMemberCard member={member} index={index} />
          </li>
        ))}
      </ul>
    </section>
  )
}
