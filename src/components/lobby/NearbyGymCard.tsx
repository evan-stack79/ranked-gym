import type { ReactNode } from 'react'
import { Building2, MapPin, Navigation, Lock, CheckCircle2 } from 'lucide-react'
import type { NearbyGym } from '../../types'
import { formatDistance, CHECK_IN_RADIUS_METERS } from '../../utils/geo'
import { NeonButton } from '../ui/NeonButton'

interface NearbyGymCardProps {
  gym: NearbyGym
  onCheckIn: (gym: NearbyGym) => void
  isCheckingIn: boolean
  checkingInGymId: string | null
}

export function NearbyGymCard({
  gym,
  onCheckIn,
  isCheckingIn,
  checkingInGymId,
}: NearbyGymCardProps) {
  const isThisCheckingIn = isCheckingIn && checkingInGymId === gym.id

  return (
    <article className="rounded-2xl bg-[#1C1C1E] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2C2C2E]">
          <Building2 className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold tracking-tight text-white">{gym.name}</h3>
            {gym.isCustom && (
              <span className="shrink-0 rounded-md bg-[#2C2C2E] px-1.5 py-0.5 text-[10px] font-medium text-[#8E8E93]">
                Perso
              </span>
            )}
          </div>
          {gym.address && (
            <p className="mt-1 flex items-start gap-1 text-[13px] text-[#8E8E93]">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{gym.address}</span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[13px] text-[#8E8E93]">
              <Navigation className="h-3 w-3" />
              {gym.isCustom ? 'Sur place' : formatDistance(gym.distanceMeters)}
            </span>
            {gym.canCheckIn ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0A84FF]">
                <CheckCircle2 className="h-3 w-3" />
                À portée
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[13px] text-[#48484A]">
                <Lock className="h-3 w-3" />
                &gt; {CHECK_IN_RADIUS_METERS} m
              </span>
            )}
          </div>
        </div>
      </div>

      {gym.canCheckIn && (
        <div className="mt-4">
          <NeonButton
            onClick={() => onCheckIn(gym)}
            loading={isThisCheckingIn}
            loadingLabel="Check-in…"
            variant="primary"
            className="py-3.5 text-[15px]"
          >
            Check-in ici
          </NeonButton>
        </div>
      )}
    </article>
  )
}

interface NearbyGymListProps {
  gyms: NearbyGym[]
  onCheckIn: (gym: NearbyGym) => void
  isCheckingIn: boolean
  checkingInGymId: string | null
  footer?: ReactNode
}

export function NearbyGymList({
  gyms,
  onCheckIn,
  isCheckingIn,
  checkingInGymId,
  footer,
}: NearbyGymListProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="ios-label">Salles à proximité</h2>
        <span className="text-[13px] text-[#8E8E93]">{gyms.length}</span>
      </div>

      <ul className="space-y-2">
        {gyms.map((gym) => (
          <li key={gym.id}>
            <NearbyGymCard
              gym={gym}
              onCheckIn={onCheckIn}
              isCheckingIn={isCheckingIn}
              checkingInGymId={checkingInGymId}
            />
          </li>
        ))}
      </ul>

      {footer && <div className="mt-3">{footer}</div>}
    </section>
  )
}
