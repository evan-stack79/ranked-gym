import { useState, useCallback, useEffect } from 'react'
import {
  MapPin,
  Users,
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
import { getCurrentPosition, GeolocationError } from '../../services/geolocation'
import { geocodeCity, NominatimError } from '../../services/nominatimApi'
import { fetchNearbyGyms, createVirtualGym } from '../../services/overpassApi'
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
        if (err instanceof NominatimError) {
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

  const handleCreateCustomLobby = useCallback(
    async (gymName: string) => {
      if (!location) return

      const customGym = createVirtualGym(
        gymName,
        location.coords.lat,
        location.coords.lng,
        location.source === 'manual' ? location.label : undefined,
      )

      saveCustomGym(customGym)
      setNearbyGyms((prev) => mergeWithCustomGyms([customGym, ...prev.filter((g) => g.id !== customGym.id)]))

      setCheckingInGymId(customGym.id)
      await new Promise((resolve) => setTimeout(resolve, 600))
      setCheckingInGymId(null)
      enterLobby(customGym)
    },
    [location, enterLobby],
  )

  const handleGymCheckIn = useCallback(
    async (gym: NearbyGym) => {
      if (!gym.canCheckIn) return

      setCheckingInGymId(gym.id)
      await new Promise((resolve) => setTimeout(resolve, 800))
      setCheckingInGymId(null)
      enterLobby(gym)
    },
    [enterLobby],
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1C1E] text-[#8E8E93] active:bg-[#2C2C2E]"
            aria-label="Nouvelle recherche"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        )}
      </header>

      {location && phase !== 'idle' && !isLoading && (
        <div className="rounded-2xl bg-[#1C1C1E] px-4 py-3">
          <div className="flex items-center gap-2 text-[15px]">
            {location.source === 'gps' ? (
              <LocateFixed className="h-4 w-4 shrink-0 text-[#0A84FF]" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-[#8E8E93]" />
            )}
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
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1C1C1E]">
              <Navigation className="h-9 w-9 text-[#8E8E93]" strokeWidth={1.75} />
            </div>
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
        <div className="rounded-2xl bg-[#1C1C1E] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF453A]" />
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
          <MapPin className="h-10 w-10 text-[#48484A]" />
          <div>
            <p className="text-[17px] font-semibold text-white">Aucune salle trouvée</p>
            <p className="mt-1 text-[15px] text-[#8E8E93]">
              Aucun centre dans un rayon de {formatDistance(SEARCH_RADIUS_METERS)}.
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
            <div className="rounded-2xl bg-[#1C1C1E] p-4 text-[15px] text-[#EBEBF5]">
              Approche-toi à moins de 200 m d&apos;une salle pour activer le check-in.
            </div>
          )}
          {location?.source === 'manual' && (
            <div className="rounded-2xl bg-[#1C1C1E] p-4 text-[15px] text-[#8E8E93]">
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
          <div className="rounded-2xl bg-[#1C1C1E] p-5">
            <p className="text-[13px] font-medium text-[#30D158]">Check-in confirmé</p>
            {checkedInAt != null && (
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                Session {formatCheckInDuration(checkedInAt)}
              </p>
            )}
            <p className="mt-2 text-[20px] font-semibold tracking-tight text-white">
              {checkedInGym.name}
            </p>
            {checkedInGym.isCustom && (
              <p className="mt-1 text-[13px] text-[#8E8E93]">Salle personnelle · sauvegardée</p>
            )}
            {checkedInGym.address && (
              <p className="mt-1 text-[13px] text-[#8E8E93]">{checkedInGym.address}</p>
            )}
          </div>

          <div className="rounded-2xl bg-[#1C1C1E] px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
              <span className="text-[15px] text-[#EBEBF5]">Membres actifs dans ta salle</span>
            </div>
          </div>

          <GymMemberList members={lobbyMembers} gymName={checkedInGym.name} />

          <NeonButton onClick={handleLeaveGym} variant="destructive" className="py-3.5 text-[15px]">
            <span className="flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" />
              Quitter la salle
            </span>
          </NeonButton>

          <NeonButton onClick={resetToIdle} variant="secondary" className="py-3.5 text-[15px]">
            Changer de salle
          </NeonButton>
        </>
      )}
    </div>
  )
}
