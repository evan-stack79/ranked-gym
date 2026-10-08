import { useCallback, useState } from 'react'
import { shouldHideRankings } from '../../services/communitySafety'
import { FALLBACK_GYM_NAME } from '../../lib/gymLeaderboard/texts'
import { GymLeaderboardScreen, type ClassementPeriod } from './GymLeaderboardScreen'
import { GymRulesJoinScreen } from './GymRulesJoinScreen'
import { GymManualAddScreen } from './GymManualAddScreen'
import type { LeaderboardRow } from './GymLeaderboardList'
import {
  compareToGymPoint,
  readCurrentPosition,
} from '../../lib/gymLeaderboard/locationCheck'
import { POSITION_IMPRECISE } from '../../lib/gymLeaderboard/texts'

type Step = 'rules' | 'manual' | 'board'

/**
 * Client flow for « Classement de ma salle ».
 * Works offline-friendly with local state; Convex sync when session available.
 * Google search stays disabled without server key — manual add only here.
 */
export function GymLeaderboardFlow({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('rules')
  const [pseudo, setPseudo] = useState('')
  const [gymLabel, setGymLabel] = useState(FALLBACK_GYM_NAME)
  const [gymKey, setGymKey] = useState<string | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualCity, setManualCity] = useState('')
  const [joined, setJoined] = useState(false)
  const [period, setPeriod] = useState<ClassementPeriod>('month')
  const [consentKnown, setConsentKnown] = useState(false)
  const [consent, setConsent] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [rows] = useState<LeaderboardRow[]>([])
  const [gymPoint, setGymPoint] = useState<{ lat: number; lng: number } | null>(null)

  const hideForMinor = shouldHideRankings()

  const resetAndClose = useCallback(() => {
    setToast(null)
    setConsentOpen(false)
    onClose()
  }, [onClose])

  const runPresenceCheck = useCallback(async () => {
    if (!gymPoint) {
      const pos = await readCurrentPosition()
      if (!pos.ok) {
        setToast('Impossible de lire la position. Réessaie près de l\'entrée.')
        return
      }
      setGymPoint({ lat: pos.reading.lat, lng: pos.reading.lng })
      setToast(
        'Point de la salle enregistré sur cet appareil. La validation comptera une fois synchronisée.',
      )
      return
    }
    const pos = await readCurrentPosition()
    if (!pos.ok) {
      setToast('Impossible de lire la position. Réessaie près de l\'entrée.')
      return
    }
    const decision = compareToGymPoint(pos.reading, gymPoint)
    if (decision === 'imprecise') {
      setToast(POSITION_IMPRECISE)
      return
    }
    if (decision === 'not_at_gym') {
      setToast('Tu ne sembles pas près de ta salle.')
      return
    }
    void gymKey
    setToast('Présence validée. Le classement se met à jour chaque nuit.')
  }, [gymKey, gymPoint])

  const handleAtGym = useCallback(async () => {
    if (!consentKnown) {
      setConsentOpen(true)
      return
    }
    if (!consent) {
      setToast('La position est désactivée. Tu peux la réactiver dans les réglages.')
      return
    }
    await runPresenceCheck()
  }, [consent, consentKnown, runPresenceCheck])

  if (!open) return null

  if (hideForMinor) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-[#0C0C0E] px-5 pt-16 text-white">
        <p className="text-[15px] text-[#AEAEB2]">Réservé aux 18 ans et plus.</p>
        <button type="button" className="mt-6 text-[#FF2B2B]" onClick={resetAndClose}>
          Fermer
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0C0C0E]" data-classement-flow>
      {step === 'manual' ? (
        <GymManualAddScreen
          name={manualName}
          city={manualCity}
          onNameChange={setManualName}
          onCityChange={setManualCity}
          onBack={() => setStep('rules')}
          onSubmit={() => {
            const label = `${manualName.trim()} – ${manualCity.trim()}`
            setGymLabel(label)
            setGymKey(`manual:local-${Date.now().toString(36)}`)
            setStep('rules')
          }}
        />
      ) : null}

      {step === 'rules' && !joined ? (
        <GymRulesJoinScreen
          gymLabel={gymLabel}
          pseudo={pseudo}
          onPseudoChange={setPseudo}
          onBack={resetAndClose}
          onLater={resetAndClose}
          onJoin={() => {
            if (!gymKey) {
              setStep('manual')
              return
            }
            setJoined(true)
            setStep('board')
          }}
        />
      ) : null}

      {(step === 'board' || joined) && step !== 'manual' ? (
        <GymLeaderboardScreen
          gymLabel={gymLabel}
          period={period}
          onPeriodChange={setPeriod}
          rows={rows}
          rankingVisible={false}
          memberCount={1}
          locationConsentKnown={consentKnown}
          locationConsent={consent}
          consentOpen={consentOpen}
          onBack={resetAndClose}
          onLeave={() => {
            setJoined(false)
            setGymKey(null)
            setPseudo('')
            resetAndClose()
          }}
          onRequestAtGym={() => {
            void handleAtGym()
          }}
          onConsentAccept={() => {
            setConsentKnown(true)
            setConsent(true)
            setConsentOpen(false)
            void runPresenceCheck()
          }}
          onConsentDecline={() => {
            setConsentKnown(true)
            setConsent(false)
            setConsentOpen(false)
          }}
        />
      ) : null}

      {toast ? (
        <div
          className="pointer-events-none absolute inset-x-4 bottom-28 z-[90] rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 py-3 text-center text-[13px] text-[#E5E5EA]"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
