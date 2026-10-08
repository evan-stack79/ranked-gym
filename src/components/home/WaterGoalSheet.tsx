import { WaterGoalChooser } from '../nutrition/WaterGoalChooser'
import { IosSheet } from '../ui/IosSheet'
import { clearUserWaterGoal } from '../../utils/userWaterGoal'

interface WaterGoalSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Accueil Eau goal sheet — delegates to shared WaterGoalChooser / userWaterGoal.
 * No prefs.waterGoalMl, no weight formula, no bound numbers in copy.
 */
export function WaterGoalSheet({ open, onClose }: WaterGoalSheetProps) {
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Objectif d'eau"
      subtitle="Choisis un objectif journalier — uniquement si tu en veux un."
      footer={
        <button
          type="button"
          onClick={() => {
            clearUserWaterGoal()
            onClose()
          }}
          className="ios-press min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-[#AEAEB2]"
          data-accueil-water-goal-clear
        >
          Pas d&apos;objectif
        </button>
      }
    >
      <WaterGoalChooser
        defaultOpen
        inputId="accueil-water-goal-input"
        onSaved={() => onClose()}
        className="px-1"
      />
    </IosSheet>
  )
}
