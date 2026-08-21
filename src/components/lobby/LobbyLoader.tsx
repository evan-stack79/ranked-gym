import { Loader2, Satellite, Radar, Search } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'

type LoaderPhase = 'locating' | 'geocoding' | 'fetching'

interface LobbyLoaderProps {
  phase: LoaderPhase
}

export function LobbyLoader({ phase }: LobbyLoaderProps) {
  const config = {
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
      title: 'Recherche des spots…',
      subtitle: 'Salles, pistes, terrains & gymnases',
    },
  }[phase]

  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-5 py-16">
      <IconBadge icon={Icon} variant="crimson" />
      <Loader2 className="h-5 w-5 animate-spin text-[#FF2B2B]" />
      <div className="text-center">
        <p className="text-[17px] font-semibold tracking-tight text-white">{config.title}</p>
        <p className="mt-1 text-[15px] text-[#8E8E93]">{config.subtitle}</p>
      </div>
    </div>
  )
}
