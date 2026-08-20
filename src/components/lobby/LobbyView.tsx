import { useState, useCallback, useEffect } from 'react'
import {
  MapPin,
  RefreshCw,
  AlertCircle,
  LocateFixed,
  Navigation,
  LogOut,
} from 'lucide-react'
import { GymMemberList } from './GymMemberCard'
import { NearbyGymList } from './NearbyGymCard'
import { LobbyLoader } from './LobbyLoader'
import { CitySearchFallback } from './CitySearchFallback'
import { NeonButton } from '../ui/NeonButton'
import { IconBadge } from '../ui/IconBadge'
import { getCurrentPosition, GeolocationError } from '../../services/geolocation'
import {
  fetchNearbyGyms,
  createVirtualGym,
  geocodeCity,
  GooglePlacesError,
} from '../../services/googlePlacesApi'
import {
  mergeWithCustomGyms,
  saveCustomGym,
  saveCheckIn,
  getActiveCheckIn,
  clearCheckIn,
  formatCheckInDuration,
} from '../../services/lobbyStorage'
import { generateLobbyMembers } from '../../data/mockData'
import { CreateLobbyPanel } from './CreateLobbyPanel'
import { formatDistance, SEARCH_RADIUS_METERS } from '../../utils/geo'
import { useAuth } from '../../context/AuthContext'
import type { GymMember, LobbyPhase, LocationContext, NearbyGym } from '../../types'

function gymToLocation(gym: NearbyGym): LocationContext {
  return {
    coords: { lat: gym.lat, lng: gym.lng },
    source: 'manual',
    label: gym.address ?? gym.name,
  }
}

function memberCountForGym(gym: NearbyGym): number {
  return gym.isCustom ? 3 : 4
}

export function LobbyView() {
  const { requireAuth } = useAuth()
  const [phase, setPhase] = useState<LobbyPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationContext | null>(null)
  const [nearbyGyms, setNearbyGyms] = useState<NearbyGym[]>([])
  const [checkedInGym, setCheckedInGym] = useState<NearbyGym | null>(null)
  const [lobbyMembers, setLobbyMembers] = useState<GymMember[]>([])
  const [checkingInGymId, setCheckingInGymId] = useState<string | null>(null)
  const [checkedInAt, setCheckedInAt] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const savedCheckIn = getActiveCheckIn()
    if (savedCheckIn) {
      setCheckedInGym(savedCheckIn.gym)
      setCheckedInAt(savedCheckIn.checkedInAt)
      setLocation(gymToLocation(savedCheckIn.gym))
      setLobbyMembers(
        generateLobbyMembers(savedCheckIn.gym.id, memberCountForGym(savedCheckIn.gym)),
      )
      setNearbyGyms(mergeWithCustomGyms([savedCheckIn.gym]))
      setPhase('checked-in')
    }
    setHydrated(true)
  }, [])

  const enterLobby = useCallback((gym: NearbyGym) => {
    saveCheckIn(gym)
    setCheckedInGym(gym)
    setCheckedInAt(Date.now())
    setLobbyMembers(generateLobbyMembers(gym.id, memberCountForGym(gym)))
    setPhase('checked-in')
  }, [])

  const resetToIdle = useCallback(() => {
    clearCheckIn()
    setPhase('idle')
    setError(null)
    setLocation(null)
    setNearbyGyms([])
    setCheckedInGym(null)
    setLobbyMembers([])
    setCheckingInGymId(null)
    setCheckedInAt(null)
  }, [])

  const handleLeaveGym = useCallback(() => {
    clearCheckIn()
    setCheckedInGym(null)
    setLobbyMembers([])
    setCheckedInAt(null)
    setPhase(location ? 'ready' : 'idle')
  }, [location])

  const searchGymsAt = useCallback(async (ctx: LocationContext) => {
    setError(null)
    setLocation(ctx)
    clearCheckIn()
    setCheckedInGym(null)
    setLobbyMembers([])
    setCheckedInAt(null)
    setPhase('fetching')

    try {
      const gyms = await fetchNearbyGyms(ctx.coords.lat, ctx.coords.lng, {
        allowAllCheckIn: ctx.source === 'manual',
      })
      setNearbyGyms(mergeWithCustomGyms(gyms))
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les salles.')
      setPhase('idle')
    }
  }, [])

  const handleGpsSearch = useCallback(async () => {
    setError(null)
    setPhase('locating')

    try {
      const coords = await getCurrentPosition()
      await searchGymsAt({
        coords,
        source: 'gps',
        label: 'Position GPS',
      })
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Impossible de récupérer ta position.')
      }
      setPhase('idle')
    }
  }, [searchGymsAt])

  const handleCitySearch = useCallback(
    async (city: string) => {
      setError(null)
      setPhase('geocoding')

      try {
        const place = await geocodeCity(city)
        await searchGymsAt({
          coords: place.coords,
          source: 'manual',
          label: place.label,
        })
      } catch (err) {
        if (err instanceof GooglePlacesError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Erreur lors du géocodage.')
        }
        setPhase('idle')
      }
    },
    [searchGymsAt],
  )

  const handleGymCheckIn = useCallback(
    async (gym: NearbyGym, options?: { force?: boolean }) => {
      if (!gym.canCheckIn && !options?.force) return

      requireAuth(async () => {
        setCheckingInGymId(gym.id)
        await new Promise((resolve) => setTimeout(resolve, options?.force ? 450 : 800))
        setCheckingInGymId(null)
        enterLobby(gym)
      })
    },
    [enterLobby, requireAuth],
  )

  const handleCreateCustomLobby = useCallback(
    async (gymName: string) => {
      if (!location) return

      requireAuth(async () => {
        const customGym = createVirtualGym(
          gymName,
          location.coords.lat,
          location.coords.lng,
          location.source === 'manual' ? location.label : undefined,
        )

        saveCustomGym(customGym)
        setNearbyGyms((prev) =>
          mergeWithCustomGyms([customGym, ...prev.filter((g) => g.id !== customGym.id)]),
        )

        setCheckingInGymId(customGym.id)
        await new Promise((resolve) => setTimeout(resolve, 600))
        setCheckingInGymId(null)
        enterLobby(customGym)
      })
    },
    [location, enterLobby, requireAuth],
  )

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <LobbyLoader phase="fetching" />
      </div>
    )
  }

  const isLoading = phase === 'locating' || phase === 'geocoding' || phase === 'fetching'
  const checkInEligibleCount = nearbyGyms.filter((g) => g.canCheckIn).length
  const loaderPhase =
    phase === 'locating' ? 'locating' : phase === 'geocoding' ? 'geocoding' : 'fetching'

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-white">Lobby</h1>
          <p className="mt-2 text-[17px] text-[#8E8E93]">
            Trouve et rejoins une salle à proximité.
          </p>
        </div>
        {(phase === 'ready' || phase === 'checked-in') && !isLoading && (
          <button
            type="button"
            onClick={resetToIdle}
            className="flex h-10 w-10 items-center justify-center glass-card rounded-full active:bg-ios-inset"
            aria-label="Nouvelle recherche"
          >
            <RefreshCw className="h-5 w-5 text-[#FF2B2B]" />
          </button>
        )}
      </header>

      {location && phase !== 'idle' && !isLoading && (
        <div className="glass-card rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3 text-[15px]">
            <IconBadge
              icon={location.source === 'gps' ? LocateFixed : MapPin}
              variant={location.source === 'gps' ? 'crimson' : 'white'}
              size="sm"
            />
            <span className="text-[#EBEBF5]">
              {location.source === 'manual' ? (
                <>Zone · <span className="text-white">{location.label}</span></>
              ) : (
                <>
                  GPS · {location.coords.lat.toFixed(5)}, {location.coords.lng.toFixed(5)}
                  {location.coords.accuracy != null && (
                    <span className="text-[#8E8E93]"> · ±{Math.round(location.coords.accuracy)} m</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {phase === 'idle' && !isLoading && (
        <div className="flex flex-col gap-6 py-2">
          <div className="flex flex-col items-center gap-4 py-6">
            <IconBadge icon={Navigation} variant="crimson" size="md" />
            <p className="max-w-xs text-center text-[15px] text-[#8E8E93]">
              Localise les salles autour de toi pour rejoindre un lobby.
            </p>
          </div>

          <NeonButton onClick={handleGpsSearch} variant="primary">
            <span className="flex items-center justify-center gap-2">
              <LocateFixed className="h-5 w-5" />
              Check-in à ma salle
            </span>
          </NeonButton>

          <CitySearchFallback onSearch={handleCitySearch} />
        </div>
      )}

      {error && phase === 'idle' && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <IconBadge icon={AlertCircle} variant="orange" size="sm" />
            <div className="flex-1">
              <p className="text-[15px] font-medium text-white">{error}</p>
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                Utilise la recherche par ville si le GPS est bloqué.
              </p>
              <NeonButton
                onClick={handleGpsSearch}
                variant="secondary"
                className="mt-3 py-3 text-[15px]"
              >
                Réessayer la géolocalisation
              </NeonButton>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LobbyLoader phase={loaderPhase} />}

      {phase === 'ready' && nearbyGyms.length === 0 && location && (
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <IconBadge icon={MapPin} variant="white" />
          <div>
            <p className="text-[17px] font-semibold text-white">Aucune salle trouvée</p>
            <p className="mt-1 text-[15px] text-[#8E8E93]">
              Aucun centre fitness dans un rayon de {formatDistance(SEARCH_RADIUS_METERS)}.
            </p>
          </div>
          <div className="w-full">
            <CreateLobbyPanel onCreate={handleCreateCustomLobby} />
          </div>
          <NeonButton onClick={resetToIdle} variant="secondary" className="max-w-xs">
            Nouvelle recherche
          </NeonButton>
        </div>
      )}

      {phase === 'ready' && nearbyGyms.length > 0 && (
        <>
          {location?.source === 'gps' && checkInEligibleCount === 0 && (
            <div className="glass-card rounded-2xl p-4 text-[15px] text-[#EBEBF5]">
              Approche-toi à moins de 200 m d&apos;une salle pour activer le check-in.
            </div>
          )}
          {location?.source === 'manual' && (
            <div className="glass-card rounded-2xl p-4 text-[15px] text-[#8E8E93]">
              Mode ville · check-in disponible sur toutes les salles listées.
            </div>
          )}
          <NearbyGymList
            gyms={nearbyGyms}
            onCheckIn={handleGymCheckIn}
            isCheckingIn={checkingInGymId != null}
            checkingInGymId={checkingInGymId}
            footer={<CreateLobbyPanel onCreate={handleCreateCustomLobby} />}
          />
        </>
      )}

      {phase === 'checked-in' && checkedInGym && (
        <>
          <div
            className="relative overflow-hidden rounded-3xl border border-[#FF2B2B]/30 p-5"
            style={{
              background:
                'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(255 43 43 / 0.28) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, rgb(255 159 10 / 0.12) 0%, transparent 50%), rgb(28 28 30 / 0.95)',
              boxShadow:
                'inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 40px rgb(255 43 43 / 0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="online-dot inline-block h-2 w-2 rounded-full bg-[#30D158]" />
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#30D158]">
                Lobby actif
              </p>
            </div>
            {checkedInAt != null && (
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                Session {formatCheckInDuration(checkedInAt)}
              </p>
            )}
            <p className="mt-3 text-[24px] font-black tracking-tight text-white">
              {checkedInGym.name}
            </p>
            {checkedInGym.isCustom && (
              <p className="mt-1 text-[13px] text-[#8E8E93]">Salle personnelle · sauvegardée</p>
            )}
            {checkedInGym.address && (
              <p className="mt-1 text-[13px] text-[#AEAEB2]">{checkedInGym.address}</p>
            )}
            <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[13px] text-[#EBEBF5]">
              Affronte les athlètes présents. Monte en XP. Domine le rank.
            </p>
          </div>

          <GymMemberList members={lobbyMembers} gymName={checkedInGym.name} />

          <div className="sticky bottom-0 z-20 -mx-1 space-y-2 bg-gradient-to-t from-[#0C0C0E] via-[#0C0C0E]/95 to-transparent pt-4 pb-1">
            <NeonButton onClick={handleLeaveGym} variant="destructive" className="py-4 text-[16px]">
              <span className="flex items-center justify-center gap-2 font-bold">
                <LogOut className="h-5 w-5" />
                Quitter la salle
              </span>
            </NeonButton>

            <NeonButton onClick={resetToIdle} variant="secondary" className="py-3.5 text-[15px]">
              Changer de salle
            </NeonButton>
          </div>
        </>
      )}
    </div>
  )
}
