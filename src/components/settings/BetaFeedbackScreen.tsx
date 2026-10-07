import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BETA_FEEDBACK_AGE_BLOCKED,
  BETA_FEEDBACK_BACK,
  BETA_FEEDBACK_CALL_15,
  BETA_FEEDBACK_CALL_3114,
  BETA_FEEDBACK_COMPLETE_PROFILE,
  BETA_FEEDBACK_CONFIRM,
  BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE,
  BETA_FEEDBACK_CONFIRM_URGENT_TCA,
  BETA_FEEDBACK_CONSENT,
  BETA_FEEDBACK_CONSENT_MORE,
  BETA_FEEDBACK_CONSENT_MORE_BODY,
  BETA_FEEDBACK_DAILY_LIMIT,
  BETA_FEEDBACK_DRAFT_KEPT,
  BETA_FEEDBACK_EMPTY,
  BETA_FEEDBACK_ERROR_SEND,
  BETA_FEEDBACK_INSULT_PROMPT,
  BETA_FEEDBACK_META_HINT,
  BETA_FEEDBACK_NEED_TO_TALK,
  BETA_FEEDBACK_NO_REALTIME,
  BETA_FEEDBACK_OFFLINE,
  BETA_FEEDBACK_OFFLINE_INSULT_MASK,
  BETA_FEEDBACK_OFFLINE_QUEUED_HELP,
  BETA_FEEDBACK_OPEN_PROFILE,
  BETA_FEEDBACK_PAGE_LABEL,
  BETA_FEEDBACK_REFORMULATE,
  BETA_FEEDBACK_RETRY,
  BETA_FEEDBACK_SCREEN_TITLE,
  BETA_FEEDBACK_SEND_ANYWAY,
  BETA_FEEDBACK_SUBMIT,
  BETA_FEEDBACK_TEL_15,
  BETA_FEEDBACK_TEL_3114,
  BETA_FEEDBACK_TEXTE_HELP,
  BETA_FEEDBACK_TEXTE_HINT,
  BETA_FEEDBACK_TEXTE_SR_LABEL,
  BETA_FEEDBACK_TOO_LONG,
  BETA_FEEDBACK_TYPE_AUTRE,
  BETA_FEEDBACK_TYPE_AUTRE_HINT,
  BETA_FEEDBACK_TYPE_BUG,
  BETA_FEEDBACK_TYPE_BUG_HINT,
  BETA_FEEDBACK_TYPE_GROUP_LABEL,
  BETA_FEEDBACK_TYPE_IDEE,
  BETA_FEEDBACK_TYPE_IDEE_HINT,
  BETA_FEEDBACK_VERSION_LABEL,
} from '../../content/betaFeedbackCopy'
import { getAppBuildId } from '../../pwa/appBuildId'
import { getBetaFeedbackAgeStatus } from '../../services/betaFeedbackAccess'
import {
  BETA_FEEDBACK_PAGES,
  isBetaFeedbackPage,
  type BetaFeedbackPage,
} from '../../services/betaFeedbackPages'
import { consumeBetaFeedbackPrefillPage } from '../../services/betaFeedbackNav'
import {
  enqueueAvisOffline,
  wireAvisQueueLifecycleOnce,
} from '../../services/avisBetaOfflineQueue'
import { AVIS_BETA_DRAFT_KEY } from '../../services/clearAvisBetaLocalData'
import {
  createAvisAntiDoublonKey,
  submitAvisBeta,
  type AvisType,
} from '../../services/convexAvisBetaService'
import { detectDistressLevel } from '../../../convex/avisDistress'
import { detectInsultWords } from '../../../convex/avisInsults'

const TEXTE_MIN = 10
const TEXTE_MAX = 2000
const COUNTER_FROM = 1800

type Phase =
  | 'form'
  | 'insult'
  | 'success'
  | 'urgent_tca'
  | 'urgent_suicide'
  | 'blocked'
  | 'needs_profile'

interface BetaFeedbackScreenProps {
  onBack: () => void
  onOpenNeedToTalk: () => void
  /** Ouvre l’écran profil (âge manquant → compléter le profil). */
  onOpenProfile: () => void
  initialPage?: string
}

function initialPhaseFromAge(): Phase {
  const status = getBetaFeedbackAgeStatus()
  if (status === 'adult') return 'form'
  if (status === 'missing') return 'needs_profile'
  return 'blocked'
}

type DraftState = {
  type: AvisType | null
  texte: string
  page: string
  consent: boolean
}

function readDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(AVIS_BETA_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DraftState
  } catch {
    return null
  }
}

function writeDraft(draft: DraftState): void {
  try {
    localStorage.setItem(AVIS_BETA_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(AVIS_BETA_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function resolveInitialPage(explicit?: string): BetaFeedbackPage {
  const fromNav = explicit ?? consumeBetaFeedbackPrefillPage()
  if (fromNav && isBetaFeedbackPage(fromNav)) return fromNav
  return 'Réglages'
}

function applyDistressPhase(
  setPhase: (p: Phase) => void,
  level: 0 | 1 | 2,
): void {
  if (level === 2) setPhase('urgent_suicide')
  else if (level === 1) setPhase('urgent_tca')
  else setPhase('success')
}

export function BetaFeedbackScreen({
  onBack,
  onOpenNeedToTalk,
  onOpenProfile,
  initialPage,
}: BetaFeedbackScreenProps) {
  const ageStatus = getBetaFeedbackAgeStatus()
  const allowed = ageStatus === 'adult'
  const versionId = getAppBuildId()

  const draft = useMemo(() => readDraft(), [])
  const [phase, setPhase] = useState<Phase>(initialPhaseFromAge)
  const [type, setType] = useState<AvisType | null>(draft?.type ?? null)
  const [texte, setTexte] = useState(draft?.texte ?? '')
  const [page, setPage] = useState<BetaFeedbackPage>(() => {
    if (draft?.page && isBetaFeedbackPage(draft.page)) return draft.page
    return resolveInitialPage(initialPage)
  })
  const [consent, setConsent] = useState(false)
  const [consentMoreOpen, setConsentMoreOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldHint, setFieldHint] = useState<'empty' | 'too_long' | null>(null)
  const [texteTouched, setTexteTouched] = useState(false)
  const [offlineQueued, setOfflineQueued] = useState(false)
  const [antiDoublonKey, setAntiDoublonKey] = useState(() => createAvisAntiDoublonKey())
  const [forceInsults, setForceInsults] = useState(false)
  const sendingLock = useRef(false)

  useEffect(() => {
    wireAvisQueueLifecycleOnce()
  }, [])

  useEffect(() => {
    if (phase !== 'form' && phase !== 'insult') return
    writeDraft({ type, texte, page, consent: false })
  }, [type, texte, page, phase])

  const trimmedLen = texte.trim().length
  const canSubmit =
    allowed &&
    type != null &&
    trimmedLen >= TEXTE_MIN &&
    trimmedLen <= TEXTE_MAX &&
    consent &&
    !sending

  // AV-15 : une seule ligne version (pas de doublon).
  const metaLine = `${BETA_FEEDBACK_PAGE_LABEL} : ${page} · ${BETA_FEEDBACK_VERSION_LABEL} ${versionId}. ${BETA_FEEDBACK_META_HINT}`

  const handleTexteChange = (value: string) => {
    setTexteTouched(true)
    // AV-10 : pas de maxLength HTML silencieux — on coupe + message.
    if (value.length > TEXTE_MAX) {
      setTexte(value.slice(0, TEXTE_MAX))
      setFieldHint('too_long')
      setError(BETA_FEEDBACK_TOO_LONG)
      return
    }
    setTexte(value)
    const len = value.trim().length
    if (len === 0) setFieldHint('empty')
    else if (len < TEXTE_MIN) setFieldHint('empty')
    else setFieldHint(null)
    if (error === BETA_FEEDBACK_TOO_LONG || error === BETA_FEEDBACK_EMPTY) {
      setError(null)
    }
  }

  const queueOfflineAndFinish = (
    payload: Parameters<typeof enqueueAvisOffline>[0],
    localDistress: 0 | 1 | 2,
  ) => {
    enqueueAvisOffline(payload)
    setOfflineQueued(true)
    clearDraft()
    setAntiDoublonKey(createAvisAntiDoublonKey())
    if (localDistress > 0) applyDistressPhase(setPhase, localDistress)
    else setError(BETA_FEEDBACK_OFFLINE)
  }

  const doSubmit = async (forcerEnvoiAvecInsultes: boolean) => {
    if (!type || sendingLock.current) return
    sendingLock.current = true
    setSending(true)
    setError(null)
    setOfflineQueued(false)

    const trimmed = texte.trim()
    const localDistress = detectDistressLevel(trimmed)
    const hasInsults = detectInsultWords(trimmed).length > 0

    const payload = {
      type,
      texte: trimmed,
      page,
      version: versionId,
      cleAntiDoublon: antiDoublonKey,
      consentementAccepte: true as const,
      // Détresse : masquage auto (AV-05). Insultes hors ligne : seulement si choisi (AV-17).
      forcerEnvoiAvecInsultes:
        forcerEnvoiAvecInsultes || localDistress > 0 ? true : undefined,
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (offline) {
      try {
        // AV-17 : hors ligne + insultes (sans détresse) → reformuler ou prévenir du masquage.
        if (hasInsults && localDistress === 0 && !forcerEnvoiAvecInsultes) {
          setForceInsults(false)
          setPhase('insult')
          setError(BETA_FEEDBACK_OFFLINE_INSULT_MASK)
          return
        }
        queueOfflineAndFinish(payload, localDistress)
      } catch {
        setError(BETA_FEEDBACK_ERROR_SEND)
      } finally {
        sendingLock.current = false
        setSending(false)
      }
      return
    }

    try {
      const result = await submitAvisBeta(payload)
      if (!result.ok) {
        if (result.error === 'AVIS_BETA_AGE_REQUIRED') {
          // AV-19 : âge pas encore sync → Complète ton profil (sauf mineur connu).
          setPhase(getBetaFeedbackAgeStatus() === 'minor' ? 'blocked' : 'needs_profile')
          sendingLock.current = false
          setSending(false)
          return
        }
        // AV-18 / AV-04 : détresse → garder en file + aide (sauf âge).
        if (localDistress > 0) {
          try {
            queueOfflineAndFinish(payload, localDistress)
          } catch {
            applyDistressPhase(setPhase, localDistress)
          }
          sendingLock.current = false
          setSending(false)
          return
        }
        if (result.needsReformulation || result.reason === 'insults') {
          setForceInsults(false)
          setPhase('insult')
          sendingLock.current = false
          setSending(false)
          return
        }
        if (result.error === 'AVIS_BETA_DAILY_LIMIT') {
          setError(BETA_FEEDBACK_DAILY_LIMIT)
          sendingLock.current = false
          setSending(false)
          return
        }
        setError(BETA_FEEDBACK_ERROR_SEND)
        sendingLock.current = false
        setSending(false)
        return
      }

      clearDraft()
      setAntiDoublonKey(createAvisAntiDoublonKey())
      applyDistressPhase(setPhase, result.distressLevel)
    } catch {
      // AV-18 : erreur réseau + détresse → file + aide (retry au retour).
      try {
        queueOfflineAndFinish(payload, localDistress)
      } catch {
        if (localDistress > 0) applyDistressPhase(setPhase, localDistress)
        else setError(BETA_FEEDBACK_ERROR_SEND)
      }
    } finally {
      sendingLock.current = false
      setSending(false)
    }
  }

  const onSubmitClick = () => {
    if (!type) return
    setTexteTouched(true)
    if (trimmedLen < TEXTE_MIN) {
      setFieldHint('empty')
      setError(BETA_FEEDBACK_EMPTY)
      return
    }
    if (!consent) return
    void doSubmit(forceInsults)
  }

  if (phase === 'needs_profile') {
    return (
      <section
        className="ios-fade-up space-y-5 pb-8"
        data-testid="beta-feedback-screen"
        data-age-gate="missing"
      >
        <Header onBack={onBack} />
        <p
          className="text-[15px] leading-relaxed text-[#EBEBF5]"
          data-testid="beta-feedback-complete-profile"
        >
          {BETA_FEEDBACK_COMPLETE_PROFILE}
        </p>
        <button
          type="button"
          onClick={onOpenProfile}
          className="ios-press w-full rounded-2xl bg-[#FF2B2B] px-4 py-3.5 text-[15px] font-semibold text-white"
          data-testid="beta-feedback-open-profile"
        >
          {BETA_FEEDBACK_OPEN_PROFILE}
        </button>
        <button
          type="button"
          onClick={onOpenNeedToTalk}
          className="ios-press text-[15px] font-semibold text-[#64D2FF] underline"
          data-testid="beta-feedback-need-to-talk"
        >
          {BETA_FEEDBACK_NEED_TO_TALK}
        </button>
      </section>
    )
  }

  if (phase === 'blocked') {
    return (
      <section className="ios-fade-up space-y-5 pb-8" data-testid="beta-feedback-screen">
        <Header onBack={onBack} />
        <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{BETA_FEEDBACK_AGE_BLOCKED}</p>
      </section>
    )
  }

  if (phase === 'success') {
    return (
      <section className="ios-fade-up space-y-5 pb-8" data-testid="beta-feedback-screen">
        <Header onBack={onBack} />
        <p className="text-[15px] leading-relaxed text-[#EBEBF5]" data-testid="beta-feedback-confirm">
          {BETA_FEEDBACK_CONFIRM}
        </p>
        {offlineQueued ? (
          <p className="text-[13px] text-[#AEAEB2]">{BETA_FEEDBACK_OFFLINE_QUEUED_HELP}</p>
        ) : null}
        <button
          type="button"
          onClick={onOpenNeedToTalk}
          className="ios-press text-[15px] font-semibold text-[#64D2FF] underline"
          data-testid="beta-feedback-need-to-talk"
        >
          {BETA_FEEDBACK_NEED_TO_TALK}
        </button>
      </section>
    )
  }

  if (phase === 'urgent_tca') {
    return (
      <section
        className="ios-fade-up space-y-5 pb-8"
        data-testid="beta-feedback-screen"
        data-distress-level="1"
      >
        <Header onBack={onBack} />
        <p className="text-[15px] leading-relaxed text-[#EBEBF5]" data-testid="beta-feedback-confirm">
          {BETA_FEEDBACK_CONFIRM_URGENT_TCA}
        </p>
        {offlineQueued ? (
          <p className="text-[13px] text-[#AEAEB2]">{BETA_FEEDBACK_OFFLINE_QUEUED_HELP}</p>
        ) : null}
        <button
          type="button"
          onClick={onOpenNeedToTalk}
          className="ios-press text-[15px] font-semibold text-[#64D2FF] underline"
          data-testid="beta-feedback-need-to-talk"
        >
          {BETA_FEEDBACK_NEED_TO_TALK}
        </button>
      </section>
    )
  }

  if (phase === 'urgent_suicide') {
    return (
      <section
        className="ios-fade-up space-y-5 pb-8"
        data-testid="beta-feedback-screen"
        data-distress-level="2"
      >
        <Header onBack={onBack} />
        <p className="text-[15px] leading-relaxed text-[#EBEBF5]" data-testid="beta-feedback-confirm">
          {BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE}
        </p>
        <p className="text-[13px] leading-relaxed text-[#AEAEB2]" data-testid="beta-feedback-no-realtime">
          {BETA_FEEDBACK_NO_REALTIME}
        </p>
        {offlineQueued ? (
          <p className="text-[13px] text-[#AEAEB2]">{BETA_FEEDBACK_OFFLINE_QUEUED_HELP}</p>
        ) : null}
        <div className="flex flex-col gap-3">
          <a
            href={BETA_FEEDBACK_TEL_3114}
            className="ios-press rounded-2xl bg-[#FF2B2B] px-4 py-3.5 text-center text-[15px] font-semibold text-white"
            data-testid="beta-feedback-call-3114"
          >
            {BETA_FEEDBACK_CALL_3114}
          </a>
          <a
            href={BETA_FEEDBACK_TEL_15}
            className="ios-press rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-center text-[15px] font-semibold text-white"
            data-testid="beta-feedback-call-15"
          >
            {BETA_FEEDBACK_CALL_15}
          </a>
          <button
            type="button"
            onClick={onOpenNeedToTalk}
            className="ios-press text-[15px] font-semibold text-[#64D2FF] underline"
            data-testid="beta-feedback-need-to-talk"
          >
            {BETA_FEEDBACK_NEED_TO_TALK}
          </button>
        </div>
      </section>
    )
  }

  if (phase === 'insult') {
    return (
      <section className="ios-fade-up space-y-5 pb-8" data-testid="beta-feedback-screen">
        <Header onBack={onBack} />
        <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{BETA_FEEDBACK_INSULT_PROMPT}</p>
        {error === BETA_FEEDBACK_OFFLINE_INSULT_MASK ? (
          <p
            className="text-[13px] leading-relaxed text-[#AEAEB2]"
            data-testid="beta-feedback-offline-insult"
          >
            {BETA_FEEDBACK_OFFLINE_INSULT_MASK}
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="ios-press rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-[15px] font-semibold text-white"
            onClick={() => {
              setForceInsults(false)
              setError(null)
              setPhase('form')
            }}
          >
            {BETA_FEEDBACK_REFORMULATE}
          </button>
          <button
            type="button"
            className="ios-press rounded-2xl bg-[#FF2B2B] px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
            disabled={sending}
            onClick={() => {
              setForceInsults(true)
              void doSubmit(true)
            }}
          >
            {BETA_FEEDBACK_SEND_ANYWAY}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="ios-fade-up space-y-5 pb-8" data-testid="beta-feedback-screen">
      <Header onBack={onBack} />
      <h1 className="text-[28px] font-bold tracking-tight text-white">{BETA_FEEDBACK_SCREEN_TITLE}</h1>

      <div className="space-y-2" role="group" aria-label={BETA_FEEDBACK_TYPE_GROUP_LABEL}>
        {(
          [
            { id: 'bug' as const, label: BETA_FEEDBACK_TYPE_BUG, hint: BETA_FEEDBACK_TYPE_BUG_HINT },
            { id: 'idee' as const, label: BETA_FEEDBACK_TYPE_IDEE, hint: BETA_FEEDBACK_TYPE_IDEE_HINT },
            {
              id: 'autre' as const,
              label: BETA_FEEDBACK_TYPE_AUTRE,
              hint: BETA_FEEDBACK_TYPE_AUTRE_HINT,
            },
          ] as const
        ).map((option) => {
          const selected = type === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setType(option.id)}
              className={`ios-press w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                selected
                  ? 'border-[#FF2B2B]/60 bg-[#FF2B2B]/15'
                  : 'border-white/10 bg-black/25'
              }`}
              data-testid={`beta-feedback-type-${option.id}`}
            >
              <span className="block text-[15px] font-semibold text-white">{option.label}</span>
              <span className="mt-0.5 block text-[13px] text-[#AEAEB2]">{option.hint}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <label htmlFor="beta-feedback-texte" className="sr-only">
          {BETA_FEEDBACK_TEXTE_SR_LABEL}
        </label>
        <textarea
          id="beta-feedback-texte"
          value={texte}
          onChange={(e) => handleTexteChange(e.target.value)}
          rows={6}
          placeholder={BETA_FEEDBACK_TEXTE_HELP}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-[#636366] outline-none focus:border-[#FF2B2B]/50"
          data-testid="beta-feedback-texte"
        />
        <p className="text-[13px] text-[#8E8E93]">{BETA_FEEDBACK_TEXTE_HINT}</p>
        {texte.length >= COUNTER_FROM ? (
          <p className="text-[12px] text-[#AEAEB2]" data-testid="beta-feedback-counter">
            {texte.length} / {TEXTE_MAX}
          </p>
        ) : null}
        {/* AV-09 / AV-21 : message vide seulement après interaction (pas dès l’ouverture) */}
        {texteTouched && (fieldHint === 'empty' || trimmedLen < TEXTE_MIN) ? (
          <p className="text-[13px] text-[#FF6961]" data-testid="beta-feedback-empty-hint">
            {BETA_FEEDBACK_EMPTY}
          </p>
        ) : null}
        {fieldHint === 'too_long' || error === BETA_FEEDBACK_TOO_LONG ? (
          <p className="text-[13px] text-[#FF6961]" data-testid="beta-feedback-too-long-hint">
            {BETA_FEEDBACK_TOO_LONG}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4">
        <label className="block text-[13px] font-semibold text-white" htmlFor="beta-feedback-page">
          {BETA_FEEDBACK_PAGE_LABEL}
        </label>
        <select
          id="beta-feedback-page"
          value={page}
          onChange={(e) => setPage(e.target.value as BetaFeedbackPage)}
          className="w-full rounded-xl border border-white/10 bg-[#1C1C1E] px-3 py-2.5 text-[15px] text-white outline-none"
          data-testid="beta-feedback-page"
        >
          {BETA_FEEDBACK_PAGES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <p className="text-[12px] leading-snug text-[#8E8E93]" data-testid="beta-feedback-meta">
          {metaLine}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-[14px] leading-snug text-[#EBEBF5]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40"
            data-testid="beta-feedback-consent"
          />
          <span>{BETA_FEEDBACK_CONSENT}</span>
        </label>
        <button
          type="button"
          className="text-[13px] font-semibold text-[#64D2FF] underline"
          onClick={() => setConsentMoreOpen((v) => !v)}
        >
          {BETA_FEEDBACK_CONSENT_MORE}
        </button>
        {consentMoreOpen ? (
          <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{BETA_FEEDBACK_CONSENT_MORE_BODY}</p>
        ) : null}
      </div>

      {error && error !== BETA_FEEDBACK_EMPTY && error !== BETA_FEEDBACK_TOO_LONG ? (
        <div className="space-y-2 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-3">
          <p className="text-[13px] text-[#FF6961]" data-testid="beta-feedback-error">
            {error}
          </p>
          {error === BETA_FEEDBACK_ERROR_SEND ? (
            <button
              type="button"
              className="text-[13px] font-semibold text-white underline"
              onClick={() => void doSubmit(forceInsults)}
              disabled={sending}
            >
              {BETA_FEEDBACK_RETRY}
            </button>
          ) : null}
          {offlineQueued ? (
            <p className="text-[12px] text-[#AEAEB2]">{BETA_FEEDBACK_DRAFT_KEPT}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmitClick}
        className="ios-press w-full rounded-2xl bg-[#FF2B2B] px-4 py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
        data-testid="beta-feedback-submit"
      >
        {BETA_FEEDBACK_SUBMIT}
      </button>
    </section>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex items-start gap-3">
      <button
        type="button"
        onClick={onBack}
        className="ios-press rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] font-semibold text-[#AEAEB2]"
      >
        {BETA_FEEDBACK_BACK}
      </button>
    </header>
  )
}
