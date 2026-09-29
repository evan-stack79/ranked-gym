const sessionHeroPlayed = new Set<string>()

/** First call animates; later calls in this JS session stay static. */
export function takeSessionHeroReveal(id: string): boolean {
  if (sessionHeroPlayed.has(id)) return false
  sessionHeroPlayed.add(id)
  return true
}

export const HERO_BLUR_PROPS = {
  speedReveal: 1.2,
  speedSegment: 0.55,
} as const
