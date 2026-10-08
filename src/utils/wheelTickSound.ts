/**
 * Soft click for the number wheel — Web Audio only (no files, no npm lib).
 * Respects iPhone silent switch via `navigator.audioSession.type = 'ambient'`
 * when available. No app sound preference exists yet → on by default.
 */

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AudioCtx()
      // iOS: ambient → silent switch mutes; don't interrupt other audio.
      const nav = navigator as Navigator & {
        audioSession?: { type: string }
      }
      if (nav.audioSession) {
        try {
          nav.audioSession.type = 'ambient'
        } catch {
          /* ignore */
        }
      }
    }
    return sharedCtx
  } catch {
    return null
  }
}

/** Very soft short click — identical for every value. */
export function playWheelTickSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    void ctx.resume()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1800, now)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.035, now + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.028)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.04)
  } catch {
    // silent / blocked
  }
}
