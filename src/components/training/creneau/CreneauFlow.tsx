import { useCallback, useEffect, useMemo, useState } from 'react'
import { CRENEAU_PHRASES, type CreneauCrowdLevel } from '../../../creneau/constants'
import {
  activationPhrase,
  addMinutes,
  formatDelayMessage,
  isCreneauMinor,
  proposeCreneau,
  type ProposedSlot,
} from '../../../creneau/engine'
import {
  formatDepartedHeadline,
  resolveDepartureDisplay,
  salleTravelLine,
} from '../../../creneau/v9Display'
import { getCalorieProfile } from '../../../services/nutritionStorage'
import {
  CRENEAU_CHANGED_EVENT,
  ensureDefaultGyms,
  getCreneauSettings,
  recordCrowdTap,
  saveCreneauSettings,
  type CreneauSettings,
} from '../../../services/creneau/storage'
import { CreneauV9Screen } from './CreneauV9Screen'

import hero01 from '../../../assets/photos/creneau/v9/hero-01.jpg'
import hero02 from '../../../assets/photos/creneau/v9/hero-02.jpg'
import hero03 from '../../../assets/photos/creneau/v9/hero-03.jpg'
import hero04 from '../../../assets/photos/creneau/v9/hero-04.jpg'
import hero05 from '../../../assets/photos/creneau/v9/hero-05.jpg'
import hero06 from '../../../assets/photos/creneau/v9/hero-06.jpg'
import hero07 from '../../../assets/photos/creneau/v9/hero-07.jpg'

type Pane =
  | 'home'
  | 'other'
  | 'gyms'
  | 'evening'
  | 'energy'
  | 'checkin'
  | 'delay'
  | 'delayResult'

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

function travelLabel(slot: ProposedSlot): string {
  return slot.trajetLabel
}

export function CreneauFlow({ onBack }: { onBack: () => void }) {
  const [pane, setPane] = useState<Pane>('home')
  const [settings, setSettings] = useState<CreneauSettings>(() => ensureDefaultGyms())
  const [clockHm, setClockHm] = useState(nowHm)
  const [delayMin, setDelayMin] = useState(0)
  const [soft, setSoft] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const [activeSlot, setActiveSlot] = useState<ProposedSlot | null>(null)
  const [showCrowdPick, setShowCrowdPick] = useState(false)
  const [usingPlanB, setUsingPlanB] = useState(false)

  // age 0 = profil non renseigné (nutrition default) → inconnu / protecteur mineur
  const rawAge = getCalorieProfile().age
  const age = rawAge > 0 ? rawAge : null
  const minor = isCreneauMinor(age)

  useEffect(() => {
    const sync = () => setSettings(getCreneauSettings())
    window.addEventListener(CRENEAU_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CRENEAU_CHANGED_EVENT, sync)
  }, [])

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

  const patch = useCallback((p: Partial<CreneauSettings>) => {
    setSettings(saveCreneauSettings(p))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  const depDisplay = useMemo(() => {
    if (!primary) return null
    return resolveDepartureDisplay(primary.departureHm, clockHm)
  }, [primary, clockHm])

  const effectiveDeparture = depDisplay?.displayHm ?? primary?.departureHm ?? '—'

  const lineSalle = primary
    ? salleTravelLine(primary.gymName, travelLabel(primary))
    : null
  const lineSunOrMinor = minor
    ? CRENEAU_PHRASES.minorHeroLine
    : soleilPhrase

  const goPrimary = () => {
    if (!primary) return
    // If showing a bumped time, commit with that visual departure still OK
    setCommitted(true)
    setActiveSlot({
      ...primary,
      departureHm: effectiveDeparture,
    })
    showToast(`${CRENEAU_PHRASES.notedPrefix} ${effectiveDeparture}`)
  }

  // ——— Empty ———
  // Titre « Mon créneau » uniquement dans le header CreneauV9Screen (pas en eyebrow).
  if (!primary || !depDisplay) {
    return (
      <CreneauV9Screen
        stateId="empty"
        heroSrc={hero06}
        eyebrow="Ce soir"
        giant="—"
        line1="Aucun créneau pour l’instant."
        line2={
          minor
            ? CRENEAU_PHRASES.minorEveningHelp
            : 'La salle n’est plus proposée à cette heure.'
        }
        primaryLabel="Changer de salle"
        onPrimary={() => setPane('gyms')}
        secondaryLabel={null}
        onBack={onBack}
      />
    )
  }

  // ——— Check-in (behind tap, keep current Calme/Moyen/Chargé) ———
  if (pane === 'checkin') {
    return (
      <div data-creneau-checkin>
        <CreneauV9Screen
          stateId="checkin"
          heroSrc={hero06}
          eyebrow="Séance"
          giant={primary.sessionStartHm}
          line1={CRENEAU_PHRASES.onSiteThanks}
          line2={null}
          primaryLabel={
            showCrowdPick ? CRENEAU_PHRASES.onSiteAsk : CRENEAU_PHRASES.imHereButton
          }
          onPrimary={() => setShowCrowdPick(true)}
          secondaryLabel="Retour"
          onSecondary={() => {
            setShowCrowdPick(false)
            setPane('home')
          }}
          onBack={() => setPane('home')}
        />
        {showCrowdPick && primary.gymId ? (
          <div className="fixed inset-x-0 bottom-[calc(var(--app-bottom-nav,72px)+env(safe-area-inset-bottom,0px)+8px)] z-20 grid grid-cols-3 gap-2 px-4">
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
                className="ios-press rounded-2xl bg-white py-3 text-[13px] font-bold text-black"
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
        ) : null}
      </div>
    )
  }

  // ——— Delay (existing behaviour, not drawn as v9 hero) ———
  if (pane === 'delay' || pane === 'delayResult') {
    return (
      <div className="flex flex-col gap-3 px-1" data-creneau-delay-pane>
        <CreneauV9Screen
          stateId="delay"
          heroSrc={hero05}
          eyebrow="Retard"
          giant={pane === 'delayResult' ? effectiveDeparture : '+15'}
          line1={
            pane === 'delayResult'
              ? formatDelayMessage(
                  addMinutes(primary.sessionStartHm, delayMin) ?? primary.sessionStartHm,
                  addMinutes(primary.returnHm, delayMin) ?? primary.returnHm,
                )
              : 'Combien de retard ?'
          }
          line2={null}
          primaryLabel={pane === 'delayResult' ? 'OK' : '+15 min'}
          onPrimary={() => {
            if (pane === 'delayResult') {
              setPane('home')
              return
            }
            setDelayMin(15)
            setPane('delayResult')
          }}
          secondaryLabel={pane === 'delay' ? '+30 min' : 'Retour'}
          onSecondary={() => {
            if (pane === 'delay') {
              setDelayMin(30)
              setPane('delayResult')
            } else setPane('home')
          }}
          onBack={() => setPane('home')}
        />
      </div>
    )
  }

  // ——— 04 Pas d'énergie ———
  if (pane === 'energy') {
    return (
      <CreneauV9Screen
        stateId="pas_energie"
        heroSrc={hero04}
        eyebrow="Pas d'énergie aujourd'hui ?"
        giant="Demain"
        line1="On garde un créneau doux, ou on décale."
        line2={null}
        primaryLabel="Décaler à demain"
        onPrimary={() => {
          showToast(CRENEAU_PHRASES.softTomorrow)
          setPane('home')
        }}
        secondaryLabel="Séance douce"
        onSecondary={() => {
          // Behind tap — keep current soft behaviour, no new screen
          setSoft(true)
          showToast(CRENEAU_PHRASES.softSessionResult)
          setPane('home')
        }}
        onBack={() => setPane('home')}
      />
    )
  }

  // ——— 03 Le soir ———
  if (pane === 'evening') {
    return (
      <CreneauV9Screen
        stateId="le_soir"
        heroSrc={hero03}
        eyebrow="Le soir"
        giant="Salle"
        line1="On te propose la salle, plutôt que dehors."
        line2={null}
        primaryLabel="C'est bon"
        onPrimary={() => setPane('home')}
        secondaryLabel={minor ? null : 'Marcher le soir'}
        onSecondary={
          minor
            ? undefined
            : () => {
                // Behind tap — keep current activation, no new detail screen
                patch({ eveningWalkEnabled: true })
                showToast(activationPhrase('evening_walk'))
                setPane('home')
              }
        }
        onBack={() => setPane('gyms')}
      />
    )
  }

  // ——— 02 Changer de salle ———
  if (pane === 'gyms') {
    const fav = settings.favorite
    const bak = settings.backup
    const shortName = (fav?.name ?? 'La gare').replace(/^Salle\s+/i, '')
    return (
      <CreneauV9Screen
        stateId="changer_salle"
        heroSrc={hero02}
        eyebrow="Changer de salle"
        giant={shortName}
        line1={
          fav
            ? `${fav.travelFromWorkMin} min à pied`
            : null
        }
        line2={null}
        primaryLabel="Garder cette salle"
        onPrimary={() => setPane('home')}
        secondaryLabel={bak ? bak.name : null}
        onSecondary={
          bak
            ? () => {
                // Swap favorite ↔ backup locally for this session
                const nextFav = bak
                const nextBak = fav
                patch({ favorite: nextFav, backup: nextBak })
                setActiveSlot(null)
                setUsingPlanB(false)
                setPane('home')
              }
            : undefined
        }
        onBack={() => setPane('home')}
      />
    )
  }

  // ——— 01 Autre heure (Plan B focus) ———
  if (pane === 'other') {
    const slot = planB && usingPlanB ? planB : planB ?? primary
    const otherDep = resolveDepartureDisplay(slot.departureHm, clockHm)
    return (
      <CreneauV9Screen
        stateId="autre_heure"
        heroSrc={hero01}
        eyebrow="Autre heure"
        giant={otherDep.displayHm}
        line1={salleTravelLine(slot.gymName, travelLabel(slot))}
        line2={minor ? CRENEAU_PHRASES.minorHeroLine : soleilPhrase}
        primaryLabel={CRENEAU_PHRASES.goButton}
        onPrimary={() => {
          setActiveSlot({ ...slot, departureHm: otherDep.displayHm })
          setUsingPlanB(true)
          setCommitted(true)
          setPane('home')
          showToast(`${CRENEAU_PHRASES.notedPrefix} ${otherDep.displayHm}`)
        }}
        secondaryLabel={
          planB
            ? `${planB.departureHm} · ${planB.gymName.replace(/^Salle\s+/i, '').toUpperCase()}`
            : 'Changer de salle'
        }
        onSecondary={() => {
          if (planB && slot.gymId !== planB.gymId) {
            setActiveSlot(planB)
            setUsingPlanB(true)
          } else {
            setPane('gyms')
          }
        }}
        onBack={() => {
          setUsingPlanB(false)
          setPane('home')
        }}
      />
    )
  }

  // ——— 05 / 06 / 07 home ———
  const departed = depDisplay.departed && !committed
  const stateId = departed ? 'depart_depasse' : minor ? 'mineur' : 'principal'
  const heroSrc = departed ? hero05 : minor ? hero07 : hero06

  return (
    <div data-creneau-flow data-pane="home">
      {toast ? (
        <div
          className="absolute left-4 right-4 top-14 z-30 rounded-2xl bg-white/10 px-4 py-3 text-center text-[13px] text-white backdrop-blur"
          data-creneau-toast
        >
          {toast}
        </div>
      ) : null}
      <CreneauV9Screen
        stateId={stateId}
        heroSrc={heroSrc}
        eyebrow={
          departed && depDisplay.passedHm
            ? formatDepartedHeadline(depDisplay.passedHm)
            : 'Pars à'
        }
        giant={effectiveDeparture}
        line1={lineSalle}
        line2={lineSunOrMinor}
        primaryLabel={
          committed ? CRENEAU_PHRASES.warnSomeone : CRENEAU_PHRASES.goButton
        }
        onPrimary={() => {
          if (committed) {
            const text = `J’arrive vers ${primary.returnHm} · ${primary.gymName}`
            void (async () => {
              try {
                if (navigator.share) await navigator.share({ text })
                else if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(text)
                  showToast('Message prêt — colle-le pour envoyer.')
                }
              } catch {
                /* cancelled */
              }
            })()
            return
          }
          goPrimary()
        }}
        secondaryLabel="Autre heure"
        onSecondary={() => {
          setUsingPlanB(Boolean(planB))
          setPane('other')
        }}
        onBack={onBack}
      />
      {/* Hidden helpers — existing behaviours, not drawn as primary chrome */}
      <div className="sr-only">
        <button type="button" onClick={() => setPane('energy')} data-creneau-energy>
          Pas aujourd&apos;hui
        </button>
        <button type="button" onClick={() => setPane('delay')} data-creneau-delay>
          Je suis en retard
        </button>
        <button type="button" onClick={() => setPane('evening')} data-creneau-evening>
          Le soir
        </button>
        <button type="button" onClick={() => setPane('gyms')} data-creneau-gyms>
          Changer de salle
        </button>
        {committed ? (
          <button type="button" onClick={() => setPane('checkin')} data-creneau-im-here>
            Je suis là
          </button>
        ) : null}
      </div>
    </div>
  )
}
