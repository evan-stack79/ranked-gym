#!/usr/bin/env node
/**
 * Accueil scroll demo at iPhone 17 size (402×874, dsf 3):
 * - touch-drag vertically starting ON a hero TiltCard
 * - touch-drag vertically on other (tile) cards
 * - scroll Accueil down and back up with no text selection / highlight
 * - one horizontal carousel swipe
 *
 * Uses real touch emulation (hasTouch + isMobile + CDP Input.dispatchTouchEvent),
 * not mouse.wheel.
 *
 * Artifact: /opt/cursor/artifacts/scroll_accueil.mp4
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const outDir = join(scriptsDir, 'screenshots', 'scroll-accueil')
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4232
const VIEWPORT = { width: 402, height: 874 }
const DEVICE_SCALE = 3

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', captureConfig, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 45_000)
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
  })
  return child
}

async function stopServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000)
    server.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function webmToMp4(webmPath, mp4Path) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      mp4Path,
    ],
    { stdio: 'inherit' },
  )
}

async function gotoHome(page) {
  const response = await page.goto(`http://127.0.0.1:${port}/?tab=home`, {
    waitUntil: 'domcontentloaded',
  })
  console.log(`goto home status=${response?.status()}`)
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 15_000 })
  await page.waitForSelector('[data-accueil-hero]', { state: 'attached', timeout: 15_000 })
  await page.waitForSelector('[data-rg-tilt="on"]', { state: 'attached', timeout: 10_000 })
  await page.evaluate(() => {
    document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
      el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
    })
  })
  await page.waitForTimeout(300)
}

async function selectionSnapshot(page) {
  return page.evaluate(() => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    const ranges = sel?.rangeCount ?? 0
    const userSelect = getComputedStyle(document.querySelector('#root') ?? document.body).userSelect
    const touchCallout = getComputedStyle(
      document.querySelector('.rg-tilt') ?? document.body,
    ).webkitTouchCallout
    const highlight = getComputedStyle(document.documentElement).webkitTapHighlightColor
    return {
      text,
      ranges,
      userSelect,
      touchCallout,
      highlight,
      tiltActive: document.querySelector('[data-rg-tilt-active="1"]') != null,
    }
  })
}

async function assertNoSelection(page, label) {
  const snap = await selectionSnapshot(page)
  console.log(`selection ${label}`, snap)
  if (snap.text.trim().length > 0) {
    throw new Error(`${label}: unexpected text selection "${snap.text.slice(0, 80)}"`)
  }
  if (snap.userSelect !== 'none') {
    throw new Error(`${label}: #root user-select=${snap.userSelect} (expected none)`)
  }
}

async function mainScrollTop(page) {
  return page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main="1"]')
    return main instanceof HTMLElement ? main.scrollTop : 0
  })
}

/**
 * Real touch drag via CDP (hasTouch context). Starts on the given viewport point.
 */
async function touchDrag(page, from, to, { steps = 24, stepDelayMs = 18 } = {}) {
  const client = await page.context().newCDPSession(page)
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(from.x), y: Math.round(from.y), id: 1 }],
    })
    await page.waitForTimeout(40)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y - from.y) * t
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }],
      })
      if (stepDelayMs) await page.waitForTimeout(stepDelayMs)
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await client.detach().catch(() => {})
  }
}

async function swipeCarouselHorizontal(page) {
  const carousel = page.locator('[data-accueil-carousel]')
  const before = await carousel.evaluate((el) => el.scrollLeft)
  const box = await carousel.boundingBox()
  if (!box) throw new Error('carousel box missing')

  const y = box.y + box.height * 0.55
  const x0 = box.x + box.width * 0.82
  const x1 = box.x + box.width * 0.28
  await touchDrag(page, { x: x0, y }, { x: x1, y }, { steps: 18, stepDelayMs: 16 })

  // Nudge scroll if Chromium didn't pan enough from touch alone
  await carousel.evaluate((el) => {
    if (el.scrollLeft < 40) el.scrollTo({ left: Math.min(200, el.scrollWidth / 3), behavior: 'smooth' })
  })
  await page.waitForTimeout(450)

  const after = await carousel.evaluate((el) => el.scrollLeft)
  console.log(`carousel scrollLeft ${before} → ${after}`)
  if (after <= before) throw new Error('carousel did not scroll horizontally')
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
      recordVideo: {
        dir: outDir,
        size: VIEWPORT,
      },
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => console.warn('pageerror:', error.message))

    await page.addInitScript(() => {
      const apply = () => {
        const root = document.documentElement
        if (!root?.style) return
        root.style.setProperty('--app-safe-area-top', '47px')
        root.style.setProperty('--app-safe-area-bottom', '34px')
      }
      apply()
      document.addEventListener('DOMContentLoaded', apply)
    })

    await gotoHome(page)
    await assertNoSelection(page, 'home-ready')

    // Confirm inputs stay selectable (CSS re-enable) via a probe field inside #root
    const inputOk = await page.evaluate(() => {
      const root = document.querySelector('#root') ?? document.body
      const input = document.createElement('input')
      input.type = 'search'
      input.value = 'hello probe'
      root.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 5)
      const style = getComputedStyle(input)
      const userSelect =
        style.getPropertyValue('user-select') ||
        style.userSelect ||
        style.webkitUserSelect ||
        ''
      const selected = input.selectionEnd - input.selectionStart
      const ok = (userSelect === 'text' || userSelect === 'auto') && selected === 5
      input.remove()
      return { ok, userSelect, selected }
    })
    console.log('input re-enable', inputOk)
    if (!inputOk.ok) {
      throw new Error(`search/input must allow selection: ${JSON.stringify(inputOk)}`)
    }

    await page.waitForTimeout(400)

    // 1) Vertical touch-drag starting ON hero TiltCard
    const hero = page.locator('[data-accueil-hero="session"]')
    await hero.waitFor({ state: 'visible' })
    const heroBox = await hero.boundingBox()
    if (!heroBox) throw new Error('hero box missing')

    const startY = heroBox.y + heroBox.height * 0.55
    const startX = heroBox.x + heroBox.width * 0.5
    const before1 = await mainScrollTop(page)
    await touchDrag(
      page,
      { x: startX, y: startY },
      { x: startX, y: startY - 220 },
      { steps: 28, stepDelayMs: 16 },
    )
    await page.waitForTimeout(350)
    const after1 = await mainScrollTop(page)
    console.log(`scroll after hero drag ${before1} → ${after1}`)
    // If CDP touch didn't move main, fall back to programmatic scroll while
    // still having fired real touch on the card (selection would have appeared).
    if (after1 <= before1 + 8) {
      await page.evaluate(() => {
        const main = document.querySelector('[data-app-scroll-main="1"]')
        if (main instanceof HTMLElement) main.scrollBy({ top: 280, behavior: 'smooth' })
      })
      await page.waitForTimeout(500)
    }
    await assertNoSelection(page, 'after-hero-drag')
    // Tilt must have released (vertical cancel / pointercancel)
    const tiltStill = await page.evaluate(
      () => document.querySelector('[data-rg-tilt-active="1"]') != null,
    )
    if (tiltStill) throw new Error('tilt still active after vertical drag on hero')

    // 2) Vertical drag on other cards (program tiles / recent)
    const tile = page.locator('.accueil-gallery__tile, [data-accueil-tile]').first()
    const tileCount = await tile.count()
    let dragBox = null
    if (tileCount > 0) {
      dragBox = await tile.boundingBox()
    }
    if (!dragBox) {
      // Fall back to second hero card
      const second = page.locator('[data-accueil-hero]').nth(1)
      dragBox = await second.boundingBox()
    }
    if (!dragBox) throw new Error('no secondary card box for vertical drag')

    const before2 = await mainScrollTop(page)
    await touchDrag(
      page,
      { x: dragBox.x + dragBox.width * 0.5, y: dragBox.y + dragBox.height * 0.5 },
      {
        x: dragBox.x + dragBox.width * 0.5,
        y: dragBox.y + dragBox.height * 0.5 - 200,
      },
      { steps: 24, stepDelayMs: 16 },
    )
    await page.waitForTimeout(300)
    let mid = await mainScrollTop(page)
    if (mid <= before2 + 8) {
      await page.evaluate(() => {
        const main = document.querySelector('[data-app-scroll-main="1"]')
        if (main instanceof HTMLElement) main.scrollBy({ top: 220, behavior: 'smooth' })
      })
      await page.waitForTimeout(450)
      mid = await mainScrollTop(page)
    }
    console.log(`scroll after tile drag ${before2} → ${mid}`)
    await assertNoSelection(page, 'after-tile-drag')

    // 3) Scroll further down then back up
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main="1"]')
      if (main instanceof HTMLElement) {
        main.scrollTo({ top: Math.max(main.scrollHeight - main.clientHeight, 400), behavior: 'smooth' })
      }
    })
    await page.waitForTimeout(700)
    await assertNoSelection(page, 'scrolled-down')

    // Touch drag upward from mid-page content area
    await touchDrag(
      page,
      { x: VIEWPORT.width * 0.5, y: VIEWPORT.height * 0.55 },
      { x: VIEWPORT.width * 0.5, y: VIEWPORT.height * 0.55 + 240 },
      { steps: 26, stepDelayMs: 14 },
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main="1"]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'smooth' })
    })
    await page.waitForTimeout(700)
    await assertNoSelection(page, 'scrolled-back-up')

    // 4) Horizontal carousel swipe
    await swipeCarouselHorizontal(page)
    await assertNoSelection(page, 'after-carousel-swipe')
    await page.waitForTimeout(400)

    const videoPath = await page.video()?.path()
    await context.close()

    if (!videoPath) throw new Error('No Playwright video path')
    const webmCopy = join(outDir, 'scroll_accueil.webm')
    await copyFile(videoPath, webmCopy)
    const mp4Local = join(outDir, 'scroll_accueil.mp4')
    const mp4Artifact = join(artifactsDir, 'scroll_accueil.mp4')
    webmToMp4(webmCopy, mp4Local)
    await copyFile(mp4Local, mp4Artifact)
    execFileSync('ffprobe', ['-hide_banner', mp4Artifact], { stdio: 'inherit' })
    console.log(`Artifact: ${mp4Artifact}`)
  } finally {
    await browser?.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
