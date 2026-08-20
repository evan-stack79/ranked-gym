import type { RankTier } from '../types'

export interface RankVisual {
  /** CSS radial/linear gradient for the card face */
  background: string
  label: string
  sublabel: string
  border: string
  glow: string
}

export const rankVisuals: Record<RankTier, RankVisual> = {
  Bronze: {
    background:
      'radial-gradient(ellipse 120% 100% at 20% 15%, #FF8A3D 0%, #C45A1A 35%, #7A3210 70%, #3D1A08 100%)',
    label: 'text-white',
    sublabel: 'text-[#FFD4A8]',
    border: 'border-[#FF9F5A]/40',
    glow: '0 0 40px rgb(196 90 26 / 0.45)',
  },
  Argent: {
    background:
      'radial-gradient(ellipse 120% 100% at 25% 10%, #F0F4F8 0%, #A8C4D8 30%, #6B8FA8 65%, #2A3A4A 100%)',
    label: 'text-white',
    sublabel: 'text-[#D8E8F4]',
    border: 'border-white/35',
    glow: '0 0 36px rgb(168 196 216 / 0.4)',
  },
  Or: {
    background:
      'radial-gradient(ellipse 120% 100% at 20% 10%, #FFE566 0%, #FFC107 28%, #E8A010 55%, #8B5A00 100%)',
    label: 'text-[#1A1200]',
    sublabel: 'text-[#5C3D00]',
    border: 'border-[#FFE566]/50',
    glow: '0 0 44px rgb(255 193 7 / 0.5)',
  },
  Platine: {
    background:
      'radial-gradient(ellipse 120% 100% at 22% 12%, #5CFFE8 0%, #00D4AA 32%, #00B4FF 62%, #065A6E 100%)',
    label: 'text-white',
    sublabel: 'text-[#C8FFF4]',
    border: 'border-[#5CFFE8]/40',
    glow: '0 0 44px rgb(0 212 170 / 0.45)',
  },
  Diamant: {
    background:
      'radial-gradient(ellipse 120% 100% at 18% 10%, #FF4DCF 0%, #C026FF 28%, #7B2FFF 55%, #3B0A6E 100%)',
    label: 'text-white',
    sublabel: 'text-[#F5C8FF]',
    border: 'border-[#FF4DCF]/45',
    glow: '0 0 48px rgb(192 38 255 / 0.5)',
  },
  Master: {
    background:
      'radial-gradient(ellipse 120% 100% at 20% 12%, #A78BFA 0%, #7C3AED 30%, #4C1D95 60%, #1E0A3C 100%)',
    label: 'text-white',
    sublabel: 'text-[#DDD6FE]',
    border: 'border-[#A78BFA]/40',
    glow: '0 0 44px rgb(124 58 237 / 0.45)',
  },
  Légende: {
    background:
      'radial-gradient(ellipse 130% 110% at 25% 8%, #FFD700 0%, #FF6B00 22%, #FF2B2B 48%, #8B0000 78%, #2A0505 100%)',
    label: 'text-white',
    sublabel: 'text-[#FFE8A0]',
    border: 'border-[#FFD700]/70',
    glow: '0 0 52px rgb(255 43 43 / 0.55), 0 0 24px rgb(255 215 0 / 0.35)',
  },
}
