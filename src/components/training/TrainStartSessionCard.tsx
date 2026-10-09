/** Grande carte « Commencer ma séance » — même chemin que le ▶ de la barre. */
export function TrainStartSessionCard({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="ios-press flex w-full flex-col items-start gap-2 rounded-3xl border border-brand/40 bg-brand px-5 py-6 text-left shadow-[0_12px_40px_rgba(255,43,43,0.28)]"
      data-testid="train-start-session-card"
    >
      <span className="text-[26px] font-bold leading-tight text-white">Commencer ma séance</span>
      <span className="text-[14px] text-white/85">Lance ta séance en un geste.</span>
    </button>
  )
}
