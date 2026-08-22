import { getSupabaseConfigError, isSupabaseConfigured } from '../../lib/supabase'

/** Bandeau visible en prod si les variables VITE_SUPABASE_* manquent au build. */
export function SupabaseConfigBanner() {
  if (isSupabaseConfigured()) return null

  const message = getSupabaseConfigError()

  return (
    <div
      className="sticky top-0 z-[100] border-b border-[#FF453A]/40 bg-[#2C1014]/95 px-4 py-3 backdrop-blur-md"
      role="alert"
    >
      <p className="text-[13px] font-semibold text-[#FF6961]">Supabase non configuré</p>
      <p className="mt-1 text-[12px] leading-snug text-[#EBEBF5]/90">{message}</p>
      <p className="mt-2 text-[11px] text-[#8E8E93]">
        Cloudflare → Settings → Environment variables → Production → redéploie après ajout.
      </p>
    </div>
  )
}
