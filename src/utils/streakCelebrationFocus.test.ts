// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureFocusReturnTarget,
  captureStreakCelebrationFocus,
  captureOverlayFocus,
  releaseStreakCelebrationFocus,
  restoreStreakCelebrationFocusPostCommit,
  isRestorableStreakCelebrationFocusTarget,
  setShellInert,
} from './streakCelebrationFocus'

describe('captureFocusReturnTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('retourne l’élément actif focusable', () => {
    const btn = document.createElement('button')
    btn.textContent = 'Nav'
    document.body.append(btn)
    btn.focus()
    expect(captureFocusReturnTarget()).toBe(btn)
  })

  it('retourne null si body est actif', () => {
    document.body.focus()
    expect(captureFocusReturnTarget()).toBeNull()
  })
})

describe('captureStreakCelebrationFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('focus l’overlay immédiatement', () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    previous.focus()

    captureStreakCelebrationFocus(overlay, previous)
    expect(document.activeElement).toBe(overlay)
  })
})

describe('restoreStreakCelebrationFocusPostCommit', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('restaure la cible une fois (release idempotent)', async () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    captureStreakCelebrationFocus(overlay, previous)

    previous.focus = vi.fn(function (this: HTMLButtonElement) {
      HTMLButtonElement.prototype.focus.call(this)
    }) as typeof previous.focus

    const release = releaseStreakCelebrationFocus(previous)
    release()
    expect(previous.focus).toHaveBeenCalledWith({ preventScroll: true })

    release()
    expect(previous.focus).toHaveBeenCalledTimes(1)
  })

  it('restaure un bouton BottomNav remonté après clearStreakCelebration', async () => {
    const navBtn = document.createElement('button')
    navBtn.setAttribute('aria-label', 'Accueil')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(navBtn, overlay)
    navBtn.focus()
    captureStreakCelebrationFocus(overlay, navBtn)

    navBtn.remove()
    document.body.append(navBtn)
    navBtn.focus = vi.fn(function (this: HTMLButtonElement) {
      HTMLButtonElement.prototype.focus.call(this)
    }) as typeof navBtn.focus

    restoreStreakCelebrationFocusPostCommit(navBtn)
    expect(navBtn.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('ne restaure pas une cible détachée', async () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    captureStreakCelebrationFocus(overlay, previous)
    previous.remove()

    restoreStreakCelebrationFocusPostCommit(previous)
    expect(document.activeElement).toBe(overlay)
  })

  it('refuse une cible inert, cachée, désactivée ou non focalisable', () => {
    const host = document.createElement('div')
    const button = document.createElement('button')
    host.append(button)
    document.body.append(host)

    expect(isRestorableStreakCelebrationFocusTarget(button)).toBe(true)
    host.setAttribute('inert', '')
    expect(isRestorableStreakCelebrationFocusTarget(button)).toBe(false)
    host.removeAttribute('inert')
    button.style.visibility = 'hidden'
    expect(isRestorableStreakCelebrationFocusTarget(button)).toBe(false)
    button.style.visibility = ''
    button.disabled = true
    expect(isRestorableStreakCelebrationFocusTarget(button)).toBe(false)
    button.disabled = false
    button.remove()
    expect(isRestorableStreakCelebrationFocusTarget(button)).toBe(false)
  })
})

describe('releaseStreakCelebrationFocus (legacy)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('restaure via post-commit', async () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    previous.focus()

    const release = releaseStreakCelebrationFocus(previous)
    release()
    expect(document.activeElement).toBe(previous)
  })
})

describe('captureOverlayFocus (legacy)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('délègue capture + release', async () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    previous.focus()

    const release = captureOverlayFocus(overlay)
    expect(document.activeElement).toBe(overlay)
    release()
    expect(document.activeElement).toBe(previous)
  })
})

describe('setShellInert', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('pose inert sur le shell et le retire une seule fois', () => {
    const shell = document.createElement('div')
    document.body.append(shell)

    const release = setShellInert(shell)
    expect(shell.hasAttribute('inert')).toBe(true)

    release()
    expect(shell.hasAttribute('inert')).toBe(false)

    shell.setAttribute('inert', '')
    const release2 = setShellInert(shell)
    release2()
    expect(shell.hasAttribute('inert')).toBe(true)
  })

  it('release idempotent', () => {
    const shell = document.createElement('div')
    document.body.append(shell)
    const release = setShellInert(shell)
    release()
    release()
    expect(shell.hasAttribute('inert')).toBe(false)
  })
})
