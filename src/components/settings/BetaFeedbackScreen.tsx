import { useEffect, useMemo, useState } from 'react'
import {
  BETA_FEEDBACK_AGE_BLOCKED,
  BETA_FEEDBACK_CALL_15,
  BETA_FEEDBACK_CALL_3114,
  BETA_FEEDBACK_CONFIRM,
  BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE,
  BETA_FEEDBACK_CONFIRM_URGENT_TCA,
  BETA_FEEDBACK_CONSENT,
  BETA_FEEDBACK_CONSENT_MORE,
  BETA_FEEDBACK_CONSENT_MORE_BODY,
  BETA_FEEDBACK_DAILY_LIMIT,
  BETA_FEEDBACK_EMPTY,
  BETA_FEEDBACK_ERROR_SEND,
  BETA_FEEDBACK_INSULT_PROMPT,
  BETA_FEEDBACK_META_HINT,
  BETA_FEEDBACK_NEED_TO_TALK,
  BETA_FEEDBACK_NO_REALTIME,
  BETA_FEEDBACK_OFFLINE,
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
  BETA_FEEDBACK_TOO_LONG,
  BETA_FEEDBACK_TYPE_AUTRE,
  BETA_FEEDBACK_TYPE_AUTRE_HINT,
  BETA_FEEDBACK_TYPE_BUG,
  BETA_FEEDBACK_TYPE_BUG_HINT,
  BETA_FEEDBACK_TYPE_IDEE,
  BETA_FEEDBACK_TYPE_IDEE_HINT,
  BETA_FEEDBACK_VERSION_LABEL,
} from '../../content/betaFeedbackCopy'
import { formatAppVersionLabel, getAppBuildId } from '../../pwa/appBuildId'
import { canAccessBetaFeedback, getDeclaredAgeForAvis } from '../../services/betaFeedbackAccess'
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
import {
  createAvisAntiDoublonKey,
  submitAvisBeta,
  type AvisType,
} from '../../services/convexAvisBetaService'

const TEXTE_MIN = 10
const TEXTE_MAX = 2000
const COUNTER_FROM = 1800
const DRAFT_KEY = 'ranked-gym:avis-beta-draft'

type Phase = 'form' | 'insult' | 'success' | 'urgent_tca' | 'urgent_suicide' | 'blocked'

interface BetaFeedbackScreenProps {
  onBack: () => void
  onOpenNeedToTalk: () => void
  initialPage?: string
}

type DraftState = {
  type: AvisType | null
  texte: string
  page: string
  consent: boolean
}

function readDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DraftState
  } catch {
    return null
  }
}

function writeDraft(draft: DraftState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function resolveInitialPage(explicit?: string): BetaFeedbackPage {
  const fromNav = explicit ?? consumeBetaFeedbackPrefillPage()
  if (fromNav && isBetaFeedbackPage(fromNav)) return fromNav
  return 'Réglages'
}

export function BetaFeedbackScreen({
  onBack,
  onOpenNeedToTalk,
  initialPage,
}: BetaFeedbackScreenProps) {
  const allowed = canAccessBetaFeedback()
  const declaredAge = getDeclaredAgeForAvis()
  const versionId = getAppBuildId()
  const versionLabel = formatAppVersionLabel(versionId)

  const draft = useMemo(() => readDraft(), [])
  const [phase, setPhase] = useState<Phase>(() => (allowed ? 'form' : 'blocked'))
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
  const [offlineQueued, setOfflineQueued] = useState(false)
  const [antiDoublonKey, setAntiDoublonKey] = useState(() => createAvisAntiDoublonKey())
  const [forceInsults, setForceInsults] = useState(false)

  useEffect(() => {
    wireAvisQueueLifecycleOnce()
  }, [])

  useEffect(() => {
    if (phase !== 'form' && phase !== 'insult') return
    writeDraft({ type, texte, page, consent: false })
  }, [type, texte, page, phase])

  const trimmedLen = texte.trim().length
  const tooShort = trimmedLen > 0 && trimmedLen < TEXTE_MIN
  const canSubmit =
    allowed &&
    declaredAge != null &&
    type != null &&
    trimmedLen >= TEXTE_MIN &&
    trimmedLen <= TEXTE_MAX &&
    consent &&
    !sending

  const metaLine = `${BETA_FEEDBACK_PAGE_LABEL} : ${page} · ${BETA_FEEDBACK_VERSION_LABEL} ${versionId}. ${BETA_FEEDBACK_META_HINT}`

  const handleTexteChange = (value: string) => {
    if (value.length > TEXTE_MAX) {
      setTexte(value.slice(0, TEXTE_MAX))
      setError(BETA_FEEDBACK_TOO_LONG)
      return
    }
    setTexte(value)
    if (error === BETA_FEEDBACK_TOO_LONG || error === BETA_FEEDBACK_EMPTY) {
      setError(null)
    }
  }

  const doSubmit = async (forcerEnvoiAvecInsultes: boolean) => {
    if (!type || declaredAge == null) return
    setSending(true)
    setError(null)
    setOfflineQueued(false)

    const payload = {
      type,
      texte: texte.trim(),
      page,
      version: versionId,
      cleAntiDoublon: antiDoublonKey,
      consentementAccepte: true as const,
      declaredAge,
      forcerEnvoiAvecInsultes: forcerEnvoiAvecInsultes || undefined,
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (offline) {
      try {
        enqueueAvisOffline(payload)
        setOfflineQueued(true)
        setError(BETA_FEEDBACK_OFFLINE)
      } catch {
        setError(BETA_FEEDBACK_ERROR_SEND)
      } finally {
        setSending(false)
      }
      return
    }

    try {
      const result = await submitAvisBeta(payload)
      if (!result.ok) {
        if (result.needsReformulation || result.reason === 'insults') {
          setForceInsults(false)
          setPhase('insult')
          setSending(false)
          return
        }
        if (result.error === 'AVIS_BETA_DAILY_LIMIT') {
          setError(BETA_FEEDBACK_DAILY_LIMIT)
          setSending(false)
          return
        }
        if (result.error === 'AVIS_BETA_AGE_REQUIRED') {
          setPhase('blocked')
          setSending(false)
          return
        }
        setError(BETA_FEEDBACK_ERROR_SEND)
        setSending(false)
        return
      }

      clearDraft()
      setAntiDoublonKey(createAvisAntiDoublonKey())
      if (result.distressLevel === 2) setPhase('urgent_suicide')
      else if (result.distressLevel === 1) setPhase('urgent_tca')
      else setPhase('success')
    } catch {
      setError(BETA_FEEDBACK_ERROR_SEND)
    } finally {
      setSending(false)
    }
  }

  const onSubmitClick = () => {
    if (!type) return
    if (trimmedLen < TEXTE_MIN) {
      setError(BETA_FEEDBACK_EMPTY)
      return
    }
    if (!consent) return
    void doSubmit(forceInsults)
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
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="ios-press rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-[15px] font-semibold text-white"
            onClick={() => {
              setForceInsults(false)
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

      <div className="space-y-2" role="group" aria-label="Type d’avis">
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
          Ton avis
        </label>
        <textarea
          id="beta-feedback-texte"
          value={texte}
          onChange={(e) => handleTexteChange(e.target.value)}
          rows={6}
          maxLength={TEXTE_MAX}
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
        {tooShort || (trimmedLen === 0 && error === BETA_FEEDBACK_EMPTY) ? (
          <p className="text-[13px] text-[#FF6961]">{BETA_FEEDBACK_EMPTY}</p>
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
        <p className="text-[12px] text-[#636366]">{versionLabel}</p>
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

      {error ? (
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
            <p className="text-[12px] text-[#AEAEB2]">Brouillon conservé sur cet appareil.</p>
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
        Retour
      </button>
    </header>
  )
}
