/**
 * Hold silencieux pendant la restauration de session.
 * Aucun libellé technique (« Chargement », « Récupération des données », jargon VITE).
 */
export function AppBootScreen() {
  return (
    <div
      className="flex h-[100dvh] items-center justify-center bg-[#070708]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Ranked Gym"
      data-session-restore="1"
    >
      <img
        src="/brand-splash-calm.png"
        alt=""
        width={180}
        height={180}
        decoding="async"
        className="h-[180px] w-[180px] object-contain"
      />
    </div>
  )
}
