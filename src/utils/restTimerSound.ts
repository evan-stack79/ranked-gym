/**
 * Petit chime de fin de repos (Web Audio).
 * Sur iOS / Android, le mode silencieux peut couper le son — on ignore l’erreur.
 */
export function playRestCompleteChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const playTone = (freq: number, start: number, dur: number, gain = 0.18) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(gain, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }

    void ctx.resume()
    playTone(784, now, 0.14, 0.16) // G5
    playTone(1046.5, now + 0.13, 0.22, 0.2) // C6

    window.setTimeout(() => {
      void ctx.close()
    }, 600)
  } catch {
    // silent / blocked
  }
}
