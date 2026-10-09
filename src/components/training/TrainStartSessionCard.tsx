/** Grande carte démarrer / reprendre — même chemin que le ▶ de la barre. */
export function TrainStartSessionCard({
  onStart,
  resume = false,
}: {
  onStart: () => void
  /** Active draft → « Reprendre ma séance », otherwise « Commencer ma séance ». */
  resume?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="ios-press flex w-full flex-col items-start gap-2 rounded-3xl border border-brand/40 bg-brand px-5 py-6 text-left shadow-[0_12px_40px_rgba(255,43,43,0.28)]"
      data-testid="train-start-session-card"
      data-resume={resume ? '1' : undefined}
    >
      <span className="text-[26px] font-bold leading-tight text-white">
        {resume ? 'Reprendre ma séance' : 'Commencer ma séance'}
      </span>
      <span className="text-[14px] text-white/85">
        {resume ? 'Continue là où tu t’es arrêté.' : 'Lance ta séance en un geste.'}
      </span>
    </button>
  )
}
