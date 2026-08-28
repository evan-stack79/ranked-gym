import { IosSheet } from '../ui/IosSheet'
import type { SleepHomeViewModel } from '../../services/sleepEngineAdapter'

interface SleepDetailsSheetProps {
  open: boolean
  onClose: () => void
  snapshot: SleepHomeViewModel
  onEditNight: () => void
}

export function SleepDetailsSheet({
  open,
  onClose,
  snapshot,
  onEditNight,
}: SleepDetailsSheetProps) {
  const engine = snapshot.engine

  const tonightBlock =
    snapshot.tonightHint && snapshot.hasData ? (
      <div className="rounded-2xl border border-white/8 bg-black/25 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Ce soir
        </p>
        <p className="mt-1 text-[14px] leading-snug text-[#E5E5EA]">{snapshot.tonightHint}</p>
        {snapshot.tonightBedtimeLabel ? (
          <p className="mt-1 text-[12px] text-[#8E8E93]">
            Coucher suggéré : {snapshot.tonightBedtimeLabel}
          </p>
        ) : null}
      </div>
    ) : null

  return (
    <IosSheet open={open} onClose={onClose} title="Ta nuit" subtitle="Ce qu’on peut en dire">
      <div className="space-y-4 pb-3">
        {!snapshot.hasData ? (
          <p className="text-[14px] text-[#8E8E93]">Aucune nuit enregistrée.</p>
        ) : !snapshot.tstKnown || !engine ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Temps passé au lit
              </p>
              <p className="mt-1 text-[20px] font-bold text-white">
                {snapshot.tibLabel ?? '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Combien tu as dormi
              </p>
              <p className="mt-1 text-[20px] font-bold text-white">inconnu</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
                Sans cette info, on ne peut pas juger ta récupération — et on n&apos;invente pas
                d&apos;heures de sommeil à partir du temps passé au lit.
              </p>
            </div>

            {snapshot.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  À retenir
                </p>
                <ul className="space-y-2">
                  {snapshot.recommendations.map((r) => (
                    <li
                      key={r.slice(0, 48)}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-relaxed text-[#AEAEB2]"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {snapshot.insufficientHistory && (
              <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
                Encore peu de nuits enregistrées pour voir si tes horaires sont stables — ce
                n&apos;est pas un mauvais signe.
              </p>
            )}

            {tonightBlock}
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Combien tu as dormi
              </p>
              <p className="mt-1 text-[20px] font-bold text-white">{snapshot.tstLabel}</p>
              <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{snapshot.statusLabel}</p>
              {snapshot.tibLabel && (
                <p className="mt-1 text-[12px] text-[#8E8E93]">
                  {snapshot.tibLabel} passées au lit
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Stabilité des horaires
              </p>
              {snapshot.insufficientHistory ? (
                <p className="mt-1 text-[13px] text-[#AEAEB2]">
                  Encore trop peu de nuits pour juger si tes horaires sont stables. Continue
                  d&apos;enregistrer — ce n&apos;est pas un mauvais signe.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-[13px] text-[#AEAEB2]">
                  <li>
                    Coucher qui varie d&apos;environ{' '}
                    {engine.metrics.regularity.bedtimeVariabilityMinutes != null
                      ? `${Math.round(engine.metrics.regularity.bedtimeVariabilityMinutes)} min`
                      : '—'}
                  </li>
                  <li>
                    Lever qui varie d&apos;environ{' '}
                    {engine.metrics.regularity.waketimeVariabilityMinutes != null
                      ? `${Math.round(engine.metrics.regularity.waketimeVariabilityMinutes)} min`
                      : '—'}
                  </li>
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Part du temps au lit vraiment dormie
              </p>
              <p className="mt-1 text-[13px] text-[#AEAEB2]">
                {engine.metrics.efficiency.sleepEfficiencyPercent != null
                  ? `${engine.metrics.efficiency.sleepEfficiencyPercent.toFixed(0)} %`
                  : 'Impossible à calculer pour cette nuit'}
              </p>
            </div>

            {engine.metrics.catchUp.recoveryNeeded && (
              <div className="rounded-2xl border border-[#FF9F0A]/25 bg-[#FF9F0A]/10 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9F0A]">
                  Récupération
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
                  Tu as dormi un peu court en semaine — une piste informative, pas un conseil
                  médical.
                </p>
              </div>
            )}

            {snapshot.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  À retenir
                </p>
                <ul className="space-y-2">
                  {snapshot.recommendations.map((r) => (
                    <li
                      key={r.slice(0, 48)}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-relaxed text-[#AEAEB2]"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {snapshot.warnings.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#FF6961]">
                  Points d&apos;attention
                </p>
                <ul className="space-y-2">
                  {snapshot.warnings.map((w) => (
                    <li
                      key={w.slice(0, 48)}
                      className="rounded-xl border border-[#FF6961]/20 bg-[#FF2B2B]/10 px-3 py-2 text-[12px] leading-relaxed text-[#FFCCCB]"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tonightBlock}
          </>
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            onEditNight()
          }}
          className="ios-press w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[14px] font-semibold text-white"
        >
          {snapshot.hasData ? 'Modifier / enregistrer une nuit' : 'Enregistrer ma nuit'}
        </button>
      </div>
    </IosSheet>
  )
}
