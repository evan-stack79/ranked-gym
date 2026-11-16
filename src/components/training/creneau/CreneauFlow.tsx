import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import {
  CRENEAU_PHRASES,
  CRENEAU_RED,
  type CreneauCrowdLevel,
} from '../../../creneau/constants'
import {
  activationPhrase,
  addMinutes,
  formatDelayMessage,
  isCreneauMinor,
  proposeCreneau,
  summarizeCrowd,
} from '../../../creneau/engine'
import { getCalorieProfile } from '../../../services/nutritionStorage'
import {
  CRENEAU_CHANGED_EVENT,
  ensureDefaultGyms,
  getCreneauSettings,
  recordCrowdTap,
  saveCreneauSettings,
  type CreneauSettings,
} from '../../../services/creneau/storage'
import { CreneauLottie } from './CreneauLottie'

type Pane =
  | 'home'
  | 'gyms'
  | 'evening'
  | 'delay'
  | 'energy'
  | 'checkin'
  | 'delayResult'
  | 'energyResult'

function nowHm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatLongDate(d = new Date()): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function firstName(): string {
  try {
    const raw = localStorage.getItem('ranked-gym:profile')
    if (!raw) return 'toi'
    const p = JSON.parse(raw) as { firstName?: string; prenom?: string; name?: string }
    return (p.firstName || p.prenom || p.name || 'toi').split(' ')[0] || 'toi'
  } catch {
    return 'toi'
  }
}

export function CreneauFlow({ onBack }: { onBack: () => void }) {
  const [pane, setPane] = useState<Pane>('home')
  const [settings, setSettings] = useState<CreneauSettings>(() => ensureDefaultGyms())
  const [delayMin, setDelayMin] = useState(0)
  const [soft, setSoft] = useState(false)
  const [delayResult, setDelayResult] = useState('')
  const [energyResult, setEnergyResult] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const age = getCalorieProfile().age ?? null
  const minor = isCreneauMinor(age)

  useEffect(() => {
    const sync = () => setSettings(getCreneauSettings())
    window.addEventListener(CRENEAU_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CRENEAU_CHANGED_EVENT, sync)
  }, [])

  const proposal = useMemo(() => {
    const fav = settings.favorite
    const bak = settings.backup
    return proposeCreneau({
      age,
      nowHm: nowHm(),
      afterSunset: settings.afterSunset,
      heatVigilance: settings.heatVigilanceToday,
      eveningWalkEnabled: settings.eveningWalkEnabled,
      stafflessGymEnabled: settings.stafflessGymEnabled,
      preferQuiet: settings.preferQuiet,
      softSession: soft,
      delayMin,
      favorite: fav
        ? {
            id: fav.id,
            name: fav.name,
            staffUntilHm: fav.staffUntilHm,
            travelMin: fav.travelFromWorkMin,
          }
        : null,
      backup: bak
        ? {
            id: bak.id,
            name: bak.name,
            staffUntilHm: bak.staffUntilHm,
            travelMin: bak.travelFromWorkMin,
          }
        : null,
      lockerMin: settings.lockerMin,
    })
  }, [age, settings, delayMin, soft])

  const crowd = useMemo(() => {
    const id = proposal.primary?.gymId
    if (!id) return null
    return summarizeCrowd(settings.crowdReports, id, Date.now())
  }, [proposal.primary?.gymId, settings.crowdReports])

  const patch = useCallback((p: Partial<CreneauSettings>) => {
    setSettings(saveCreneauSettings(p))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  const primary = proposal.primary
  const planB = proposal.planB

  return (
    <div className="flex flex-col gap-4" data-creneau-flow data-pane={pane}>
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (pane === 'home') onBack()
            else if (pane === 'delayResult' || pane === 'energyResult' || pane === 'checkin')
              setPane('home')
            else if (pane === 'evening') setPane('gyms')
            else setPane('home')
          }}
          className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#ACB4BA]">
            {pane === 'gyms' || pane === 'evening' ? 'Mon créneau' : 'Sport'}
          </p>
          <h1 className="truncate text-[22px] font-bold tracking-tight text-white">
            {pane === 'gyms'
              ? 'Mes salles'
              : pane === 'evening'
                ? 'Le soir'
                : 'Mon créneau'}
          </h1>
        </div>
        {pane === 'home' ? (
          <button
            type="button"
            onClick={() => setPane('gyms')}
            className="text-[13px] font-semibold text-[#ACB4BA]"
          >
            Salles
          </button>
        ) : null}
      </header>

      {toast ? (
        <div
          className="rounded-2xl px-4 py-3 text-[14px] font-medium text-white"
          style={{ background: `${CRENEAU_RED}33`, border: `1px solid ${CRENEAU_RED}66` }}
          data-creneau-toast
        >
          {toast}
        </div>
      ) : null}

      {pane === 'home' ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] capitalize text-[#ACB4BA]">{formatLongDate()}</p>
          <div className="flex items-center gap-3">
            <CreneauLottie className="h-14 w-14 shrink-0" />
            <div>
              <p className="text-[17px] font-semibold text-white">
                Salut {firstName()}&nbsp;!
              </p>
              <p className="text-[13px] text-[#ACB4BA]">
                {primary
                  ? 'Ton créneau de ce soir est prêt.'
                  : 'Aucun créneau sûr pour l’instant.'}
              </p>
            </div>
          </div>

          {settings.heatVigilanceToday ? (
            <div
              className="rounded-2xl px-4 py-3 text-[14px] text-white"
              style={{ border: `1px solid ${CRENEAU_RED}55`, background: `${CRENEAU_RED}18` }}
              data-creneau-heat
            >
              <p className="font-semibold">{CRENEAU_PHRASES.heatVigilance}</p>
              <p className="mt-1 text-[#ACB4BA]">{CRENEAU_PHRASES.takeBottle}</p>
            </div>
          ) : null}

          {minor ? (
            <p className="text-[12px] leading-snug text-[#ACB4BA]" data-creneau-minor-help>
              {CRENEAU_PHRASES.minorEveningHelp}
            </p>
          ) : null}

          {primary ? (
            <div
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
              data-creneau-slot
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
                    Ce soir
                  </p>
                  <p className="text-[28px] font-bold tabular-nums text-white">
                    {primary.sessionStartHm}
                    <span className="text-[16px] font-semibold text-[#ACB4BA]">
                      {' '}
                      – {primary.sessionEndHm}
                    </span>
                  </p>
                </div>
                {minor ? (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ background: CRENEAU_RED }}
                    data-creneau-minor-badge
                  >
                    {CRENEAU_PHRASES.minorHomeBadge}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[14px] text-white">
                <MapPin className="h-4 w-4 text-[#ACB4BA]" aria-hidden />
                <span>
                  {primary.gymName}
                  {primary.favorite ? (
                    <span className="text-[#ACB4BA]"> · favorite</span>
                  ) : null}
                </span>
              </div>
              {crowd?.level ? (
                <p className="mt-2 text-[13px] text-[#ACB4BA]">
                  {crowd.label} pour ta salle
                  <span className="text-white/70"> · {crowd.confidenceLabel}</span>
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-[#ACB4BA]">on apprend ta salle</p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  [primary.departureHm, 'Départ'],
                  [primary.sessionStartHm, 'Séance'],
                  [primary.returnHm, 'Retour'],
                ].map(([t, l]) => (
                  <div key={l} className="rounded-2xl bg-black/30 px-2 py-2">
                    <p className="text-[15px] font-bold tabular-nums text-white">{t}</p>
                    <p className="text-[11px] text-[#ACB4BA]">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="ios-press flex-1 rounded-2xl py-3 text-[15px] font-bold text-white"
                  style={{ background: CRENEAU_RED }}
                  onClick={() => setPane('checkin')}
                >
                  OK
                </button>
                <button
                  type="button"
                  className="ios-press flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-[15px] font-semibold text-white"
                  onClick={() => {
                    if (planB) {
                      showToast(`Autre créneau : ${planB.sessionStartHm} · ${planB.gymName}`)
                    } else {
                      showToast('Pas d’autre créneau sûr pour l’instant.')
                    }
                  }}
                >
                  Autre créneau
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-[#ACB4BA]">
              Règle tes salles ou assouplis « Le soir » si tu es adulte.
            </p>
          )}

          {planB ? (
            <button
              type="button"
              onClick={() => showToast(`Plan B : ${planB.sessionStartHm} · ${planB.gymName}`)}
              className="ios-press flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
              data-creneau-planb
            >
              <span className="text-[11px] font-bold uppercase text-[#ACB4BA]">Plan B</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  {planB.sessionStartHm} · {planB.gymName}
                </span>
                <span className="text-[12px] text-[#ACB4BA]">Moyen · à confirmer</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#ACB4BA]" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setPane('delay')}
            className="ios-press flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left"
            data-creneau-delay
          >
            <span className="font-semibold text-white">Je suis en retard</span>
            <ChevronRight className="h-4 w-4 text-[#ACB4BA]" />
          </button>
          <button
            type="button"
            onClick={() => setPane('energy')}
            className="ios-press flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left"
            data-creneau-energy
          >
            <span className="font-semibold text-white">Pas d&apos;énergie aujourd&apos;hui</span>
            <ChevronRight className="h-4 w-4 text-[#ACB4BA]" />
          </button>
        </div>
      ) : null}

      {pane === 'gyms' ? (
        <div className="flex flex-col gap-4">
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
                    {g.closesHm ? <li>Ferme à {g.closesHm}</li> : null}
                  </ul>
                ) : null}
              </div>
            )
          })}
          <p className="text-[12px] text-[#ACB4BA]">Réglé une seule fois</p>
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
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span>
              <span className="block font-semibold text-white">Créneau tranquille</span>
              <span className="text-[12px] text-[#ACB4BA]">Moins de monde</span>
            </span>
            <input
              type="checkbox"
              checked={settings.preferQuiet}
              onChange={(e) => patch({ preferQuiet: e.target.checked })}
              className="h-5 w-5 accent-[#ff0702]"
            />
          </label>
          <p className="flex gap-2 text-[12px] leading-snug text-[#ACB4BA]">
            {CRENEAU_PHRASES.sameProtectiveSetting}
          </p>
        </div>
      ) : null}

      {pane === 'evening' ? (
        <div className="flex flex-col gap-4" data-creneau-evening>
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
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="font-semibold text-white">Après le coucher du soleil</span>
            <input
              type="checkbox"
              checked={settings.afterSunset}
              onChange={(e) => patch({ afterSunset: e.target.checked })}
              className="h-5 w-5 accent-[#ff0702]"
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="font-semibold text-white">Vigilance chaleur (aujourd&apos;hui)</span>
            <input
              type="checkbox"
              checked={settings.heatVigilanceToday}
              onChange={(e) => patch({ heatVigilanceToday: e.target.checked })}
              className="h-5 w-5 accent-[#ff0702]"
            />
          </label>
        </div>
      ) : null}

      {pane === 'delay' ? (
        <div className="flex flex-col gap-3" data-creneau-delay-pane>
          <p className="text-[14px] text-[#ACB4BA]">Combien de retard&nbsp;?</p>
          {[15, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              className="ios-press rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-[17px] font-bold text-white"
              onClick={() => {
                setDelayMin(m)
                const start = addMinutes(primary?.sessionStartHm ?? nowHm(), m)
                const ret = addMinutes(primary?.returnHm ?? nowHm(), m)
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
          <p className="text-[16px] font-semibold text-white">{CRENEAU_PHRASES.softSessionAsk}</p>
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
            Décaler à demain
          </button>
        </div>
      ) : null}

      {pane === 'energyResult' ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[16px] text-white">{energyResult}</p>
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

      {pane === 'checkin' && primary?.gymId ? (
        <div className="flex flex-col gap-4" data-creneau-checkin>
          <CreneauLottie className="mx-auto h-20 w-20" />
          <p className="text-center text-[18px] font-bold text-white">{primary.gymName}</p>
          <p className="text-center text-[16px] text-white">{CRENEAU_PHRASES.onSiteAsk}</p>
          <p className="text-center text-[12px] text-[#ACB4BA]">1 tap, c&apos;est anonyme.</p>
          <div className="grid grid-cols-3 gap-2">
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
                  showToast('Merci — c’est noté.')
                  setPane('home')
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-center text-[12px] leading-snug text-[#ACB4BA]">
            {CRENEAU_PHRASES.crowdFromCheckins}
          </p>
        </div>
      ) : null}
    </div>
  )
}
