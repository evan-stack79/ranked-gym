import { Loader2, Satellite, Radar } from 'lucide-react'

interface LobbyLoaderProps {
  phase: 'locating' | 'fetching'
}

export function LobbyLoader({ phase }: LobbyLoaderProps) {
  const isLocating = phase === 'locating'

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative">
        <div
          className={`absolute inset-0 rounded-full blur-3xl ${
            isLocating ? 'bg-neon-green/15' : 'bg-neon-blue/15'
          }`}
        />
        <div
          className={`relative flex h-28 w-28 items-center justify-center rounded-full border-2 bg-anthracite-light ${
            isLocating ? 'border-neon-green/30' : 'border-neon-blue/30'
          }`}
        >
          {isLocating ? (
            <Satellite className="h-12 w-12 text-neon-green animate-pulse-neon" />
          ) : (
            <Radar className="h-12 w-12 text-neon-blue animate-pulse-neon" />
          )}
          <Loader2
            className={`absolute -right-1 -top-1 h-6 w-6 animate-spin ${
              isLocating ? 'text-neon-green' : 'text-neon-blue'
            }`}
          />
        </div>
      </div>

      <div className="text-center">
        <p className="font-semibold text-white">
          {isLocating ? 'Acquisition GPS...' : 'Scan des salles à proximité...'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {isLocating
            ? 'Recherche de ta position exacte via satellite'
            : 'Interrogation OpenStreetMap (Overpass API)'}
        </p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full animate-pulse ${
              isLocating ? 'bg-neon-green/60' : 'bg-neon-blue/60'
            }`}
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
