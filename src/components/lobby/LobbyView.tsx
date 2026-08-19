import { useState, useCallback } from 'react'
import { MapPin, Users, Radio } from 'lucide-react'
import { NeonButton } from '../ui/NeonButton'
import { GymMemberList } from './GymMemberCard'
import { gymMembersPresent, simulatedGymLocation } from '../../data/mockData'

function simulateGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        lat: simulatedGymLocation.lat + (Math.random() - 0.5) * 0.001,
        lng: simulatedGymLocation.lng + (Math.random() - 0.5) * 0.001,
      })
    }, 1500)
  })
}

export function LobbyView() {
  const [isLocating, setIsLocating] = useState(false)
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)

  const handleCheckIn = useCallback(async () => {
    setIsLocating(true)
    try {
      const coords = await simulateGeolocation()
      setLocationLabel(
        `${simulatedGymLocation.name} · ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      )
      setIsCheckedIn(true)
    } finally {
      setIsLocating(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Radio className="h-5 w-5 text-neon-blue animate-pulse-neon" />
          <span className="text-xs font-semibold uppercase tracking-widest text-neon-blue">
            Live Lobby
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">Lobby Salle</h1>
        <p className="mt-1 text-sm text-slate-400">
          Check-in pour voir qui s&apos;entraîne en ce moment
        </p>
      </header>

      {!isCheckedIn ? (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-neon-green/10 blur-3xl" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-neon-green/30 bg-anthracite-light">
              <MapPin className="h-14 w-14 text-neon-green" />
            </div>
          </div>

          <div className="w-full max-w-sm text-center">
            <p className="mb-6 text-sm text-slate-400">
              Simule ta position GPS pour te connecter au lobby de ta salle
            </p>
            <NeonButton onClick={handleCheckIn} loading={isLocating} variant="green">
              <span className="flex items-center justify-center gap-2">
                <MapPin className="h-5 w-5" />
                Check-in à ma salle
              </span>
            </NeonButton>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" />
              <div>
                <p className="font-medium text-neon-green">Check-in confirmé</p>
                <p className="mt-0.5 text-sm text-slate-400">{locationLabel}</p>
                <p className="text-xs text-slate-500">{simulatedGymLocation.address}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-anthracite-light px-4 py-3">
            <Users className="h-5 w-5 text-neon-blue" />
            <span className="text-sm text-slate-300">
              Membres actifs dans ta salle
            </span>
          </div>

          <GymMemberList members={gymMembersPresent} gymName={simulatedGymLocation.name} />
        </>
      )}
    </div>
  )
}
