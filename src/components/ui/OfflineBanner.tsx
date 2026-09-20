import { USER_OFFLINE_LABEL } from '../../boot/bootUiCopy'

/** Pastille non bloquante — n’interrompt aucun chargement. */
export function OfflineBanner() {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] -translate-x-1/2"
      role="status"
      aria-live="polite"
      data-offline-banner="1"
    >
      <p className="rounded-full border border-white/15 bg-[#1C1C1E]/92 px-3 py-1 text-[12px] font-semibold text-[#AEAEB2] shadow-lg backdrop-blur-md">
        {USER_OFFLINE_LABEL}
      </p>
    </div>
  )
}
