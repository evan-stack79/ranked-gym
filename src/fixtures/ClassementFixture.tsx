import { useMemo, useState, type ReactNode } from 'react'
import { Home, Dumbbell, Play, Utensils, User } from 'lucide-react'
import { GymLeaderboardEntryCard } from '../components/classement/GymLeaderboardEntryCard'
import { GymLeaderboardScreen } from '../components/classement/GymLeaderboardScreen'
import { GymRulesJoinScreen } from '../components/classement/GymRulesJoinScreen'
import { GymManualAddScreen } from '../components/classement/GymManualAddScreen'
import { GymLocationConsentSheet } from '../components/classement/GymLocationConsentSheet'
import type { LeaderboardRow } from '../components/classement/GymLeaderboardList'
import { TrainWeekStrip } from '../components/training/TrainWeekStrip'
import type { WeekDayCell } from '../utils/trainHub'

/**
 * Route `/classement-fixture` — fake data for iPhone 17 captures.
 * Enable with VITE_ENABLE_GYM_LEADERBOARD=true (fixture route also forces UI).
 *
 * Scenes via `?scene=` :
 * - podium (default) — Mois + shared places
 * - position — location consent sheet over Train-ish bg
 * - regles — rules + pseudo
 * - ajout_manuel — manual gym add
 * - train_carte — Train card only
 */
type Scene = 'podium' | 'position' | 'regles' | 'ajout_manuel' | 'train_carte'

function readScene(): Scene {
  if (typeof window === 'undefined') return 'podium'
  const s = new URLSearchParams(window.location.search).get('scene')
  if (
    s === 'position' ||
    s === 'regles' ||
    s === 'ajout_manuel' ||
    s === 'train_carte' ||
    s === 'podium'
  ) {
    return s
  }
  return 'podium'
}

const GYM_LABEL = 'Salle Exemple – Tergnier'

function fakeRows(): LeaderboardRow[] {
  const mk = (
    rank: number,
    points: number,
    people: Array<{ id: string; pseudo: string; me?: boolean }>,
  ): LeaderboardRow[] =>
    people.map((p) => ({
      userId: p.id,
      pseudo: p.pseudo,
      points,
      rank,
      isMe: Boolean(p.me),
    }))

  return [
    ...mk(1, 8, [
      { id: 'i', pseudo: 'Iris' },
      { id: 't', pseudo: 'Tom' },
      { id: 'z', pseudo: 'Zoé' },
      { id: 'a', pseudo: 'Alex' },
      { id: 'b', pseudo: 'Benoit' },
      { id: 'c', pseudo: 'Clara' },
      { id: 'd', pseudo: 'Diego' },
      { id: 'e', pseudo: 'Eva' },
      { id: 'f', pseudo: 'Farah' },
      { id: 'g', pseudo: 'Gus' },
      { id: 'h', pseudo: 'Hana' },
      { id: 'j', pseudo: 'Jules' },
    ]),
    ...mk(2, 7, [
      { id: 'k', pseudo: 'Karim' },
      { id: 'm', pseudo: 'Maya' },
      { id: 'y', pseudo: 'Yann' },
    ]),
    ...mk(3, 6, [
      { id: 'r', pseudo: 'Romy' },
      { id: 'c2', pseudo: 'Camille' },
    ]),
    ...mk(4, 5, [
      { id: 'lucie', pseudo: 'Lucie.run' },
      { id: 'nathan', pseudo: 'Nathan_88' },
    ]),
    ...mk(5, 4, [
      { id: 'me', pseudo: 'Toi', me: true },
      { id: 'sami', pseudo: 'Sami' },
    ]),
  ]
}

function fakeWeekStrip(): WeekDayCell[] {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const
  // Weekday = 0..6 (Sun..Sat) — strip starts Monday (1)
  const weekdays = [1, 2, 3, 4, 5, 6, 0] as const
  return labels.map((shortLabel, i) => ({
    dateKey: `2026-10-${String(5 + i).padStart(2, '0')}`,
    weekday: weekdays[i]!,
    shortLabel,
    dayNumber: 5 + i,
    isToday: i === 0,
    hasSession: i === 0,
    accessibleLabel: `${shortLabel} ${5 + i}`,
  }))
}

function FakeBottomNav() {
  return (
    <nav
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-hidden="true"
      data-bottom-nav-host
    >
      <div className="flex items-end gap-5 rounded-full border border-white/10 bg-[#141416]/95 px-5 py-2.5">
        <Home className="h-5 w-5 text-[#636366]" />
        <Dumbbell className="h-5 w-5 text-[#FF2B2B]" />
        <span className="relative -mt-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2B2B] shadow-[0_0_24px_rgba(255,43,43,0.45)]">
          <Play className="h-6 w-6 fill-white text-white" />
        </span>
        <Utensils className="h-5 w-5 text-[#636366]" />
        <User className="h-5 w-5 text-[#636366]" />
      </div>
    </nav>
  )
}

function TrainBackground({ children }: { children?: ReactNode }) {
  const days = useMemo(() => fakeWeekStrip(), [])
  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col bg-[#0C0C0E] font-sans text-white">
      <main
        className="min-h-0 flex-1 overflow-y-auto px-5 py-8"
        data-app-scroll-main
        style={{
          paddingBottom:
            'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        <h1 className="text-[34px] font-bold tracking-tight">Train</h1>
        <div className="mt-4">
          <TrainWeekStrip days={days} />
        </div>
        <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#141416] p-4">
          <h2 className="text-[22px] font-bold">Haut du corps</h2>
          <p className="mt-1 text-[13px] text-[#AEAEB2]">5 exercices</p>
          <button
            type="button"
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#FF2B2B] text-[16px] font-semibold"
          >
            Commencer
          </button>
        </section>
        <div className="mt-4">
          <GymLeaderboardEntryCard gymLabel={GYM_LABEL} onOpen={() => undefined} />
        </div>
        {children}
      </main>
      <FakeBottomNav />
    </div>
  )
}

export function ClassementFixture() {
  const scene = readScene()
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [pseudo, setPseudo] = useState('')
  const [name, setName] = useState(scene === 'ajout_manuel' ? 'Salle Exemple' : '')
  const [city, setCity] = useState(scene === 'ajout_manuel' ? 'Tergnier' : '')
  const rows = useMemo(() => fakeRows(), [])

  if (scene === 'train_carte') {
    return (
      <div data-classement-fixture="train_carte" data-harness-ready="1">
        <TrainBackground />
      </div>
    )
  }

  if (scene === 'position') {
    return (
      <div data-classement-fixture="position" data-harness-ready="1" className="relative">
        <TrainBackground />
        <GymLocationConsentSheet
          open
          showMockupBadge
          onAccept={() => undefined}
          onDecline={() => undefined}
        />
      </div>
    )
  }

  if (scene === 'regles') {
    return (
      <div
        data-classement-fixture="regles"
        data-harness-ready="1"
        className="relative flex h-[100dvh] flex-col"
      >
        <GymRulesJoinScreen
          gymLabel={GYM_LABEL}
          pseudo={pseudo}
          onPseudoChange={setPseudo}
          onJoin={() => undefined}
          onLater={() => undefined}
          showMockupBadge
        />
        <FakeBottomNav />
      </div>
    )
  }

  if (scene === 'ajout_manuel') {
    return (
      <div
        data-classement-fixture="ajout_manuel"
        data-harness-ready="1"
        className="relative flex h-[100dvh] flex-col"
      >
        <GymManualAddScreen
          name={name}
          city={city}
          onNameChange={setName}
          onCityChange={setCity}
          onSubmit={() => undefined}
        />
        <FakeBottomNav />
      </div>
    )
  }

  return (
    <div
      data-classement-fixture="podium"
      data-harness-ready="1"
      className="relative flex h-[100dvh] flex-col"
    >
      <GymLeaderboardScreen
        gymLabel={GYM_LABEL}
        showGoogleAttribution
        period={period}
        onPeriodChange={setPeriod}
        rows={rows}
        rankingVisible
        memberCount={20}
        locationConsentKnown
        locationConsent
        onRequestAtGym={() => undefined}
        onConsentAccept={() => undefined}
        onConsentDecline={() => undefined}
        showMockupBadge
      />
      <FakeBottomNav />
    </div>
  )
}
