import { Loader2, Satellite, Radar, Search } from 'lucide-react'

type LoaderPhase = 'locating' | 'geocoding' | 'fetching'

interface LobbyLoaderProps {
  phase: LoaderPhase
}

const LOADER_CONFIG: Record<
  LoaderPhase,
  { icon: typeof Satellite; color: 'green' | 'blue' | 'purple'; title: string; subtitle: string }
> = {
  locating: {
    icon: Satellite,
    color: 'green',
    title: 'Acquisition GPS...',
    subtitle: 'Autorise l\'accès à ta position si Safari te le demande',
  },
  geocoding: {
    icon: Search,
    color: 'purple',
    title: 'Géocodage de la ville...',
    subtitle: 'Conversion du nom en coordonnées (Nominatim)',
  },
  fetching: {
    icon: Radar,
    color: 'blue',
    title: 'Scan des salles à proximité...',
    subtitle: 'Interrogation OpenStreetMap (Overpass API)',
  },
}

const COLOR_CLASSES = {
  green: {
    blur: 'bg-neon-green/15',
    border: 'border-neon-green/30',
    icon: 'text-neon-green',
    dots: 'bg-neon-green/60',
  },
  blue: {
    blur: 'bg-neon-blue/15',
    border: 'border-neon-blue/30',
    icon: 'text-neon-blue',
    dots: 'bg-neon-blue/60',
  },
  purple: {
    blur: 'bg-neon-purple/15',
    border: 'border-neon-purple/30',
    icon: 'text-neon-purple',
    dots: 'bg-neon-purple/60',
  },
}

export function LobbyLoader({ phase }: LobbyLoaderProps) {
  const config = LOADER_CONFIG[phase]
  const colors = COLOR_CLASSES[config.color]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative">
        <div className={`absolute inset-0 rounded-full blur-3xl ${colors.blur}`} />
        <div
          className={`relative flex h-28 w-28 items-center justify-center rounded-full border-2 bg-anthracite-light ${colors.border}`}
        >
          <Icon className={`h-12 w-12 ${colors.icon} animate-pulse-neon`} />
          <Loader2 className={`absolute -right-1 -top-1 h-6 w-6 animate-spin ${colors.icon}`} />
        </div>
      </div>

      <div className="text-center">
        <p className="font-semibold text-white">{config.title}</p>
        <p className="mt-1 text-sm text-slate-400">{config.subtitle}</p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full animate-pulse ${colors.dots}`}
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
