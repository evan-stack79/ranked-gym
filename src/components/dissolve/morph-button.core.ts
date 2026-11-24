/**
 * MorphButton for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (morph-button.tsx) wraps it; it also runs on its own:
 *
 *   createMorphButton(document.querySelector('div')!, { label: 'Pay 42 €', doneLabel: 'Paid', onPress: pay });
 *
 * A button that morphs like the Dynamic Island: the pill folds into a round loader, then opens back
 * up as the done state. Crisp shape, a critically damped spring on the width, content that
 * cross-fades and scales. The pill reads --dissolve-primary at rest and --dissolve-success when
 * done, the content --dissolve-primary-foreground.
 *
 * Ranked Gym patches: `disabled`, `data-phase`, prefers-reduced-motion (snap, no spin), brand-safe
 * success fallback (no green).
 */
import { CALM, el, injectStyle, propsOf, reducedMotion, scope, value, vibrate } from './kit'

export type MorphButtonProps = {
  /** Idle label. */
  label?: string
  /** Label next to the check once the promise resolves. Default 'Done'. */
  doneLabel?: string
  /** Runs on press. The button stays in its loading state until the promise settles; a rejection goes back to idle. */
  onPress?: () => Promise<unknown> | void
  /** Pill height in px, also the loader diameter. Default 52. */
  height?: number
  /** Time spent on the done state before going back, ms. 0 stays done. Default 1800. */
  resetAfter?: number
  /** A short vibration on press and on success, where the browser has it. Default true. */
  haptics?: boolean
  /** Label and done label classes (size, weight, color). */
  labelClassName?: string
  /** When true, ignores press and looks inert. */
  disabled?: boolean
}

export type MorphButtonInstance = {
  update: (props: Partial<MorphButtonProps>) => void
  destroy: () => void
  /** Current visual phase — useful for tests. */
  getPhase: () => Phase
}

export type Phase = 'idle' | 'loading' | 'done'

const DEFAULTS = {
  label: '',
  doneLabel: 'Done',
  height: 52,
  resetAfter: 1800,
  haptics: true,
  disabled: false,
}

/** Critically damped: smooth like the Dynamic Island, no visible bounce. */
const SPRING = { stiffness: 260, damping: 31, mass: 1, eps: 0.05 }
const CHECK =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'
const PRIMARY = 'var(--dissolve-primary, #ff0702)'
const SUCCESS = 'var(--dissolve-success, #16a34a)'

const CSS = `
:where([data-dissolve="morph-button"]) { position: relative; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="morph-button"][aria-disabled="true"]) { cursor: not-allowed; opacity: 0.4; pointer-events: none; }
:where(.dissolve-morph-pill) { position: absolute; top: 0; overflow: hidden; }
:where(.dissolve-morph-layer) {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  color: var(--dissolve-primary-foreground, rgb(255 255 255)); white-space: nowrap; will-change: transform, opacity;
}
:where(.dissolve-morph-label) { font-size: 16px; font-weight: 600; }
:where(.dissolve-morph-layer) svg { display: block; flex: none; }
:where(.dissolve-morph-spinner) { display: block; width: 20px; height: 20px; border-radius: 50%; border: 2.2px solid; border-top-color: transparent; }
@media (prefers-reduced-motion: reduce) {
  :where(.dissolve-morph-layer) { will-change: auto; }
  :where(.dissolve-morph-spinner) { border-top-color: currentColor; opacity: 0.55; }
}
`

/** A morphing button on host (a block element: it takes the width, the pill is centered inside). */
export function createMorphButton(host: HTMLElement, initial: MorphButtonProps = {}): MorphButtonInstance {
  injectStyle('dissolve-morph-button', CSS)
  const props = propsOf(DEFAULTS, initial)
  const p = () => props.current
  const sc = scope()

  host.dataset.dissolve = 'morph-button'
  host.setAttribute('role', 'button')
  host.tabIndex = 0
  host.dataset.phase = 'idle'

  const pill = el('div', 'dissolve-morph-pill')
  const lab = el('span', 'dissolve-morph-layer')
  const labText = el('span')
  lab.append(labText)
  const spin = el('span', 'dissolve-morph-layer')
  spin.append(el('i', 'dissolve-morph-spinner'))
  const done = el('span', 'dissolve-morph-layer dissolve-morph-done', CHECK)
  const doneText = el('span')
  done.append(doneText)
  pill.append(lab, spin, done)
  host.append(pill)

  let W = Math.round(host.clientWidth) || 280
  let phase: Phase = 'idle',
    angle = 0,
    spinning = false,
    fromDone = false

  const render = () => {
    const w = width.v
    pill.style.width = w.toFixed(2) + 'px'
    pill.style.left = ((W - w) / 2).toFixed(2) + 'px'
    const t = tone.v
    pill.style.background =
      t <= 0
        ? PRIMARY
        : t >= 1
          ? SUCCESS
          : `color-mix(in srgb, ${PRIMARY} ${((1 - t) * 100).toFixed(2)}%, ${SUCCESS})`
    // Each layer fades and scales on its own slot of the timeline, like island content.
    const layer = (node: HTMLElement, at: number, k = 0.18, rot = '') => {
      const d = Math.min(1, Math.abs(show.v - at))
      node.style.opacity = (1 - d).toFixed(3)
      node.style.transform = `scale(${(1 - k * d).toFixed(3)})${rot}`
    }
    layer(lab, 0)
    layer(spin, 1, 0.3, reducedMotion() ? '' : ` rotate(${angle.toFixed(1)}deg)`)
    // Done back to idle crosses the spinner slot: keep it out of that cross-fade.
    if (phase === 'idle' && fromDone) spin.style.opacity = '0'
    layer(done, 2)
  }
  const width = value(sc, W, render)
  const tone = value(sc, 0, render)
  const show = value(sc, 0, render)

  function apply() {
    const { label, doneLabel, height, labelClassName, disabled } = p()
    host.style.height = height + 'px'
    pill.style.height = height + 'px'
    pill.style.borderRadius = height / 2 + 'px'
    labText.textContent = label
    doneText.textContent = doneLabel
    const cls = 'dissolve-morph-label' + (labelClassName ? ' ' + labelClassName : '')
    labText.className = doneText.className = cls
    host.setAttribute('aria-disabled', String(Boolean(disabled)))
    host.tabIndex = disabled ? -1 : 0
  }

  const spinLoop = () => {
    if (reducedMotion()) return
    let last = performance.now()
    const f = (now: number) => {
      if (!spinning || !sc.alive) return
      angle = (angle + ((now - last) / 900) * 360) % 360
      last = now
      render()
      requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }

  const go = (next: Phase) => {
    fromDone = phase === 'done' && next === 'idle'
    phase = next
    host.dataset.phase = next
    host.setAttribute('aria-busy', String(next === 'loading'))
    const targetW = next === 'loading' ? p().height : W
    const targetTone = next === 'done' ? 1 : 0
    const targetShow = next === 'idle' ? 0 : next === 'loading' ? 1 : 2
    if (reducedMotion()) {
      width.set(targetW)
      tone.set(targetTone)
      show.set(targetShow)
    } else {
      width.spring(targetW, SPRING)
      tone.to(targetTone, 380, CALM)
      show.to(targetShow, 300, CALM)
    }
    if (next === 'loading' && !spinning) {
      spinning = true
      spinLoop()
    }
    if (next !== 'loading') spinning = false
  }

  async function press() {
    if (phase !== 'idle' || p().disabled) return
    const { haptics, onPress } = p()
    if (haptics) vibrate(8)
    go('loading')
    try {
      await onPress?.()
      if (!sc.alive) return
      if (p().haptics) vibrate([10, 40, 18])
      go('done')
      const ms = p().resetAfter
      if (ms) sc.wait(ms).then(() => go('idle'))
    } catch {
      if (sc.alive) go('idle')
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      press()
    }
  }
  host.addEventListener('click', press)
  host.addEventListener('keydown', onKey)

  const onResize = () => {
    const next = Math.round(host.clientWidth)
    if (next === W || next <= 0) return
    W = next
    if (phase === 'loading') render()
    else width.set(W)
  }
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onResize)
      : null
  ro?.observe(host)

  apply()
  render()

  return {
    update(next) {
      const changed = props.update(next)
      if (!changed.size) return
      apply()
      if (changed.has('height') && phase === 'loading') {
        if (reducedMotion()) width.set(p().height)
        else width.spring(p().height, SPRING)
      }
    },
    destroy() {
      sc.dispose()
      spinning = false
      ro?.disconnect()
      host.removeEventListener('click', press)
      host.removeEventListener('keydown', onKey)
      pill.remove()
      host.style.removeProperty('height')
      host.removeAttribute('role')
      host.removeAttribute('tabindex')
      host.removeAttribute('aria-busy')
      host.removeAttribute('aria-disabled')
      delete host.dataset.dissolve
      delete host.dataset.phase
    },
    getPhase: () => phase,
  }
}
