import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CRENEAU_PHRASES,
  CRENEAU_RED,
  type CreneauCrowdLevel,
} from '../../../creneau/constants'
import {
  activationPhrase,
  addMinutes,
  formatDelayMessage,
  formatDeparturePassedWithNew,
  isCreneauMinor,
  parseHm,
  proposeCreneau,
  summarizeCrowd,
  type ProposedSlot,
} from '../../../creneau/engine'
import { useAuth } from '../../../context/AuthContext'
import { getCalorieProfile } from '../../../services/nutritionStorage'
import {
  CRENEAU_CHANGED_EVENT,
  ensureDefaultGyms,
  getCreneauSettings,
  recordCrowdTap,
  saveCreneauSettings,
  type CreneauSettings,
} from '../../../services/creneau/storage'
import { resolveDisplayFirstName } from '../../../utils/homeGreeting'
import { CreneauLottie } from './CreneauLottie'
import heroPhoto from '../../../assets/photos/creneau/shadow-boxing-pavel-danilyuk.jpg'

type Pane =
  | 'home'
  | 'confirmed'
  | 'gyms'
  | 'evening'
  | 'other'
  | 'delay'
  | 'energy'
  | 'checkin'
  | 'delayResult'
  | 'energyResult'
  | 'details'

function nowHm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function gymArgs(g: NonNullable<CreneauSettings['favorite']>) {
  return {
    id: g.id,
    name: g.name,
    staffFromHm: g.staffFromHm,
    staffUntilHm: g.staffUntilHm,
    closesHm: g.closesHm,
    travelMin: g.travelFromWorkMin,
    latitude: g.latitude,
    longitude: g.longitude,
    cityKnown: g.latitude != null && g.longitude != null,
  }
}

function salleLine(slot: ProposedSlot): string {
  return `${slot.gymName} · ${slot.trajetLabel}`
}

export function CreneauFlow({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [pane, setPane] = useState<Pane>('home')
  const [settings, setSettings] = useState<CreneauSettings>(() => ensureDefaultGyms())
  const [clockHm, setClockHm] = useState(nowHm)
  const [delayMin, setDelayMin] = useState(0)
  const [soft, setSoft] = useState(false)
  const [delayResult, setDelayResult] = useState('')
  const [energyResult, setEnergyResult] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const [activeSlot, setActiveSlot] = useState<ProposedSlot | null>(null)
  const [showCrowdPick, setShowCrowdPick] = useState(false)

  const age = getCalorieProfile().age ?? null
  const minor = isCreneauMinor(age)

  const displayName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: user?.displayName,
  })
  // CA-C6: vrai prénom ou rien — jamais « toi » / « Champion » sur cet écran
  const greetName =
    displayName && displayName !== 'Champion' ? displayName : null

  useEffect(() => {
    const sync = () => setSettings(getCreneauSettings())
    window.addEventListener(CRENEAU_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CRENEAU_CHANGED_EVENT, sync)
  }, [])

  // CA-C2: refresh clock so a stale departure never stays on screen
  useEffect(() => {
    const id = window.setInterval(() => setClockHm(nowHm()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const proposal = useMemo(() => {
    const fav = settings.favorite
    const bak = settings.backup
    return proposeCreneau({
      age,
      nowHm: clockHm,
      heatVigilance: settings.heatVigilanceToday,
      eveningWalkEnabled: settings.eveningWalkEnabled,
      stafflessGymEnabled: settings.stafflessGymEnabled,
      preferQuiet: settings.preferQuiet,
      softSession: soft,
      delayMin,
      trajetMode: settings.trajetMode,
      favorite: fav ? gymArgs(fav) : null,
      backup: bak ? gymArgs(bak) : null,
      lockerMin: settings.lockerMin,
      nowDate: new Date(),
    })
  }, [age, settings, delayMin, soft, clockHm])

  const primary = activeSlot ?? proposal.primary
  const planB = proposal.planB
  const soleilPhrase = proposal.soleilPhrase

  const crowd = useMemo(() => {
    const id = primary?.gymId
    if (!id) return null
    return summarizeCrowd(settings.crowdReports, id, Date.now())
  }, [primary?.gymId, settings.crowdReports])

  const planBCrowd = useMemo(() => {
    const id = planB?.gymId
    if (!id) return null
    return summarizeCrowd(settings.crowdReports, id, Date.now())
  }, [planB?.gymId, settings.crowdReports])

  const patch = useCallback((p: Partial<CreneauSettings>) => {
    setSettings(saveCreneauSettings(p))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  const departurePassed = useMemo(() => {
    if (!primary || committed) return false
    const dep = parseHm(primary.departureHm)
    const now = parseHm(clockHm)
    if (dep == null || now == null) return false
    return now > dep
  }, [primary, clockHm, committed])

  const heroTitle = useMemo(() => {
    if (!primary) return '—'
    if (pane === 'confirmed' || committed) {
      return `${CRENEAU_PHRASES.notedPrefix} ${primary.departureHm}`
    }
    if (pane === 'checkin') {
      return `Séance ${primary.sessionStartHm}`
    }
    if (pane === 'energyResult') {
      return energyResult.includes('demain') || energyResult.includes('Demain')
        ? 'DEMAIN'
        : 'OK, ON VOIT ÇA'
    }
    if (departurePassed) {
      // Propose +15 as new departure display
      const next = addMinutes(primary.departureHm, 15) ?? primary.departureHm
      return next
    }
    return `Pars à ${primary.departureHm}`
  }, [primary, pane, committed, departurePassed, energyResult])

  const heroPassedLine = departurePassed && primary && !committed
    ? formatDeparturePassedWithNew(primary.departureHm)
    : null

  const line1 = primary ? salleLine(primary) : null
  const line2 = minor
    ? CRENEAU_PHRASES.minorHeroLine
    : soleilPhrase

  const bigButtonLabel = (() => {
    if (pane === 'confirmed' || (committed && pane === 'home')) {
      return CRENEAU_PHRASES.warnSomeone
    }
    if (pane === 'checkin') return CRENEAU_PHRASES.imHereButton
    if (pane === 'energyResult') return CRENEAU_PHRASES.backToPlan
    return CRENEAU_PHRASES.goButton
  })()

  const onBigButton = () => {
    if (!primary) return
    if (pane === 'energyResult') {
      setPane('home')
      setSoft(false)
      setEnergyResult('')
      return
    }
    if (pane === 'checkin') {
      setShowCrowdPick(true)
      return
    }
    if (pane === 'confirmed' || committed) {
      void shareArrival(primary)
      return
    }
    setCommitted(true)
    setActiveSlot(primary)
    setPane('confirmed')
  }

  const shareArrival = async (slot: ProposedSlot) => {
    const text = `J’arrive vers ${slot.returnHm} · ${slot.gymName}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        showToast('Message prêt — colle-le pour envoyer.')
      }
    } catch {
      /* user cancelled share — nothing sent */
    }
  }

  const swapToPlanB = () => {
    if (!planB) {
      showToast('Pas d’autre créneau pour l’instant.')
      return
    }
    setActiveSlot(planB)
    setCommitted(false)
    setPane('home')
    setDelayMin(0)
  }

  const renderHero = (opts: {
    title: string
    passedPrefix?: string | null
    button: string
    onButton: () => void
    lineA?: string | null
    lineB?: string | null
    showOtherTime?: boolean
    showCancel?: boolean
  }) => (
    <div
      className="relative flex min-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-[28px] bg-black"
      data-creneau-hero
    >
      {/* Photo + red trail ~55% */}
      <div className="relative h-[55%] min-h-[240px] w-full shrink-0 overflow-hidden">
        <img
          src={heroPhoto}
          alt=""
          className="h-full w-full object-cover object-[center_20%]"
          draggable={false}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 20%, ${CRENEAU_RED}55 55%, #000 100%)`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-8 top-[30%] h-[70%] w-[70%] rounded-full opacity-80 blur-3xl"
          style={{ background: CRENEAU_RED }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => {
            if (pane === 'home' || pane === 'confirmed') onBack()
            else setPane('home')
          }}
          className="ios-press absolute left-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/40 text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 -mt-8 flex flex-1 flex-col px-5 pb-[calc(var(--app-bottom-nav,64px)+env(safe-area-inset-bottom,0px)+20px)] pt-2">
        {greetName && pane === 'home' && !committed ? (
          <p className="mb-1 text-[13px] text-[#ACB4BA]" data-creneau-salut>
            Salut {greetName}
          </p>
        ) : null}

        {opts.passedPrefix ? (
          <p
            className="text-[15px] font-semibold uppercase tracking-wide text-white/90"
            data-creneau-passed
          >
            {opts.passedPrefix}
          </p>
        ) : null}

        <h1
          className="mt-1 text-[clamp(2.6rem,12vw,4.25rem)] font-black uppercase leading-[0.92] tracking-[-0.04em] text-white"
          style={{ fontStretch: 'condensed' }}
          data-creneau-giant-time
        >
          {opts.title}
        </h1>

        <div className="mt-3 space-y-1">
          {opts.lineA ? (
            <p className="text-[14px] text-[#ACB4BA]" data-creneau-line1>
              {opts.lineA}
            </p>
          ) : null}
          {opts.lineB ? (
            <p className="text-[14px] text-[#ACB4BA]" data-creneau-line2>
              {opts.lineB}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col items-stretch gap-3 pt-8">
          <button
            type="button"
            onClick={opts.onButton}
            className="ios-press w-full rounded-2xl py-[18px] text-center text-[18px] font-bold text-white"
            style={{ background: CRENEAU_RED }}
            data-creneau-primary-cta
          >
            {opts.button}
          </button>
          {opts.showOtherTime ? (
            <button
              type="button"
              onClick={() => setPane('other')}
              className="text-center text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:underline"
              data-creneau-autre-heure
            >
              {CRENEAU_PHRASES.otherTime}
            </button>
          ) : null}
          {opts.showCancel ? (
            <button
              type="button"
              onClick={() => {
                setCommitted(false)
                setActiveSlot(null)
                setPane('home')
              }}
              className="text-center text-[13px] font-medium text-[#ACB4BA]"
              data-creneau-annuler
            >
              Annuler
            </button>
          ) : null}
          {pane === 'home' && !committed ? (
            <div className="flex justify-center gap-6 pt-1">
              <button
                type="button"
                className="text-[12px] text-[#ACB4BA]"
                onClick={() => setPane('delay')}
                data-creneau-delay
              >
                Je suis en retard
              </button>
              <button
                type="button"
                className="text-[12px] text-[#ACB4BA]"
                onClick={() => setPane('energy')}
                data-creneau-energy
              >
                {CRENEAU_PHRASES.noSessionToday}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3" data-creneau-flow data-pane={pane}>
      {toast ? (
        <div
          className="rounded-2xl px-4 py-3 text-[14px] font-medium text-white"
          style={{ background: `${CRENEAU_RED}33`, border: `1px solid ${CRENEAU_RED}66` }}
          data-creneau-toast
        >
          {toast}
        </div>
      ) : null}

      {(pane === 'home' || pane === 'confirmed') && primary ? (
        renderHero({
          title: heroTitle,
          passedPrefix: pane === 'home' ? heroPassedLine : null,
          button: bigButtonLabel,
          onButton: onBigButton,
          lineA: line1,
          lineB: line2,
          // Minor: no « Autre heure » (README v5 / Vérificateur option B)
          showOtherTime: !minor && pane === 'home',
          showCancel: pane === 'confirmed',
        })
      ) : null}

      {pane === 'home' && !primary ? (
        <div className="rounded-3xl border border-white/10 bg-black p-5">
          <button
            type="button"
            onClick={onBack}
            className="ios-press mb-4 flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-[18px] font-bold text-white">Aucun créneau pour l’instant.</p>
          <p className="mt-2 text-[14px] text-[#ACB4BA]">
            Règle tes salles{minor ? '' : ' ou « Le soir »'}.
          </p>
          <button
            type="button"
            onClick={() => setPane('gyms')}
            className="ios-press mt-4 w-full rounded-2xl py-3 font-bold text-white"
            style={{ background: CRENEAU_RED }}
          >
            Changer de salle
          </button>
        </div>
      ) : null}

      {pane === 'checkin' && primary ? (
        <div className="flex flex-col gap-4" data-creneau-checkin>
          {renderHero({
            title: `Séance ${primary.sessionStartHm}`,
            button: showCrowdPick ? CRENEAU_PHRASES.onSiteAsk : CRENEAU_PHRASES.imHereButton,
            onButton: () => setShowCrowdPick(true),
            lineA: CRENEAU_PHRASES.onSiteThanks,
            lineB: null,
            showOtherTime: false,
          })}
          {showCrowdPick ? (
            <div className="grid grid-cols-3 gap-2 px-1" data-creneau-crowd-pick>
              {(
                [
                  ['calme', 'Calme'],
                  ['moyen', 'Moyen'],
                  ['charge', 'Chargé'],
                ] as [CreneauCrowdLevel, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="ios-press rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[14px] font-bold text-white"
                  onClick={() => {
                    setSettings(recordCrowdTap(primary.gymId!, id))
                    showToast(CRENEAU_PHRASES.onSiteThanks)
                    setShowCrowdPick(false)
                    setPane('home')
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="text-center text-[12px] text-[#ACB4BA]"
              onClick={() => setShowCrowdPick(true)}
            >
              Il y a du monde ?
            </button>
          )}
        </div>
      ) : null}

      {pane === 'other' ? (
        <div className="flex flex-col gap-3" data-creneau-other>
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('home')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[18px] font-bold text-white">Autre heure</h2>
          </header>
          {planB ? (
            <button
              type="button"
              onClick={swapToPlanB}
              className="ios-press flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
              data-creneau-planb
            >
              <span className="text-[11px] font-bold uppercase text-[#ACB4BA]">Sinon</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  {planB.sessionStartHm} · {planB.gymName}
                </span>
                <span className="text-[12px] text-[#ACB4BA]" data-creneau-planb-crowd>
                  {!planB.staffed
                    ? CRENEAU_PHRASES.stafflessAtHour
                    : planBCrowd?.level
                      ? `${planBCrowd.label} · ${planBCrowd.confidence === 'sur' ? planBCrowd.confidenceLabel : planBCrowd.confidenceLabel}`
                      : CRENEAU_PHRASES.noCrowdYet}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#ACB4BA]" />
            </button>
          ) : (
            <p className="text-[14px] text-[#ACB4BA]">Pas d’autre créneau pour l’instant.</p>
          )}
          <button
            type="button"
            onClick={() => setPane('gyms')}
            className="ios-press rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left font-semibold text-white"
          >
            Changer de salle
          </button>
          <button
            type="button"
            onClick={() => setPane('details')}
            className="text-[13px] text-[#ACB4BA]"
          >
            Détails du créneau
          </button>
        </div>
      ) : null}

      {pane === 'details' && primary ? (
        <div className="flex flex-col gap-3" data-creneau-details>
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('other')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[18px] font-bold text-white">Détails</h2>
          </header>
          <ul className="space-y-2 text-[14px] text-[#ACB4BA]">
            <li>Départ {primary.departureHm}</li>
            <li>Séance {primary.sessionStartHm} – {primary.sessionEndHm}</li>
            <li>Chez toi vers {primary.returnHm}</li>
            {!primary.staffed ? <li>{CRENEAU_PHRASES.stafflessAtHour}</li> : null}
            {crowd?.level ? (
              <li>
                {crowd.label}
                {crowd.confidence !== 'sur' ? ` · ${crowd.confidenceLabel}` : ''}
              </li>
            ) : (
              <li>{CRENEAU_PHRASES.noCrowdYet}</li>
            )}
            {soleilPhrase && !minor ? <li>{soleilPhrase}</li> : null}
          </ul>
        </div>
      ) : null}

      {pane === 'gyms' ? (
        <div className="flex flex-col gap-4">
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('home')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[18px] font-bold text-white">Changer de salle</h2>
          </header>
          <p className="text-[13px] text-[#ACB4BA]">1 salle favorite + 1 salle de secours</p>
          {(['favorite', 'backup'] as const).map((key) => {
            const g = settings[key]
            return (
              <div
                key={key}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                data-creneau-gym={key}
              >
                <p className="text-[12px] text-[#ACB4BA]">
                  {key === 'favorite' ? 'Salle favorite' : 'Salle de secours'}
                </p>
                <p className="mt-1 text-[18px] font-bold text-white">{g?.name ?? '—'}</p>
                {g ? (
                  <ul className="mt-3 space-y-1 text-[13px] text-[#ACB4BA]">
                    <li>{g.travelFromWorkMin} min du travail</li>
                    <li>{g.travelFromHomeMin} min de chez toi</li>
                    <li>
                      Personnel{' '}
                      {g.staffFromHm && g.staffUntilHm
                        ? `${g.staffFromHm}–${g.staffUntilHm}`
                        : '—'}
                    </li>
                    {g.city ? <li>{g.city}</li> : null}
                    {g.closesHm ? <li>Ferme à {g.closesHm}</li> : null}
                  </ul>
                ) : null}
              </div>
            )
          })}
          {!minor ? (
            <button
              type="button"
              onClick={() => setPane('evening')}
              className="ios-press flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
            >
              <span>
                <span className="block font-semibold text-white">Le soir</span>
                <span className="text-[12px] text-[#ACB4BA]">
                  {settings.eveningWalkEnabled || settings.stafflessGymEnabled
                    ? 'Personnalisé'
                    : 'Protecteur'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#ACB4BA]" />
            </button>
          ) : null}
          <p className="text-[12px] leading-snug text-[#ACB4BA]">
            {CRENEAU_PHRASES.sameProtectiveSetting}
          </p>
        </div>
      ) : null}

      {pane === 'evening' ? (
        <div className="flex flex-col gap-4" data-creneau-evening>
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('gyms')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[18px] font-bold text-white">Le soir</h2>
          </header>
          {minor ? (
            <p className="text-[13px] text-[#ACB4BA]">
              Ces options ne s’appliquent pas aux comptes mineurs.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">Je marche aussi le soir</span>
                  <input
                    type="checkbox"
                    checked={settings.eveningWalkEnabled}
                    onChange={(e) => {
                      const on = e.target.checked
                      patch({ eveningWalkEnabled: on })
                      if (on) showToast(activationPhrase('evening_walk'))
                    }}
                    className="h-5 w-5 accent-[#ff0702]"
                  />
                </span>
                {settings.eveningWalkEnabled ? (
                  <span className="text-[12px] text-[#ACB4BA]">
                    {CRENEAU_PHRASES.eveningWalkActivate}
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">Salle sans personnel</span>
                  <input
                    type="checkbox"
                    checked={settings.stafflessGymEnabled}
                    onChange={(e) => {
                      const on = e.target.checked
                      patch({ stafflessGymEnabled: on })
                      if (on) showToast(activationPhrase('staffless'))
                    }}
                    className="h-5 w-5 accent-[#ff0702]"
                  />
                </span>
                {settings.stafflessGymEnabled ? (
                  <span className="text-[12px] text-[#ACB4BA]">
                    {CRENEAU_PHRASES.stafflessActivate}
                  </span>
                ) : null}
              </label>
            </>
          )}
          {/* B2 / CA-C28: sunset is computed — no manual checkbox */}
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="font-semibold text-white">Vigilance chaleur (aujourd&apos;hui)</span>
            <input
              type="checkbox"
              checked={settings.heatVigilanceToday}
              onChange={(e) => patch({ heatVigilanceToday: e.target.checked })}
              className="h-5 w-5 accent-[#ff0702]"
            />
          </label>
          {soleilPhrase ? (
            <p className="text-[13px] text-[#ACB4BA]" data-creneau-soleil>
              {soleilPhrase}
            </p>
          ) : null}
        </div>
      ) : null}

      {pane === 'delay' ? (
        <div className="flex flex-col gap-3" data-creneau-delay-pane>
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('home')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-[14px] text-[#ACB4BA]">Combien de retard&nbsp;?</p>
          </header>
          {[15, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              className="ios-press rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[17px] font-bold text-white"
              onClick={() => {
                setDelayMin(m)
                const start = addMinutes(primary?.sessionStartHm ?? clockHm, m)
                const ret = addMinutes(primary?.returnHm ?? clockHm, m)
                setDelayResult(formatDelayMessage(start ?? '—', ret ?? '—'))
                setPane('delayResult')
              }}
            >
              +{m} min
            </button>
          ))}
        </div>
      ) : null}

      {pane === 'delayResult' ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5" data-creneau-delay-result>
          <p className="text-[16px] leading-relaxed text-white">{delayResult}</p>
          <button
            type="button"
            className="ios-press mt-4 w-full rounded-2xl py-3 font-bold text-white"
            style={{ background: CRENEAU_RED }}
            onClick={() => setPane('home')}
          >
            OK
          </button>
        </div>
      ) : null}

      {pane === 'energy' ? (
        <div className="flex flex-col gap-3" data-creneau-energy-pane>
          <header className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPane('home')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 text-white"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-[16px] font-semibold text-white">{CRENEAU_PHRASES.softSessionAsk}</p>
          </header>
          <button
            type="button"
            className="ios-press rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[15px] font-semibold text-white"
            onClick={() => {
              setSoft(true)
              setEnergyResult(CRENEAU_PHRASES.softSessionResult)
              setPane('energyResult')
            }}
          >
            Séance douce
          </button>
          <button
            type="button"
            className="ios-press rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[15px] font-semibold text-white"
            onClick={() => {
              setEnergyResult(CRENEAU_PHRASES.softTomorrow)
              setPane('energyResult')
            }}
          >
            Demain
          </button>
        </div>
      ) : null}

      {pane === 'energyResult' ? (
        renderHero({
          title:
            energyResult === CRENEAU_PHRASES.softTomorrow ? 'DEMAIN' : 'OK, ON VOIT ÇA',
          button: CRENEAU_PHRASES.backToPlan,
          onButton: () => {
            setPane('home')
            setEnergyResult('')
          },
          lineA: CRENEAU_PHRASES.softRest,
          lineB: null,
        })
      ) : null}

      {/* Hidden entry to check-in near session — CA-C18 */}
      {pane === 'home' && committed && primary?.gymId ? (
        <button
          type="button"
          className="sr-only"
          data-creneau-open-checkin
          onClick={() => setPane('checkin')}
        >
          Je suis là
        </button>
      ) : null}

      {pane === 'home' && committed && primary ? (
        <div className="px-1">
          <button
            type="button"
            onClick={() => setPane('checkin')}
            className="ios-press w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-[14px] font-semibold text-white"
            data-creneau-im-here
          >
            {CRENEAU_PHRASES.imHereButton}
          </button>
          <div className="mt-3 flex justify-center">
            <CreneauLottie className="h-[120px] w-[120px]" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
