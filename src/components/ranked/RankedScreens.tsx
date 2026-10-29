import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, Trophy, BookOpen, Flame, Users, Info, Pause } from 'lucide-react'
import {
  confirmRankedVerifySelf,
  fetchFriendsLeaderboard,
  fetchMyLeague,
  fetchMyRankedStatus,
  fetchPublicRankedMethod,
  listMyRankedLifts,
  listMyVerifiedPrs,
  RANKED_FORCE_LABELS,
  requestRankedVerify,
  setRankedInjuryPause,
  setRankedOptIn,
  submitRankedLift,
  type RankedForceExerciseId,
} from '../../services/rankedService'

export type RankedRoute =
  | 'hub'
  | 'optin'
  | 'method'
  | 'carnet'
  | 'force'
  | 'discipline'
  | 'friends'

interface RankedScreensProps {
  onBack: () => void
  initialRoute?: RankedRoute
}

const FORCE_IDS = Object.keys(RANKED_FORCE_LABELS) as RankedForceExerciseId[]

function ScreenShell({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <section className="ios-fade-up space-y-4 pb-10" data-testid="ranked-screen">
      <button
        type="button"
        onClick={onBack}
        className="ios-press inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] font-semibold text-[#ACB4BA]"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour
      </button>
      <h1 className="text-[26px] font-bold tracking-tight text-white">{title}</h1>
      {children}
    </section>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'ok' | 'warn' | 'muted' | 'bad'
}) {
  const colors =
    tone === 'ok'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
        : tone === 'bad'
          ? 'border-red-500/40 bg-red-500/15 text-red-200'
          : 'border-white/15 bg-white/5 text-[#ACB4BA]'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${colors}`}>
      {label}
    </span>
  )
}

function RankedOptInScreen({
  onBack,
  onDone,
}: {
  onBack: () => void
  onDone: () => void
}) {
  const [force, setForce] = useState(true)
  const [discipline, setDiscipline] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (enable: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const result = await setRankedOptIn({
        forceEnabled: enable ? force : false,
        disciplineEnabled: enable ? discipline : false,
      })
      if (!result.ok) {
        const map: Record<string, string> = {
          RANKED_REFUSED_MINOR: 'Ranked compétitif réservé aux 18 ans et plus.',
          RANKED_REFUSED_AGE_UNKNOWN: 'Indique ton âge dans ton profil pour rejoindre Ranked.',
          RANKED_REFUSED_PREGNANCY: 'Pas de Ranked compétitif pendant la grossesse.',
          RANKED_REFUSED_BREASTFEEDING: 'Pas de Ranked compétitif pendant l’allaitement.',
        }
        setError(map[result.error] ?? result.error)
        return
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenShell title="Opt-in Ranked" onBack={onBack}>
      <p className="text-[14px] leading-relaxed text-[#C7C7CC]">
        Ranked Force et Ranked Discipline sont compétitifs, opt-in, 18+ uniquement. Aucun poids
        corporel demandé. Jamais de pay-to-win sur le rang.
      </p>
      <label className="flex items-center gap-3 text-[14px] text-white">
        <input
          type="checkbox"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
          data-testid="ranked-optin-force"
        />
        Ranked Force (PR Vérifiés)
      </label>
      <label className="flex items-center gap-3 text-[14px] text-white">
        <input
          type="checkbox"
          checked={discipline}
          onChange={(e) => setDiscipline(e.target.checked)}
          data-testid="ranked-optin-discipline"
        />
        Ranked Discipline (séances / streak)
      </label>
      {error ? (
        <p className="text-[13px] text-[#FF9F0A]" data-testid="ranked-optin-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || (!force && !discipline)}
          onClick={() => void submit(true)}
          className="ios-press rounded-2xl bg-[#FF0702] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
          data-testid="ranked-optin-submit"
        >
          Rejoindre Ranked
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
          className="ios-press rounded-2xl border border-white/15 px-4 py-3 text-[14px] font-semibold text-[#ACB4BA]"
        >
          Se désinscrire (opt-out)
        </button>
      </div>
    </ScreenShell>
  )
}

function RankedMethodScreen({ onBack }: { onBack: () => void }) {
  const [method, setMethod] = useState<any>(null)

  useEffect(() => {
    void fetchPublicRankedMethod().then(setMethod)
  }, [])

  return (
    <ScreenShell title="Comment marche ton rang" onBack={onBack}>
      <p className="text-[13px] text-[#717C83]">
        Barème public (CA5) — accessible sans payer. Cosmétique Bronze→Légende = XP, à part.
      </p>
      {!method ? (
        <p className="text-[13px] text-[#ACB4BA]">Chargement…</p>
      ) : (
        <div className="space-y-4 text-[14px] leading-relaxed text-[#C7C7CC]">
          <div>
            <h2 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-white">
              Ranked Force — 5 mouvements
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              {FORCE_IDS.map((id) => (
                <li key={id}>{RANKED_FORCE_LABELS[id]}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-white">
              1RM (Epley)
            </h2>
            <p>
              {method.epley.formula} · reps 1–10 · au-delà = carnet seulement. Affiché «{' '}
              {method.epley.label} ».
            </p>
          </div>
          <div>
            <h2 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-white">
              Anti-triche
            </h2>
            <p>
              Plafonds squat/bench/deadlift · row ≤ deadlift Vérifié · OHP ≤ bench Vérifié ·
              anomalies 15 % / 25 % (≤7 j). Badge Vérifié obligatoire pour Force.
            </p>
          </div>
          <div>
            <h2 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-white">
              Ranked Discipline
            </h2>
            <p>
              Séances / 7 j plafonnées à {method.discipline.sessionsCapPer7d} pts · streak =
              semaines ≥ {method.discipline.streakMinSessionsPerWeek} séances · pause blessure.
            </p>
          </div>
          <div>
            <h2 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-white">
              Ligues + soft reset
            </h2>
            <p>
              Cycles 6–8 semaines · re-placement partiel · les PR Vérifiés du carnet ne sont
              jamais effacés.
            </p>
          </div>
          <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-[#ACB4BA]">
            Classement salle = P0-bis (hors premier livrable). Amis = P0.
          </p>
        </div>
      )}
    </ScreenShell>
  )
}

function RankedCarnetScreen({ onBack }: { onBack: () => void }) {
  const [lifts, setLifts] = useState<any[]>([])
  const [exerciseId, setExerciseId] = useState<RankedForceExerciseId>('squat')
  const [weightKg, setWeightKg] = useState('100')
  const [reps, setReps] = useState('5')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    void listMyRankedLifts().then((rows) => setLifts(rows as any[]))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await submitRankedLift({
        canonicalExerciseId: exerciseId,
        weightKg: Number(weightKg),
        reps: Number(reps),
      })
      if (!result.ok) {
        setMessage(String(result.error))
        return
      }
      setMessage(
        `Statut ${result.status}${
          result.estimated1RmKg != null ? ` · ${result.label ?? '1RM'} ${result.estimated1RmKg.toFixed(1)} kg` : ''
        }`,
      )
      reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenShell title="Carnet / PR" onBack={onBack}>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
        <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#717C83]">
          Mouvement
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-[14px] text-white"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value as RankedForceExerciseId)}
            data-testid="ranked-lift-exercise"
          >
            {FORCE_IDS.map((id) => (
              <option key={id} value={id}>
                {RANKED_FORCE_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#717C83]">
            Charge (kg)
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-[14px] text-white"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              inputMode="decimal"
              data-testid="ranked-lift-weight"
            />
          </label>
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#717C83]">
            Reps
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-[14px] text-white"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              data-testid="ranked-lift-reps"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="ios-press w-full rounded-2xl bg-[#FF0702] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
          data-testid="ranked-lift-submit"
        >
          Enregistrer
        </button>
        {message ? <p className="text-[13px] text-[#ACB4BA]">{message}</p> : null}
      </div>

      <ul className="space-y-2">
        {lifts.map((lift) => (
          <li
            key={lift.id}
            className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3"
            data-testid="ranked-lift-row"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold text-white">
                  {RANKED_FORCE_LABELS[lift.canonicalExerciseId as RankedForceExerciseId] ??
                    lift.canonicalExerciseId}
                </p>
                <p className="text-[12px] text-[#ACB4BA]">
                  {lift.weightKg} kg × {lift.reps}
                  {lift.estimated1RmKg != null
                    ? ` · 1RM estimé ${Number(lift.estimated1RmKg).toFixed(1)} kg`
                    : ''}
                </p>
              </div>
              <StatusPill
                label={
                  lift.status === 'verified'
                    ? 'Vérifié'
                    : lift.status === 'pending_verify'
                      ? 'En attente'
                      : lift.status === 'rejected_force'
                        ? 'Refus Force'
                        : 'Déclaré'
                }
                tone={
                  lift.status === 'verified'
                    ? 'ok'
                    : lift.status === 'pending_verify'
                      ? 'warn'
                      : lift.status === 'rejected_force'
                        ? 'bad'
                        : 'muted'
                }
              />
            </div>
            {lift.status === 'pending_verify' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/15 px-3 py-1.5 text-[12px] text-white"
                  onClick={() =>
                    void requestRankedVerify({ liftLogId: lift.id, method: 'self_24h' }).then(
                      () => setMessage('Demande self 24h créée — confirme après 24 h.'),
                    )
                  }
                >
                  Double conf. 24 h
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/15 px-3 py-1.5 text-[12px] text-white"
                  onClick={() =>
                    void confirmRankedVerifySelf(lift.id).then((r) => {
                      setMessage(r.ok ? 'Vérifié' : String((r as any).error))
                      reload()
                    })
                  }
                >
                  Confirmer (self)
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </ScreenShell>
  )
}

function RankedForceScreen({ onBack }: { onBack: () => void }) {
  const [league, setLeague] = useState<any>(null)
  const [prs, setPrs] = useState<any[]>([])

  useEffect(() => {
    void fetchMyLeague().then(setLeague)
    void listMyVerifiedPrs().then((rows) => setPrs(rows as any[]))
  }, [])

  return (
    <ScreenShell title="Ranked Force" onBack={onBack}>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-[12px] uppercase tracking-wide text-[#717C83]">Score cycle</p>
        <p className="text-[36px] font-bold text-white" data-testid="ranked-force-score">
          {league?.score ?? 0}
        </p>
        <p className="text-[14px] text-[#ACB4BA]">
          Ligue {league?.league?.name ?? '—'}
          {league?.approximateRank != null ? ` · rang ~${league.approximateRank}` : ''}
        </p>
      </div>
      <div className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">
          Breakdown (pondération égale)
        </h2>
        {prs.map((pr) => (
          <div
            key={pr.canonicalExerciseId}
            className="flex items-center justify-between border-b border-white/5 py-2 text-[14px]"
          >
            <span className="text-[#C7C7CC]">
              {RANKED_FORCE_LABELS[pr.canonicalExerciseId as RankedForceExerciseId]}
            </span>
            <span className="font-semibold text-white">
              {pr.estimated1RmKg != null ? `${Number(pr.estimated1RmKg).toFixed(1)} kg` : '—'}
              {pr.verifiedAt ? (
                <StatusPill label="Vérifié" tone="ok" />
              ) : (
                <span className="ml-2">
                  <StatusPill label="Hors Force" tone="muted" />
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[#717C83]">Aucun poids corporel affiché.</p>
    </ScreenShell>
  )
}

function RankedDisciplineScreen({
  onBack,
  status,
  onRefresh,
}: {
  onBack: () => void
  status: any
  onRefresh: () => void
}) {
  const disc = status?.discipline
  const pauseUntil = status?.optIn?.pauseInjuryUntil as number | null | undefined
  const isPaused = typeof pauseUntil === 'number' && pauseUntil > 0

  return (
    <ScreenShell title="Ranked Discipline" onBack={onBack}>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[11px] uppercase text-[#717C83]">Séances /7j</p>
          <p className="text-[24px] font-bold text-white" data-testid="ranked-disc-sessions">
            {disc?.sessionsLast7d ?? 0}
            <span className="text-[12px] font-medium text-[#717C83]">/5</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[11px] uppercase text-[#717C83]">Streak</p>
          <p className="text-[24px] font-bold text-white">{disc?.streakWeeks ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[11px] uppercase text-[#717C83]">Score</p>
          <p className="text-[24px] font-bold text-white">{disc?.score ?? 0}</p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-[#ACB4BA]">
        Le repos fait partie de la progression. La 6ᵉ séance / 7 jours n’ajoute aucun point Ranked.
        Douleur ou blessure → arrête et vois un pro.
      </p>
      <button
        type="button"
        className="ios-press inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-[14px] font-semibold text-white"
        onClick={() => {
          if (isPaused) {
            void setRankedInjuryPause(null).then(onRefresh)
            return
          }
          const until = Date.now() + 7 * 24 * 60 * 60 * 1000
          void setRankedInjuryPause(until).then(onRefresh)
        }}
      >
        <Pause className="h-4 w-4" />
        {isPaused ? 'Lever la pause blessure' : 'Pause blessure / maladie (7 j)'}
      </button>
    </ScreenShell>
  )
}

function RankedFriendsScreen({ onBack }: { onBack: () => void }) {
  const [axis, setAxis] = useState<'force' | 'discipline'>('force')
  const [board, setBoard] = useState<any>(null)

  useEffect(() => {
    void fetchFriendsLeaderboard(axis).then(setBoard)
  }, [axis])

  return (
    <ScreenShell title="Classement amis" onBack={onBack}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAxis('force')}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
            axis === 'force' ? 'bg-[#FF0702] text-white' : 'border border-white/15 text-[#ACB4BA]'
          }`}
        >
          Force
        </button>
        <button
          type="button"
          onClick={() => setAxis('discipline')}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
            axis === 'discipline'
              ? 'bg-[#FF0702] text-white'
              : 'border border-white/15 text-[#ACB4BA]'
          }`}
        >
          Discipline
        </button>
      </div>
      <ul className="space-y-2" data-testid="ranked-friends-board">
        {(board?.entries ?? []).map((entry: any, index: number) => (
          <li
            key={entry.userId}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-[13px] font-bold text-[#717C83]">{index + 1}</span>
              {entry.avatarUrl ? (
                <img
                  src={entry.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[12px] text-white">
                  {(entry.pseudo as string).slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-[14px] font-semibold text-white">
                {entry.pseudo}
                {entry.isSelf ? ' (toi)' : ''}
              </span>
            </div>
            <span className="text-[14px] font-bold text-white">{entry.score}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-[#717C83]">
        Pseudo + avatar seulement. Classement salle = P0-bis (hors scope).
      </p>
    </ScreenShell>
  )
}

export function RankedScreens({ onBack, initialRoute = 'hub' }: RankedScreensProps) {
  const [route, setRoute] = useState<RankedRoute>(initialRoute)
  const [status, setStatus] = useState<any>(null)

  const refresh = useCallback(() => {
    void fetchMyRankedStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (route === 'optin') {
    return (
      <RankedOptInScreen
        onBack={() => setRoute('hub')}
        onDone={() => {
          refresh()
          setRoute('hub')
        }}
      />
    )
  }
  if (route === 'method') return <RankedMethodScreen onBack={() => setRoute('hub')} />
  if (route === 'carnet') return <RankedCarnetScreen onBack={() => setRoute('hub')} />
  if (route === 'force') return <RankedForceScreen onBack={() => setRoute('hub')} />
  if (route === 'discipline') {
    return (
      <RankedDisciplineScreen
        onBack={() => setRoute('hub')}
        status={status}
        onRefresh={refresh}
      />
    )
  }
  if (route === 'friends') return <RankedFriendsScreen onBack={() => setRoute('hub')} />

  const opted =
    status?.optIn &&
    (status.optIn.forceEnabled || status.optIn.disciplineEnabled) &&
    !status.optIn.optedOutAt

  const tiles: { id: RankedRoute; label: string; icon: typeof Trophy; hint: string }[] = [
    { id: 'optin', label: 'Opt-in Ranked', icon: Trophy, hint: '18+ · Force / Discipline' },
    { id: 'method', label: 'Comment marche ton rang', icon: Info, hint: 'Barème public' },
    { id: 'carnet', label: 'Carnet / PR', icon: BookOpen, hint: 'Déclaré · Vérifié' },
    { id: 'force', label: 'Ranked Force', icon: Flame, hint: 'Score · ligue' },
    { id: 'discipline', label: 'Ranked Discipline', icon: Flame, hint: 'Séances · streak' },
    { id: 'friends', label: 'Classement amis', icon: Users, hint: 'Pseudo + avatar' },
  ]

  return (
    <ScreenShell title="Ranked" onBack={onBack}>
      <p className="text-[14px] leading-relaxed text-[#C7C7CC]">
        Compétitif à côté du rang cosmétique Bronze→Légende (XP). Entrée dédiée — l’Accueil
        cosmétique n’est pas modifié.
      </p>
      <div className="flex flex-wrap gap-2">
        {opted ? <StatusPill label="Opt-in actif" tone="ok" /> : <StatusPill label="Pas opt-in" tone="muted" />}
        {status?.eligible === false ? (
          <StatusPill label={String(status.eligibilityError)} tone="bad" />
        ) : null}
      </div>
      <div className="space-y-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setRoute(tile.id)}
              className="ios-press flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left"
              data-testid={`ranked-nav-${tile.id}`}
            >
              <Icon className="h-5 w-5 text-[#FF0702]" />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-white">{tile.label}</span>
                <span className="block text-[12px] text-[#717C83]">{tile.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </ScreenShell>
  )
}
