/**
 * Carte « Classement de ma salle » — visible seulement si le flag est ON.
 * Sans le code PR #101 sur main : placeholder neutre (rien d’actif).
 */
import { isGymLeaderboardEnabled } from '../../backend/gymLeaderboardFeatureFlag'

export function TrainGymLeaderboardCard() {
  if (!isGymLeaderboardEnabled()) return null

  return (
    <section
      className="rounded-3xl border border-white/10 bg-[#141416] p-4"
      data-testid="train-gym-leaderboard-card"
      data-leaderboard-placeholder="1"
    >
      <h2 className="text-[16px] font-semibold text-white">Classement de ma salle</h2>
      <p className="mt-1 text-[13px] text-[#8E8E93]">
        Bientôt disponible. Une séance Train ne donne jamais de points.
      </p>
    </section>
  )
}
