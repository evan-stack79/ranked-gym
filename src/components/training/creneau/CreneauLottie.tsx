import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LottieHandle } from 'lottie-react'

type AnimationData = object

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return reduced
}

const LazyLottieLight = lazy(async () => {
  await import('lottie-web/build/player/lottie_light')
  const mod = await import('lottie-react')
  return { default: mod.LottieLight }
})

export function CreneauLottie({
  playing = true,
  className,
  style,
}: {
  playing?: boolean
  className?: string
  style?: CSSProperties
}) {
  const reduced = usePrefersReducedMotion()
  const [data, setData] = useState<AnimationData | null>(null)
  const handleRef = useRef<LottieHandle | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('../../../assets/lottie/creneau/exercise-for-diet-or-health_rouge.json').then(
      (mod) => {
        if (!cancelled) setData(mod.default as AnimationData)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const h = handleRef.current
    if (!h || !data) return
    if (reduced || !playing) {
      h.seek(0)
      h.pause()
      return
    }
    h.play()
  }, [data, playing, reduced])

  if (!data) {
    return <div className={className} style={style} aria-hidden data-creneau-lottie="loading" />
  }

  return (
    <div className={className} style={style} aria-hidden data-creneau-lottie="exercise">
      <Suspense fallback={null}>
        <LazyLottieLight
          lottieRef={handleRef}
          src={data}
          loop={!reduced}
          autoplay={!reduced && playing}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  )
}
