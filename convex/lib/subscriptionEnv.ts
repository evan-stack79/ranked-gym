/** Convex-safe env read (avoid bare `process` for tsc convex typecheck). */
export function readSubscriptionEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}
