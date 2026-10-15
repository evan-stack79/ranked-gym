import { Q10_ENERGIE } from '../../content/safetyCopy'

/** Message énergie/récupération — texte fixe, aucune variable / seuil (Q10). */
export function EnergyRecoveryInfo() {
  return (
    <section className="space-y-2" data-testid="energy-recovery-info">
      <h2 className="text-[15px] font-semibold text-white">Informations</h2>
      <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{Q10_ENERGIE}</p>
    </section>
  )
}
