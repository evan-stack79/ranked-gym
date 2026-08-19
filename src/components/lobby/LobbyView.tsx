import { useState, useCallback } from 'react'
import { MapPin, Users, Radio, RefreshCw, AlertCircle, LocateFixed, Navigation } from 'lucide-react'
import { GymMemberList } from './GymMemberCard'
import { NearbyGymList } from './NearbyGymCard'
import { LobbyLoader } from './LobbyLoader'
import { CitySearchFallback } from './CitySearchFallback'
import { NeonButton } from '../ui/NeonButton'
import { getCurrentPosition, GeolocationError } from '../../services/geolocation'
import { geocodeCity, NominatimError } from '../../services/nominatimApi'
import { fetchNearbyGyms, createVirtualGym } from '../../services/overpassApi'
import { generateLobbyMembers } from '../../data/mockData'
import { CreateLobbyPanel } from './CreateLobbyPanel'
import { formatDistance, SEARCH_RADIUS_METERS } from '../../utils/geo'
import type { GymMember, LobbyPhase, LocationContext, NearbyGym } from '../../types'

export function LobbyView() {
  const [phase, setPhase] = useState<LobbyPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationContext | null>(null)
  const [nearbyGyms, setNearbyGyms] = useState<NearbyGym[]>([])
  const [checkedInGym, setCheckedInGym] = useState<NearbyGym | null>(null)
  const [lobbyMembers, setLobbyMembers] = useState<GymMember[]>([])
  const [checkingInGymId, setCheckingInGymId] = useState<string | null>(null)

  const resetToIdle = useCallback(() => {
    setPhase('idle')
    setError(null)
    setLocation(null)
    setNearbyGyms([])
    setCheckedInGym(null)
    setLobbyMembers([])
    setCheckingInGymId(null)
  }, [])

  const searchGymsAt = useCallback(async (ctx: LocationContext) => {
    setError(null)
    setLocation(ctx)
    setCheckedInGym(null)
    setLobbyMembers([])
    setPhase('fetching')

    try {
      const gyms = await fetchNearbyGyms(ctx.coords.lat, ctx.coords.lng, {
        allowAllCheckIn: ctx.source === 'manual',
      })
      setNearbyGyms(gyms)
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

      setNearbyGyms((prev) => [customGym, ...prev.filter((g) => g.id !== customGym.id)])
      setCheckingInGymId(customGym.id)
      await new Promise((resolve) => setTimeout(resolve, 600))

      setCheckedInGym(customGym)
      setLobbyMembers(generateLobbyMembers(customGym.id, 3))
      setPhase('checked-in')
      setCheckingInGymId(null)
    },
    [location],
  )

  const handleGymCheckIn = useCallback(async (gym: NearbyGym) => {
    if (!gym.canCheckIn) return

    setCheckingInGymId(gym.id)
    await new Promise((resolve) => setTimeout(resolve, 800))

    setCheckedInGym(gym)
    setLobbyMembers(generateLobbyMembers(gym.id))
    setPhase('checked-in')
    setCheckingInGymId(null)
  }, [])

  const isLoading = phase === 'locating' || phase === 'geocoding' || phase === 'fetching'
  const checkInEligibleCount = nearbyGyms.filter((g) => g.canCheckIn).length
  const loaderPhase =
    phase === 'locating' ? 'locating' : phase === 'geocoding' ? 'geocoding' : 'fetching'

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Radio className="h-5 w-5 text-neon-blue animate-pulse-neon" />
          <span className="text-xs font-semibold uppercase tracking-widest text-neon-blue">
            Live Lobby
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Lobby Salle</h1>
            <p className="mt-1 text-sm text-slate-400">
              Trouve les salles autour de toi via OpenStreetMap
            </p>
          </div>
          {(phase === 'ready' || phase === 'checked-in') && !isLoading && (
            <button
              type="button"
              onClick={resetToIdle}
              className="rounded-xl border border-white/10 bg-anthracite-light p-2.5 text-slate-400 transition-colors hover:border-neon-blue/30 hover:text-neon-blue"
              aria-label="Nouvelle recherche"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {location && phase !== 'idle' && !isLoading && (
        <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {location.source === 'gps' ? (
              <LocateFixed className="h-4 w-4 shrink-0 text-neon-green" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-neon-purple" />
            )}
            <span className="text-slate-300">
              {location.source === 'manual' ? (
                <>Zone : <span className="text-white">{location.label}</span></>
              ) : (
                <>
                  GPS : {location.coords.lat.toFixed(5)}, {location.coords.lng.toFixed(5)}
                  {location.coords.accuracy != null && (
                    <span className="text-slate-500"> · ±{Math.round(location.coords.accuracy)} m</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {phase === 'idle' && !isLoading && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-neon-green/10 blur-3xl" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-neon-green/30 bg-anthracite-light">
              <Navigation className="h-12 w-12 text-neon-green" />
            </div>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <p className="text-center text-sm text-slate-400">
              Choisis comment localiser les salles à proximité
            </p>

            <NeonButton onClick={handleGpsSearch} variant="green">
              <span className="flex items-center justify-center gap-2">
                <LocateFixed className="h-5 w-5" />
                Check-in à ma salle
              </span>
            </NeonButton>

            <CitySearchFallback onSearch={handleCitySearch} />
          </div>
        </div>
      )}

      {error && phase === 'idle' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-medium text-red-300">{error}</p>
              <p className="mt-1 text-xs text-slate-500">
                Safari bloque parfois le GPS sur les liens de test — utilise la recherche par ville ci-dessus.
              </p>
              <NeonButton
                onClick={handleGpsSearch}
                variant="green"
                className="mt-3 py-3 text-sm"
              >
                <span className="flex items-center justify-center gap-2">
                  <LocateFixed className="h-4 w-4" />
                  Réessayer la géolocalisation
                </span>
              </NeonButton>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LobbyLoader phase={loaderPhase} />}

      {phase === 'ready' && nearbyGyms.length === 0 && location && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MapPin className="h-12 w-12 text-slate-600" />
          <div>
            <p className="font-medium text-white">Aucune salle trouvée</p>
            <p className="mt-1 text-sm text-slate-400">
              Aucun centre fitness OpenStreetMap dans un rayon de{' '}
              {formatDistance(SEARCH_RADIUS_METERS)}.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <CreateLobbyPanel onCreate={handleCreateCustomLobby} />
          </div>
          <NeonButton onClick={resetToIdle} variant="blue" className="max-w-xs">
            Nouvelle recherche
          </NeonButton>
        </div>
      )}

      {phase === 'ready' && nearbyGyms.length > 0 && (
        <>
          {location?.source === 'gps' && checkInEligibleCount === 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
              Approche-toi à moins de 200 m d&apos;une salle pour activer le check-in.
            </div>
          )}
          {location?.source === 'manual' && (
            <div className="rounded-xl border border-neon-purple/20 bg-neon-purple/5 p-4 text-sm text-slate-300">
              Mode ville : le check-in est disponible sur toutes les salles listées.
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
          <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" />
              <div>
                <p className="font-medium text-neon-green">Check-in confirmé</p>
                {checkedInGym.isCustom && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-neon-purple/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neon-purple">
                    Lobby perso créé
                  </span>
                )}
                <p className="mt-0.5 font-semibold text-white">{checkedInGym.name}</p>
                {checkedInGym.address && (
                  <p className="text-xs text-slate-500">{checkedInGym.address}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {formatDistance(checkedInGym.distanceMeters)} du point de recherche
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-anthracite-light px-4 py-3">
            <Users className="h-5 w-5 text-neon-blue" />
            <span className="text-sm text-slate-300">
              Rivaux actifs dans ta salle — esprit compétition !
            </span>
          </div>

          <GymMemberList members={lobbyMembers} gymName={checkedInGym.name} />

          <NeonButton onClick={resetToIdle} variant="blue" className="py-3 text-base">
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Changer de salle
            </span>
          </NeonButton>
        </>
      )}
    </div>
  )
}
