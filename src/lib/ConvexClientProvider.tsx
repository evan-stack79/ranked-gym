import { type ReactNode } from 'react'
import { ConvexProvider } from 'convex/react'
import { getConvex, isConvexConfigured } from './convex'

/**
 * Mounts ConvexProvider only when VITE_CONVEX_URL is a real deployment URL.
 * Default builds have no URL → passthrough, Supabase path unchanged.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!isConvexConfigured()) {
    return children
  }
  return <ConvexProvider client={getConvex()}>{children}</ConvexProvider>
}
