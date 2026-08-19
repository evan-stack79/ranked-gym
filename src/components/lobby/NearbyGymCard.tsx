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
    <article className={`gradient-border ${gym.canCheckIn ? 'neon-glow-green' : ''}`}>
      <div className="rounded-2xl bg-anthracite p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              gym.canCheckIn ? 'bg-neon-green/15' : 'bg-anthracite-light'
            }`}
          >
            <Building2
              className={`h-5 w-5 ${gym.canCheckIn ? 'text-neon-green' : 'text-slate-400'}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-white">{gym.name}</h3>
              {gym.isCustom && (
                <span className="shrink-0 rounded-full bg-neon-purple/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neon-purple">
                  Perso
                </span>
              )}
            </div>
            {gym.address && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{gym.address}</span>
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  gym.canCheckIn
                    ? 'bg-neon-green/15 text-neon-green'
                    : 'bg-anthracite-light text-slate-400'
                }`}
              >
                <Navigation className="h-3 w-3" />
                {gym.isCustom ? 'Sur place' : formatDistance(gym.distanceMeters)}
              </span>
              {gym.canCheckIn ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-neon-green">
                  <CheckCircle2 className="h-3 w-3" />
                  À portée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
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
              loadingLabel="Check-in..."
              variant="green"
              className="py-3 text-base"
            >
              <span className="flex items-center justify-center gap-2">
                <MapPin className="h-4 w-4" />
                Check-in ici
              </span>
            </NeonButton>
          </div>
        )}
      </div>
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-white">Salles à proximité</h2>
        <span className="text-xs text-slate-500">{gyms.length} trouvée{gyms.length > 1 ? 's' : ''}</span>
      </div>

      <ul className="space-y-3">
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

      {footer && <div className="mt-4">{footer}</div>}
    </section>
  )
}
