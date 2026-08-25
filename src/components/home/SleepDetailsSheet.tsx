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

  return (
    <IosSheet open={open} onClose={onClose} title="Détails sommeil" subtitle="Informations du moteur V1">
      <div className="space-y-4 pb-3">
        {!snapshot.hasData || !engine ? (
          <p className="text-[14px] text-[#8E8E93]">Aucune nuit enregistrée.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Quantité
              </p>
              <p className="mt-1 text-[20px] font-bold text-white">{snapshot.tstLabel}</p>
              <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{snapshot.statusLabel}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Régularité
              </p>
              {snapshot.insufficientHistory ? (
                <p className="mt-1 text-[13px] text-[#AEAEB2]">
                  Historique insuffisant — continue d&apos;enregistrer tes nuits. Ce n&apos;est pas un
                  mauvais score.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-[13px] text-[#AEAEB2]">
                  <li>
                    σ coucher :{' '}
                    {engine.metrics.regularity.bedtimeVariabilityMinutes != null
                      ? `${Math.round(engine.metrics.regularity.bedtimeVariabilityMinutes)} min`
                      : '—'}
                  </li>
                  <li>
                    σ lever :{' '}
                    {engine.metrics.regularity.waketimeVariabilityMinutes != null
                      ? `${Math.round(engine.metrics.regularity.waketimeVariabilityMinutes)} min`
                      : '—'}
                  </li>
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Efficacité (TST / TIB)
              </p>
              <p className="mt-1 text-[13px] text-[#AEAEB2]">
                {engine.metrics.efficiency.sleepEfficiencyPercent != null
                  ? `${engine.metrics.efficiency.sleepEfficiencyPercent.toFixed(0)} %`
                  : 'Non calculable (TIB manquant)'}
              </p>
            </div>

            {engine.metrics.catchUp.recoveryNeeded && (
              <div className="rounded-2xl border border-[#FF9F0A]/25 bg-[#FF9F0A]/10 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9F0A]">
                  Récupération
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
                  Moyenne jours travaillés basse — suggestion informative, pas une prescription
                  médicale.
                </p>
              </div>
            )}

            {snapshot.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Recommandations
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
