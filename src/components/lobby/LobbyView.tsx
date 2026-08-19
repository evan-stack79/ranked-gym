import { useState, useCallback, useEffect } from 'react'
import { MapPin, Users, Radio, RefreshCw, AlertCircle, LocateFixed } from 'lucide-react'
import { GymMemberList } from './GymMemberCard'
import { NearbyGymList } from './NearbyGymCard'
import { LobbyLoader } from './LobbyLoader'
import { NeonButton } from '../ui/NeonButton'
import { getCurrentPosition, GeolocationError } from '../../services/geolocation'
import { fetchNearbyGyms } from '../../services/overpassApi'
import { generateLobbyMembers } from '../../data/mockData'
import { formatDistance, SEARCH_RADIUS_METERS } from '../../utils/geo'
import type { GeoCoordinates, GymMember, LobbyPhase, NearbyGym } from '../../types'

export function LobbyView() {
  const [phase, setPhase] = useState<LobbyPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<GeoCoordinates | null>(null)
  const [nearbyGyms, setNearbyGyms] = useState<NearbyGym[]>([])
  const [checkedInGym, setCheckedInGym] = useState<NearbyGym | null>(null)
  const [lobbyMembers, setLobbyMembers] = useState<GymMember[]>([])
  const [checkingInGymId, setCheckingInGymId] = useState<string | null>(null)

  const searchNearbyGyms = useCallback(async () => {
    setError(null)
    setPhase('locating')
    setCheckedInGym(null)
    setLobbyMembers([])

    try {
      const coords = await getCurrentPosition()
      setUserCoords(coords)
      setPhase('fetching')

      const gyms = await fetchNearbyGyms(coords.lat, coords.lng)
      setNearbyGyms(gyms)
      setPhase('ready')
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Une erreur inattendue est survenue.')
      }
      setPhase('idle')
    }
  }, [])

  useEffect(() => {
    searchNearbyGyms()
  }, [searchNearbyGyms])

  const handleCheckIn = useCallback(async (gym: NearbyGym) => {
    if (!gym.canCheckIn) return

    setCheckingInGymId(gym.id)
    await new Promise((resolve) => setTimeout(resolve, 800))

    setCheckedInGym(gym)
    setLobbyMembers(generateLobbyMembers(gym.id))
    setPhase('checked-in')
    setCheckingInGymId(null)
  }, [])

  const handleRefresh = useCallback(() => {
    if (phase === 'locating' || phase === 'fetching') return
    searchNearbyGyms()
  }, [phase, searchNearbyGyms])

  const isLoading = phase === 'locating' || phase === 'fetching'
  const checkInEligibleCount = nearbyGyms.filter((g) => g.canCheckIn).length

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
              Salles réelles autour de toi via OpenStreetMap
            </p>
          </div>
          {!isLoading && phase !== 'checked-in' && (
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-xl border border-white/10 bg-anthracite-light p-2.5 text-slate-400 transition-colors hover:border-neon-blue/30 hover:text-neon-blue"
              aria-label="Actualiser"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {userCoords && phase !== 'checked-in' && !isLoading && (
        <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <LocateFixed className="h-4 w-4 text-neon-blue" />
            <span className="text-slate-300">
              Position : {userCoords.lat.toFixed(5)}, {userCoords.lng.toFixed(5)}
              {userCoords.accuracy != null && (
                <span className="text-slate-500"> · ±{Math.round(userCoords.accuracy)} m</span>
              )}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-300">{error}</p>
              <button
                type="button"
                onClick={searchNearbyGyms}
                className="mt-2 text-sm font-medium text-neon-green underline-offset-2 hover:underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LobbyLoader phase={phase === 'locating' ? 'locating' : 'fetching'} />}

      {phase === 'ready' && nearbyGyms.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <MapPin className="h-12 w-12 text-slate-600" />
          <div>
            <p className="font-medium text-white">Aucune salle trouvée</p>
            <p className="mt-1 text-sm text-slate-400">
              Aucun centre fitness OpenStreetMap dans un rayon de{' '}
              {formatDistance(SEARCH_RADIUS_METERS)}.
            </p>
          </div>
          <NeonButton onClick={handleRefresh} variant="blue" className="max-w-xs">
            Relancer la recherche
          </NeonButton>
        </div>
      )}

      {phase === 'ready' && nearbyGyms.length > 0 && (
        <>
          {checkInEligibleCount === 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
              Approche-toi à moins de 200 m d&apos;une salle pour activer le check-in.
            </div>
          )}
          <NearbyGymList
            gyms={nearbyGyms}
            onCheckIn={handleCheckIn}
            isCheckingIn={checkingInGymId != null}
            checkingInGymId={checkingInGymId}
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
                <p className="mt-0.5 font-semibold text-white">{checkedInGym.name}</p>
                {checkedInGym.address && (
                  <p className="text-xs text-slate-500">{checkedInGym.address}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {formatDistance(checkedInGym.distanceMeters)} de ta position
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

          <NeonButton onClick={handleRefresh} variant="blue" className="py-3 text-base">
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
