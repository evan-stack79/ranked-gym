import { Loader2, Satellite, Radar, Search } from 'lucide-react'

type LoaderPhase = 'locating' | 'geocoding' | 'fetching'

interface LobbyLoaderProps {
  phase: LoaderPhase
}

const LOADER_CONFIG: Record<LoaderPhase, { icon: typeof Satellite; title: string; subtitle: string }> = {
  locating: {
    icon: Satellite,
    title: 'Localisation…',
    subtitle: 'Autorise l\'accès à ta position si demandé',
  },
  geocoding: {
    icon: Search,
    title: 'Recherche de la ville…',
    subtitle: 'Conversion en coordonnées',
  },
  fetching: {
    icon: Radar,
    title: 'Recherche des salles…',
    subtitle: 'Interrogation OpenStreetMap',
  },
}

export function LobbyLoader({ phase }: LobbyLoaderProps) {
  const config = LOADER_CONFIG[phase]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-5 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1C1C1E]">
        <Icon className="h-7 w-7 text-[#8E8E93]" strokeWidth={1.75} />
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-[#0A84FF]" />
      <div className="text-center">
        <p className="text-[17px] font-semibold tracking-tight text-white">{config.title}</p>
        <p className="mt-1 text-[15px] text-[#8E8E93]">{config.subtitle}</p>
      </div>
    </div>
  )
}
