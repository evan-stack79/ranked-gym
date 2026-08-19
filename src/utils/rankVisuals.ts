import type { RankTier } from '../types'

export interface RankVisual {
  gradient: string
  label: string
  sublabel: string
}

export const rankVisuals: Record<RankTier, RankVisual> = {
  Bronze: {
    gradient: 'from-[#3D2E24] via-[#5C4332] to-[#2A2018]',
    label: 'text-[#D4A574]',
    sublabel: 'text-[#A8845C]',
  },
  Argent: {
    gradient: 'from-[#2C2C2E] via-[#48484A] to-[#1C1C1E]',
    label: 'text-[#E5E5EA]',
    sublabel: 'text-[#AEAEB2]',
  },
  Or: {
    gradient: 'from-[#3D3520] via-[#6B5A2E] to-[#2A2414]',
    label: 'text-[#F2D98B]',
    sublabel: 'text-[#C4A85A]',
  },
  Platine: {
    gradient: 'from-[#1E2A38] via-[#3A5068] to-[#141C26]',
    label: 'text-[#B8D4E8]',
    sublabel: 'text-[#7BA3C4]',
  },
  Diamant: {
    gradient: 'from-[#1A2838] via-[#2E4A62] to-[#101820]',
    label: 'text-[#C8E6F5]',
    sublabel: 'text-[#8BB8D4]',
  },
  Master: {
    gradient: 'from-[#2A1A38] via-[#4A3060] to-[#18101F]',
    label: 'text-[#D4B8E8]',
    sublabel: 'text-[#9A7AB8]',
  },
  Légende: {
    gradient: 'from-[#1A2E24] via-[#2E5040] to-[#101810]',
    label: 'text-[#B8E8C8]',
    sublabel: 'text-[#7AB894]',
  },
}
