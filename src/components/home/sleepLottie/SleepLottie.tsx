import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { LottieHandle } from 'lottie-react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'

export type SleepLottieAnimationName =
  | 'sleepy-moon'
  | 'its-sleeptime'
  | 'alarm'
  | 'sunset-sunrise'
  | 'sparkle-twinkle-stars'
  | 'success-checkmark'
  | 'moon'
  | 'sunrise'

type AnimationData = object

const LOADERS: Record<SleepLottieAnimationName, () => Promise<AnimationData>> = {
  'sleepy-moon': () =>
    import('../../../assets/lottie/sleep/sleepy-moon.json').then((m) => m.default as AnimationData),
  'its-sleeptime': () =>
    import('../../../assets/lottie/sleep/its-sleeptime.json').then((m) => m.default as AnimationData),
  alarm: () =>
    import('../../../assets/lottie/sleep/alarm.json').then((m) => m.default as AnimationData),
  'sunset-sunrise': () =>
    import('../../../assets/lottie/sleep/sunset-sunrise.json').then((m) => m.default as AnimationData),
  'sparkle-twinkle-stars': () =>
    import('../../../assets/lottie/sleep/sparkle-twinkle-stars.json').then(
      (m) => m.default as AnimationData,
    ),
  'success-checkmark': () =>
    import('../../../assets/lottie/sleep/success-checkmark.json').then(
      (m) => m.default as AnimationData,
    ),
  moon: () =>
    import('../../../assets/lottie/sleep/moon.json').then((m) => m.default as AnimationData),
  sunrise: () =>
    import('../../../assets/lottie/sleep/sunrise.json').then((m) => m.default as AnimationData),
}

/**
 * Lazy chunk: LottieLight (SVG light build). Also pins
 * `lottie-web/build/player/lottie_light` so the light player is in the graph.
 */
const LazyLottieLight = lazy(async () => {
  await import('lottie-web/build/player/lottie_light')
  const mod = await import('lottie-react')
  return { default: mod.LottieLight }
})

export interface SleepLottieProps {
  name: SleepLottieAnimationName
  playing?: boolean
  loop?: boolean
  /** 0 = first frame, 1 = last (reduced-motion static). */
  reducedFrame?: 0 | 1
  className?: string
  style?: CSSProperties
  'aria-hidden'?: boolean
  'data-testid'?: string
  onComplete?: () => void
}

/**
 * Sommeil Lottie — lazy JSON + LottieLight, destroy on unmount.
 * prefers-reduced-motion → static first/last frame, no loop.
 */
export function SleepLottie({
  name,
  playing = true,
  loop = false,
  reducedFrame = 0,
  className,
  style,
  onComplete,
  ...rest
}: SleepLottieProps) {
  const reduced = usePrefersReducedMotion()
  const [data, setData] = useState<AnimationData | null>(null)
  const [failed, setFailed] = useState(false)
  const lottieRef = useRef<LottieHandle | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const reactId = useId()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    void LOADERS[name]()
      .then((animationData) => {
        if (!cancelled) setData(animationData)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [name])

  useEffect(() => {
    const inst = lottieRef.current
    if (!inst || !data) return
    if (reduced) {
      inst.seek(reducedFrame === 1 ? { percent: 100 } : 0)
      inst.pause()
      return
    }
    if (playing) inst.play()
    else {
      inst.seek(0)
      inst.pause()
    }
  }, [playing, reduced, reducedFrame, data])

  useEffect(() => {
    return () => {
      try {
        const item = lottieRef.current?.animationItem
        item?.destroy()
      } catch {
        // ignore
      }
      lottieRef.current = null
    }
  }, [])

  if (failed || !data) {
    return (
      <div
        className={className}
        style={style}
        data-sleep-lottie={name}
        data-sleep-lottie-state={failed ? 'failed' : 'loading'}
        data-sleep-lottie-id={reactId}
        {...rest}
      />
    )
  }

  const effectiveLoop = reduced ? false : loop

  return (
    <div
      className={className}
      style={style}
      data-sleep-lottie={name}
      data-sleep-lottie-state={reduced ? 'static' : playing ? 'playing' : 'paused'}
      data-sleep-lottie-id={reactId}
      {...rest}
    >
      <Suspense fallback={null}>
        <LazyLottieLight
          lottieRef={lottieRef}
          src={data}
          loop={effectiveLoop}
          autoplay={!reduced && playing}
          style={{ width: '100%', height: '100%' }}
          subscriptions={{
            complete: () => {
              if (!reduced) onCompleteRef.current?.()
            },
          }}
        />
      </Suspense>
    </div>
  )
}

export function sleepLottieLoaderNames(): SleepLottieAnimationName[] {
  return Object.keys(LOADERS) as SleepLottieAnimationName[]
}
