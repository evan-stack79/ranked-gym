/**
 * Fixture QA — 7 états Mon créneau v9 pour captures.
 * Route : /creneau-v9-fixture?state=principal|depart_depasse|mineur|autre_heure|changer_salle|le_soir|pas_energie
 * Sans state → grille des 7 (scroll).
 */
import type { ReactNode } from 'react'
import { CreneauV9Screen } from '../components/training/creneau/CreneauV9Screen'
import { CRENEAU_PHRASES } from '../creneau/constants'
import { formatDepartedHeadline } from '../creneau/v9Display'
import { CRENEAU_V9_BG } from '../creneau/v9Display'
import hero01 from '../assets/photos/creneau/v9/hero-01.jpg'
import hero02 from '../assets/photos/creneau/v9/hero-02.jpg'
import hero03 from '../assets/photos/creneau/v9/hero-03.jpg'
import hero04 from '../assets/photos/creneau/v9/hero-04.jpg'
import hero05 from '../assets/photos/creneau/v9/hero-05.jpg'
import hero06 from '../assets/photos/creneau/v9/hero-06.jpg'
import hero07 from '../assets/photos/creneau/v9/hero-07.jpg'

const SOLEIL = 'Le soleil se couche à 16:55.'
const SALLE = 'Salle de la gare · 15 min à pied'

type StateDef = {
  id: string
  heroSrc: string
  eyebrow: string
  giant: string
  line1: string | null
  line2: string | null
  primaryLabel: string
  secondaryLabel: string | null
}

const STATES: StateDef[] = [
  {
    id: 'autre_heure',
    heroSrc: hero01,
    eyebrow: 'Autre heure',
    giant: '17:50',
    line1: 'Salle République · 25 min à pied',
    line2: SOLEIL,
    primaryLabel: CRENEAU_PHRASES.goButton,
    secondaryLabel: '18:05 · RÉPUBLIQUE',
  },
  {
    id: 'changer_salle',
    heroSrc: hero02,
    eyebrow: 'Changer de salle',
    giant: 'La gare',
    line1: '15 min à pied',
    line2: null,
    primaryLabel: 'Garder cette salle',
    secondaryLabel: 'Salle République',
  },
  {
    id: 'le_soir',
    heroSrc: hero03,
    eyebrow: 'Le soir',
    giant: 'Salle',
    line1: 'On te propose la salle, plutôt que dehors.',
    line2: null,
    primaryLabel: "C'est bon",
    secondaryLabel: 'Marcher le soir',
  },
  {
    id: 'pas_energie',
    heroSrc: hero04,
    eyebrow: "Pas d'énergie aujourd'hui ?",
    giant: 'Demain',
    line1: 'On garde un créneau doux, ou on décale.',
    line2: null,
    primaryLabel: 'Décaler à demain',
    secondaryLabel: 'Séance douce',
  },
  {
    id: 'empty',
    heroSrc: hero06,
    eyebrow: 'Ce soir',
    giant: '—',
    line1: 'Aucun créneau pour l’instant.',
    line2: CRENEAU_PHRASES.minorEveningHelp,
    primaryLabel: 'Changer de salle',
    secondaryLabel: null,
  },
  {
    id: 'depart_depasse',
    heroSrc: hero05,
    eyebrow: formatDepartedHeadline('17:15'),
    giant: '17:30',
    line1: SALLE,
    line2: SOLEIL,
    primaryLabel: CRENEAU_PHRASES.goButton,
    secondaryLabel: CRENEAU_PHRASES.otherTime,
  },
  {
    id: 'principal',
    heroSrc: hero06,
    eyebrow: 'Pars à',
    giant: '17:15',
    line1: SALLE,
    line2: SOLEIL,
    primaryLabel: CRENEAU_PHRASES.goButton,
    secondaryLabel: CRENEAU_PHRASES.otherTime,
  },
  {
    id: 'mineur',
    heroSrc: hero07,
    eyebrow: 'Pars à',
    giant: '17:30',
    line1: 'Salle de la gare · 20 min à pied',
    line2: CRENEAU_PHRASES.minorHeroLine,
    primaryLabel: CRENEAU_PHRASES.goButton,
    secondaryLabel: CRENEAU_PHRASES.otherTime,
  },
]

function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="mx-auto w-[390px] shrink-0" data-creneau-v9-phone={label}>
      <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-[#ACB4BA]">
        {label}
      </p>
      <div
        className="relative h-[844px] overflow-hidden rounded-[28px] border border-white/10"
        style={{ background: CRENEAU_V9_BG }}
      >
        {children}
      </div>
    </div>
  )
}

function Screen({ s }: { s: StateDef }) {
  return (
    <CreneauV9Screen
      stateId={s.id}
      heroSrc={s.heroSrc}
      eyebrow={s.eyebrow}
      giant={s.giant}
      line1={s.line1}
      line2={s.line2}
      primaryLabel={s.primaryLabel}
      onPrimary={() => undefined}
      secondaryLabel={s.secondaryLabel}
      onSecondary={s.secondaryLabel ? () => undefined : undefined}
      onBack={() => undefined}
    />
  )
}

export function CreneauV9Fixture() {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const only = params?.get('state')
  const list = only ? STATES.filter((s) => s.id === only) : STATES

  return (
    <div
      className="min-h-[100dvh] overflow-auto px-4 py-6"
      style={{ background: '#0a0a0b' }}
      data-creneau-v9-fixture="1"
    >
      <div className={`flex ${only ? 'justify-center' : 'flex-wrap justify-center gap-6'}`}>
        {list.map((s) => (
          <PhoneFrame key={s.id} label={s.id}>
            <Screen s={s} />
          </PhoneFrame>
        ))}
      </div>
    </div>
  )
}
