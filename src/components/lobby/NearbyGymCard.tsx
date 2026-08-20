import type { ReactNode } from 'react'
import { Building2, MapPin, Navigation, Lock, CheckCircle2, Star } from 'lucide-react'
import type { NearbyGym } from '../../types'
import { formatDistance, CHECK_IN_RADIUS_METERS } from '../../utils/geo'
import { NeonButton } from '../ui/NeonButton'
import { IconBadge } from '../ui/IconBadge'

interface NearbyGymCardProps {
  gym: NearbyGym
  onCheckIn: (gym: NearbyGym) => void
  isCheckingIn: boolean
  checkingInGymId: string | null
}

function RatingRow({ rating, total }: { rating: number; total?: number }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
      <span className="font-semibold text-[#FFD60A]">{rating.toFixed(1)}</span>
      <Star className="h-3.5 w-3.5 fill-[#FFD60A] text-[#FFD60A]" />
      {total != null && (
        <span className="text-[#8E8E93]">({total.toLocaleString('fr-FR')})</span>
      )}
    </p>
  )
}

export function NearbyGymCard({
  gym,
  onCheckIn,
  isCheckingIn,
  checkingInGymId,
}: NearbyGymCardProps) {
  const isThisCheckingIn = isCheckingIn && checkingInGymId === gym.id

  return (
    <article className="glass-card rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <IconBadge icon={Building2} variant={gym.canCheckIn ? 'crimson' : 'white'} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold tracking-tight text-white">{gym.name}</h3>
            {gym.isCustom && (
              <span className="shrink-0 rounded-md border border-white/5 bg-ios-inset px-1.5 py-0.5 text-[10px] font-medium text-[#8E8E93]">
                Perso
              </span>
            )}
          </div>

          {gym.rating != null && (
            <RatingRow rating={gym.rating} total={gym.userRatingsTotal} />
          )}

          {gym.address && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-[#8E8E93]">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF2B2B]/80" />
              <span className="line-clamp-2">{gym.address}</span>
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[13px] text-[#8E8E93]">
              <Navigation className="h-3 w-3" />
              {gym.isCustom ? 'Sur place' : formatDistance(gym.distanceMeters)}
            </span>
            {gym.canCheckIn ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#30D158]">
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
