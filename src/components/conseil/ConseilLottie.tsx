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
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type AnimationData = object

const SLEEP_CONSEIL_LOADERS: Record<number, () => Promise<AnimationData>> = {
  1: () =>
    import('../../assets/lottie/sleep/conseil/etat_01_yawn-emoji-animation-BTMojkxiZj_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  2: () =>
    import(
      '../../assets/lottie/sleep/conseil/etat_02_sunrise-breathe-in-breathe-out-ARNUGRJsip_rouge.json'
    ).then((m) => m.default as AnimationData),
  3: () =>
    import('../../assets/lottie/sleep/conseil/etat_03_coffee-cup-ecRJzEVU8v_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  4: () =>
    import('../../assets/lottie/sleep/conseil/etat_04_deadlineloading-sfdQVWPU5y_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  5: () =>
    import('../../assets/lottie/sleep/conseil/etat_05_walk-cycling-shoes-iiDnebYJPZ_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  6: () =>
    import('../../assets/lottie/sleep/conseil/etat_06_pendulum-clock-8rwiOpmBuu_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  7: () =>
    import('../../assets/lottie/sleep/conseil/etat_07_cute-owl-C1cOxhu3ZT_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  8: () =>
    import('../../assets/lottie/sleep/conseil/etat_08_time-management-j2FRhLVj2z_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  9: () =>
    import(
      '../../assets/lottie/sleep/conseil/etat_09_sloth-doing-meditation-VwgVfhsoRF_rouge.json'
    ).then((m) => m.default as AnimationData),
  10: () =>
    import(
      '../../assets/lottie/sleep/conseil/etat_10_ssssttt-shut-up-the-cat-is-sleeping-iqnOJKMcdA_rouge.json'
    ).then((m) => m.default as AnimationData),
  11: () =>
    import(
      '../../assets/lottie/sleep/conseil/etat_11_character-reading-book-B8naMLd1MY_rouge.json'
    ).then((m) => m.default as AnimationData),
  12: () =>
    import('../../assets/lottie/sleep/conseil/etat_12_thumbs-up-YW8slYhn6f_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
}

const HYDRATION_CONSEIL_LOADERS: Record<number, () => Promise<AnimationData>> = {
  1: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_01_woman-driving-car-WicviHTLLr_rouge.json'
    ).then((m) => m.default as AnimationData),
  2: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_02_grandmother-knitting-sweater-0jpA857Yq1_rouge.json'
    ).then((m) => m.default as AnimationData),
  3: () =>
    import('../../assets/lottie/hydration/conseil/etat_03_relax-ST5Q6hW18N_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  4: () =>
    import('../../assets/lottie/hydration/conseil/etat_04_kyte-4aRhVKd1S3_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  5: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_05_love-yourself-kdqnzsXk9z_rouge.json'
    ).then((m) => m.default as AnimationData),
  6: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_06_watering-plantsgardening-HguHVz0uof_rouge.json'
    ).then((m) => m.default as AnimationData),
  7: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_07_tumbler-cups-with-straws-pMuCA6R96e_rouge.json'
    ).then((m) => m.default as AnimationData),
  8: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_08_seated-dumbbell-bicep-curl-OdCvI1MX12_rouge.json'
    ).then((m) => m.default as AnimationData),
  9: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_09_sweet-teapot-with-autumn-herbs-and-birds-kEFHH6SyPx_rouge.json'
    ).then((m) => m.default as AnimationData),
  10: () =>
    import(
      '../../assets/lottie/hydration/conseil/etat_10_hand-click-gesture-oG1gya44TC_rouge.json'
    ).then((m) => m.default as AnimationData),
}

const LazyLottieLight = lazy(async () => {
  try {
    await import('lottie-web/build/player/lottie_light')
    const mod = await import('lottie-react')
    return { default: mod.LottieLight }
  } catch {
    // jsdom / missing canvas — keep the tip card text, skip the animation.
    return {
      default: function ConseilLottieFallback({
        className,
        style,
      }: {
        className?: string
        style?: CSSProperties
      }) {
        return <div className={className} style={style} aria-hidden data-conseil-lottie="fallback" />
      },
    }
  }
})

export interface ConseilLottieProps {
  kind: 'sleep' | 'hydration'
  etatId: number
  playing?: boolean
  className?: string
  style?: CSSProperties
}

export function ConseilLottie({
  kind,
  etatId,
  playing = true,
  className,
  style,
}: ConseilLottieProps) {
  const reduced = usePrefersReducedMotion()
  const [data, setData] = useState<AnimationData | null>(null)
  const handleRef = useRef<LottieHandle | null>(null)
  const reactId = useId()

  useEffect(() => {
    let cancelled = false
    const loader =
      kind === 'sleep' ? SLEEP_CONSEIL_LOADERS[etatId] : HYDRATION_CONSEIL_LOADERS[etatId]
    if (!loader) return
    void loader().then((json) => {
      if (!cancelled) setData(json)
    })
    return () => {
      cancelled = true
    }
  }, [kind, etatId])

  useEffect(() => {
    const h = handleRef.current
    if (!h || !data) return
    if (reduced || !playing) {
      h.seek(0)
      h.pause()
    } else {
      h.play()
    }
  }, [data, playing, reduced])

  if (!data) {
    return <div className={className} style={style} aria-hidden data-conseil-lottie="loading" />
  }

  return (
    <Suspense fallback={<div className={className} style={style} aria-hidden />}>
      <LazyLottieLight
        key={`${kind}-${etatId}-${reactId}`}
        lottieRef={handleRef}
        src={data}
        loop={!reduced}
        autoplay={!reduced && playing}
        style={{ width: '100%', height: '100%', ...(style ?? {}) }}
        className={className}
        aria-hidden
        data-conseil-lottie={`${kind}-${etatId}`}
      />
    </Suspense>
  )
}
