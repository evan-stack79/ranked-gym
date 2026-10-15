import { MapPin, Dumbbell } from 'lucide-react'
import type { GymMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { OnlineIndicator } from '../ui/OnlineIndicator'
import { IconBadge } from '../ui/IconBadge'

interface GymMemberCardProps {
  member: GymMember
  index: number
}

/**
 * Présence en salle — sans classement par niveau/XP/volume (VETO Q11).
 * Le rang personnel reste visible sur le profil (suivi hors classement).
 */
export function GymMemberCard({ member }: GymMemberCardProps) {
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-white/10 p-4"
      style={{
        background: 'rgb(28 28 30 / 0.88)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
    >
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <Avatar
            username={member.username}
            size="md"
            className="ring-2 ring-[#FF2B2B]/35"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[16px] font-bold tracking-tight text-white">
              {member.username}
            </h3>
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
          <IconBadge icon={MapPin} variant="crimson" size="sm" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold tracking-tight text-white">{gymName}</h2>
            <p className="text-[13px] text-[#8E8E93]">
              <span className="font-semibold text-white">{members.length}</span> personne
              {members.length > 1 ? 's' : ''} présente{members.length > 1 ? 's' : ''}
            </p>
          </div>
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
