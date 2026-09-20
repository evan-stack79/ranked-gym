import { USER_BACKEND_UNAVAILABLE } from '../../boot/bootUiCopy'
import { getSupabaseConfigError, isSupabaseConfigured } from '../../lib/supabase'
import { safeError } from '../../utils/safeLog'

let loggedConfigError = false

/** Erreur bloquante de configuration — libellé utilisateur, détail technique en console. */
export function SupabaseConfigBanner() {
  if (isSupabaseConfigured()) return null

  const technical = getSupabaseConfigError()
  if (technical && !loggedConfigError) {
    loggedConfigError = true
    safeError('[boot] backend config', technical)
  }

  return (
    <div
      className="sticky top-0 z-[100] border-b border-[#FF453A]/40 bg-[#2C1014]/95 px-4 py-3 backdrop-blur-md"
      role="alert"
    >
      <p className="text-[13px] font-semibold text-[#FF6961]">{USER_BACKEND_UNAVAILABLE}</p>
    </div>
  )
}
