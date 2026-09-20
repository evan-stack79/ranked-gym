import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptsDir = dirname(fileURLToPath(import.meta.url))
export const projectRoot = join(scriptsDir, '..')
export const captureConfig = join(scriptsDir, 'streak-celeb-capture', 'vite.config.ts')
export const viewportHeight = 812
export const widths = [320, 375, 390]
export const safeAreas = { top: 47, right: 0, bottom: 34, left: 0 }
export const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome' }
  : {}

export async function startHarnessServer(port) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', captureConfig, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite capture timeout\n${output}`)), 15_000)
    const onData = (chunk) => {
      output += chunk.toString()
      if (output.includes('Local:')) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer)
        reject(new Error(`Vite capture exited ${code}\n${output}`))
      }
    })
  })

  return child
}

export async function stopHarnessServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000)
    server.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

export async function preparePage(page) {
  await page.addInitScript((insets) => {
    const root = document.documentElement.style
    root.setProperty('--app-safe-area-top', `${insets.top}px`)
    root.setProperty('--app-safe-area-right', `${insets.right}px`)
    root.setProperty('--app-safe-area-bottom', `${insets.bottom}px`)
    root.setProperty('--app-safe-area-left', `${insets.left}px`)
  }, safeAreas)
}

export async function applySafeAreas(page) {
  await page.evaluate((insets) => {
    const root = document.documentElement.style
    root.setProperty('--app-safe-area-top', `${insets.top}px`)
    root.setProperty('--app-safe-area-right', `${insets.right}px`)
    root.setProperty('--app-safe-area-bottom', `${insets.bottom}px`)
    root.setProperty('--app-safe-area-left', `${insets.left}px`)
  }, safeAreas)
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}

export async function waitForCelebrationChrome(page) {
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-bottom-nav-host]')
    return (
      host instanceof HTMLElement &&
      host.classList.contains('invisible') &&
      host.hasAttribute('inert') &&
      host.getAttribute('aria-hidden') === 'true'
    )
  }, undefined, { timeout: 5_000 })
}

export async function readCelebrationState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('.streak-celeb')
    const navHost = document.querySelector('[data-bottom-nav-host]')
    const header = document.querySelector('header')
    if (!(dialog instanceof HTMLElement) || !(navHost instanceof HTMLElement)) {
      throw new Error('Celebration DOM missing')
    }
    const rect = dialog.getBoundingClientRect()
    const dialogStyle = getComputedStyle(dialog)
    const rootStyle = getComputedStyle(document.documentElement)
    const navStyle = getComputedStyle(navHost)
    const headerZ = header instanceof HTMLElement ? Number(getComputedStyle(header).zIndex || 0) : 0
    const nav = navHost.querySelector('nav')
    const navZ = nav instanceof HTMLElement ? Number(getComputedStyle(nav).zIndex || 0) : 0
    return {
      parentIsBody: dialog.parentElement === document.body,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cssWidth: dialogStyle.width,
      cssHeight: dialogStyle.height,
      background: dialogStyle.backgroundColor,
      paddingTop: Number.parseFloat(dialogStyle.paddingTop),
      paddingBottom: Number.parseFloat(dialogStyle.paddingBottom),
      safeTopVariable: rootStyle.getPropertyValue('--app-safe-area-top').trim(),
      safeBottomVariable: rootStyle.getPropertyValue('--app-safe-area-bottom').trim(),
      dialogSafeTopVariable: dialogStyle.getPropertyValue('--app-safe-area-top').trim(),
      dialogSafeBottomVariable: dialogStyle.getPropertyValue('--app-safe-area-bottom').trim(),
      zIndex: Number(dialogStyle.zIndex),
      headerZ,
      navZ,
      navInvisible: navStyle.visibility === 'hidden',
      navInert: navHost.hasAttribute('inert'),
      navAriaHidden: navHost.getAttribute('aria-hidden') === 'true',
      bodyOverflow: document.body.style.overflow,
      activeInsideNav: navHost.contains(document.activeElement),
    }
  })
}

export function assertCelebrationState(state, width, height = viewportHeight) {
  const failures = []
  const close = (actual, expected) => Math.abs(actual - expected) <= 1
  if (!state.parentIsBody) failures.push('portal is not a direct document.body child')
  if (!close(state.rect.x, 0) || !close(state.rect.y, 0)) failures.push('overlay origin is not 0,0')
  if (!close(state.rect.width, width) || !close(state.rect.height, height)) {
    failures.push(`overlay rect ${state.rect.width}x${state.rect.height}, expected ${width}x${height}`)
  }
  if (state.background !== 'rgb(12, 12, 14)') failures.push(`background is ${state.background}`)
  if (state.paddingTop !== safeAreas.top || state.paddingBottom !== safeAreas.bottom) {
    failures.push(
      `safe areas are ${state.paddingTop}/${state.paddingBottom} (root ${state.safeTopVariable}/${state.safeBottomVariable}, dialog ${state.dialogSafeTopVariable}/${state.dialogSafeBottomVariable})`,
    )
  }
  if (state.zIndex <= state.headerZ || state.zIndex <= state.navZ) failures.push('z-index is not topmost')
  if (!state.navInvisible || !state.navInert || !state.navAriaHidden) failures.push('BottomNav is exposed')
  if (state.bodyOverflow !== 'hidden') failures.push('body scroll is not locked')
  if (state.activeInsideNav) failures.push('focus entered BottomNav')
  if (failures.length) throw new Error(failures.join('; '))
}
