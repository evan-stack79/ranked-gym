import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LottieHandle } from 'lottie-react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'

export type HvLottieId =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'

type AnimationData = object

const LOADERS: Record<HvLottieId, () => Promise<AnimationData>> = {
  '01': () =>
    import('../../../assets/lottie/sleep/horaires-variables/01_swap_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '02': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/02_calendar-booking_rouge.json'
    ).then((m) => m.default as AnimationData),
  '03': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/03_appointment-booking-with-smartphone_rouge.json'
    ).then((m) => m.default as AnimationData),
  '04': () =>
    import('../../../assets/lottie/sleep/horaires-variables/04_deslizar_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '05': () =>
    import('../../../assets/lottie/sleep/horaires-variables/05_bus-ticket_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '06': () =>
    import('../../../assets/lottie/sleep/horaires-variables/06_lazy-cat_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '07': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/07_hammock-loader_rouge.json'
    ).then((m) => m.default as AnimationData),
  '08': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/08_tired-woman_rouge.json'
    ).then((m) => m.default as AnimationData),
  '09': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/09_dark-mode-animation_rouge.json'
    ).then((m) => m.default as AnimationData),
  '10': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/10_indolent-evening_rouge.json'
    ).then((m) => m.default as AnimationData),
  '11': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/11_man-playing-guitar-on-the-sofa_rouge.json'
    ).then((m) => m.default as AnimationData),
  '12': () =>
    import('../../../assets/lottie/sleep/horaires-variables/12_slipper_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '13': () =>
    import('../../../assets/lottie/sleep/horaires-variables/13_student_rouge.json').then(
      (m) => m.default as AnimationData,
    ),
  '14': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/14_girl-with-suitcase_rouge.json'
    ).then((m) => m.default as AnimationData),
  '15': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/15_empty-notifications_rouge.json'
    ).then((m) => m.default as AnimationData),
  '16': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/16_alarm-clock_rouge.json'
    ).then((m) => m.default as AnimationData),
  '17': () =>
    import(
      '../../../assets/lottie/sleep/horaires-variables/17_water-resources_rouge.json'
    ).then((m) => m.default as AnimationData),
}

const LazyLottieLight = lazy(async () => {
  await import('lottie-web/build/player/lottie_light')
  const mod = await import('lottie-react')
  return { default: mod.LottieLight }
})

export function HvLottie({
  id,
  playing = true,
  loop = true,
  className,
  style,
}: {
  id: HvLottieId
  playing?: boolean
  loop?: boolean
  className?: string
  style?: CSSProperties
}) {
  const reduced = usePrefersReducedMotion()
  const [data, setData] = useState<AnimationData | null>(null)
  const handleRef = useRef<LottieHandle | null>(null)

  useEffect(() => {
    let cancelled = false
    void LOADERS[id]().then((animationData) => {
      if (!cancelled) setData(animationData)
    })
    return () => {
      cancelled = true
    }
  }, [id])

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

  useEffect(() => {
    return () => {
      try {
        handleRef.current?.animationItem?.destroy()
      } catch {
        /* ignore */
      }
      handleRef.current = null
    }
  }, [])

  if (!data) {
    return <div className={className} style={style} aria-hidden data-hv-lottie="loading" />
  }

  return (
    <div className={className} style={style} aria-hidden data-hv-lottie={id}>
      <Suspense fallback={null}>
        <LazyLottieLight
          lottieRef={handleRef}
          src={data}
          loop={reduced ? false : loop}
          autoplay={!reduced && playing}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  )
}
