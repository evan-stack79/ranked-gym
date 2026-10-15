#!/usr/bin/env node
/**
 * Enregistre le Tilt Card Accueil à taille iPhone 17 (402×874, dsf 3) :
 * - press + move sur Séance du jour (tilt + glare)
 * - swipe horizontal du carrousel (scrollTo + pointer touch; no CDP pinch)
 * - tap ouvre une carte
 * - Train → Accueil (cartes toujours visibles)
 *
 * Capture notes:
 * - Do NOT element-screenshot a 3D-transformed node while recordVideo is on:
 *   Playwright's screencast can briefly show the page shrunk top-left (~1/dpr)
 *   with grey margins. That is a capture artifact (visualViewport.scale stays 1).
 * - Harness viewport meta matches prod (maximum-scale=1, user-scalable=0).
 *
 * Artifacts : /opt/cursor/artifacts/tilt_card.mp4 + tilt_card_pic.png
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
const outDir = join(scriptsDir, 'screenshots', 'tilt-card')
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4231
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
  // Force Reveal visible for deterministic demo
  await page.evaluate(() => {
    document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
      el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
    })
  })
  await page.waitForTimeout(300)
}

async function assertNoErrorBanner(page) {
  const text = await page.locator('body').innerText()
  if (/erreur|error banner|failed to fetch|something went wrong/i.test(text) && /banner/i.test(text)) {
    throw new Error(`Unexpected error copy on page: ${text.slice(0, 200)}`)
  }
  const offline = await page.$('[data-offline-banner="1"]')
  if (offline) throw new Error('Offline banner visible')
}

/**
 * Drive tilt with PointerEvents (pointerType touch) — Playwright touch
 * often can't produce the continuous press+move the effect needs.
 */
async function ensureFingerOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('tilt-demo-finger')) return
    const el = document.createElement('div')
    el.id = 'tilt-demo-finger'
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'fixed',
      width: '28px',
      height: '28px',
      marginLeft: '-14px',
      marginTop: '-14px',
      borderRadius: '999px',
      border: '2px solid rgba(255,255,255,0.85)',
      background: 'rgba(255,43,43,0.35)',
      boxShadow: '0 0 0 6px rgba(255,43,43,0.12)',
      zIndex: '99999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 120ms ease-out',
    })
    document.body.appendChild(el)
  })
}

async function moveFinger(page, x, y, visible = true) {
  await page.evaluate(
    ({ x: cx, y: cy, visible: on }) => {
      const el = document.getElementById('tilt-demo-finger')
      if (!el) return
      el.style.left = `${cx}px`
      el.style.top = `${cy}px`
      el.style.opacity = on ? '1' : '0'
    },
    { x, y, visible },
  )
}

async function fireTouchPointer(page, type, x, y, extras = {}) {
  await page.evaluate(
    ({ type: t, x: cx, y: cy, extras: ex }) => {
      const target = document.querySelector('[data-accueil-hero="session"]')?.closest('[data-rg-tilt]')
      if (!target) throw new Error('tilt root missing')
      target.dispatchEvent(
        new PointerEvent(t, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: cx,
          clientY: cy,
          ...ex,
        }),
      )
    },
    { type, x, y, extras },
  )
}

async function waitFrames(page, n = 2) {
  await page.evaluate(
    (frames) =>
      new Promise((resolve) => {
        let left = frames
        const tick = () => {
          left -= 1
          if (left <= 0) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    n,
  )
}

async function simulateTouchTilt(page, path, { holdMs = 80, release = true, holdTiltMs = 700 } = {}) {
  await ensureFingerOverlay(page)
  const first = path[0]
  await moveFinger(page, first.x, first.y, true)
  await fireTouchPointer(page, 'pointerdown', first.x, first.y, { buttons: 1 })
  await page.waitForTimeout(holdMs)
  await waitFrames(page, 2)
  for (let i = 1; i < path.length; i++) {
    await moveFinger(page, path[i].x, path[i].y, true)
    await fireTouchPointer(page, 'pointermove', path[i].x, path[i].y, { buttons: 1 })
    await waitFrames(page, 2)
    await page.waitForTimeout(36)
  }
  const active = await page.getAttribute('[data-rg-tilt="on"]', 'data-rg-tilt-active')
  const vars = await page.evaluate(() => {
    const plane = document.querySelector('[data-rg-tilt-plane]')
    return plane
      ? {
          rx: plane.style.getPropertyValue('--rx'),
          ry: plane.style.getPropertyValue('--ry'),
          gx: plane.style.getPropertyValue('--gx'),
          gy: plane.style.getPropertyValue('--gy'),
          transform: getComputedStyle(plane).transform,
        }
      : null
  })
  console.log('tilt mid-path', { active, vars })
  // Hold mid-tilt so the recording clearly shows the 3D pose + glare
  await page.waitForTimeout(holdTiltMs)
  if (release) {
    const last = path[path.length - 1]
    await fireTouchPointer(page, 'pointerup', last.x, last.y, { buttons: 0 })
    await moveFinger(page, last.x, last.y, false)
    await page.waitForTimeout(420)
  }
}

async function readViewportScale(page) {
  return page.evaluate(() => {
    const vv = window.visualViewport
    return {
      scale: vv?.scale ?? 1,
      vvW: vv?.width ?? window.innerWidth,
      vvH: vv?.height ?? window.innerHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      dpr: window.devicePixelRatio,
      meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    }
  })
}

async function assertNoPageScale(page, label) {
  const snap = await readViewportScale(page)
  console.log(`viewport ${label}`, snap)
  if (snap.scale !== 1) {
    throw new Error(`${label}: visualViewport.scale=${snap.scale} (expected 1)`)
  }
  if (snap.innerW !== VIEWPORT.width || snap.innerH !== VIEWPORT.height) {
    throw new Error(
      `${label}: inner=${snap.innerW}x${snap.innerH} (expected ${VIEWPORT.width}x${VIEWPORT.height})`,
    )
  }
  return snap
}

async function midTiltScreenshot(page, path) {
  const box = await page.locator('[data-accueil-hero="session"]').boundingBox()
  if (!box) throw new Error('hero box missing for mid-tilt shot')
  // Keep |dy| >= |dx| so the swipe-cancel threshold does not flatten the card.
  // Bias toward a corner so rotateX/Y + glare read clearly in the still.
  const start = { x: box.x + box.width * 0.38, y: box.y + box.height * 0.78 }
  const mid = { x: box.x + box.width * 0.82, y: box.y + box.height * 0.14 }
  const pathPts = []
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pathPts.push({
      x: start.x + (mid.x - start.x) * t,
      y: start.y + (mid.y - start.y) * t,
    })
  }
  await simulateTouchTilt(page, pathPts, { holdMs: 120, release: false, holdTiltMs: 200 })
  const active = await page.getAttribute('[data-rg-tilt="on"]', 'data-rg-tilt-active')
  if (active !== '1') {
    throw new Error(`tilt not active for PNG (active=${active})`)
  }
  // Full-page only while video records. Element screenshots of a 3D-transformed
  // node can glitch Playwright's screencast (page appears shrunk top-left).
  await page.screenshot({ path, fullPage: false })
  const planeBox = await page.locator('[data-rg-tilt-plane]').first().boundingBox()
  const heroBox = await page.locator('[data-accueil-hero="session"]').boundingBox()
  console.log('mid-tilt boxes', { planeBox, heroBox })
  await fireTouchPointer(page, 'pointerup', mid.x, mid.y, { buttons: 0 })
  await moveFinger(page, mid.x, mid.y, false)
  await page.waitForTimeout(400)
}

/**
 * Horizontal carousel swipe without CDP pinch/scroll gestures.
 * Uses scrollTo({behavior:'smooth'}) + touch pointer events on the scroller.
 * Asserts visualViewport.scale stays 1 (rules out real page zoom).
 */
async function swipeCarousel(page) {
  await assertNoPageScale(page, 'before-swipe')
  const carousel = page.locator('[data-accueil-carousel]')
  const beforeScroll = await carousel.evaluate((el) => el.scrollLeft)
  const cbox = await carousel.boundingBox()
  if (!cbox) throw new Error('carousel box missing')

  const targetLeft = await carousel.evaluate((el) =>
    Math.min(220, Math.max(160, Math.floor(el.scrollWidth / 3))),
  )

  // Optional finger cue on the scroller (not a multi-touch / pinch).
  await ensureFingerOverlay(page)
  const y = cbox.y + cbox.height * 0.55
  const x0 = cbox.x + cbox.width * 0.82
  const x1 = cbox.x + cbox.width * 0.28
  await moveFinger(page, x0, y, true)

  // Dispatch touch pointers on the carousel (bubbles; no preventDefault).
  await page.evaluate(
    async ({ x0, x1, y, targetLeft }) => {
      const el = document.querySelector('[data-accueil-carousel]')
      if (!(el instanceof HTMLElement)) throw new Error('carousel missing')
      const fire = (type, x, extras = {}) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            ...extras,
          }),
        )
      }
      fire('pointerdown', x0, { buttons: 1 })
      const steps = 12
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        fire('pointermove', x0 + (x1 - x0) * t, { buttons: 1 })
        // Drive scroll explicitly — mirrors iOS scroll-snap without CDP gestures.
        el.scrollTo({ left: targetLeft * t, behavior: 'instant' })
        await new Promise((r) => requestAnimationFrame(r))
      }
      fire('pointerup', x1, { buttons: 0 })
      el.scrollTo({ left: targetLeft, behavior: 'smooth' })
    },
    { x0, x1, y, targetLeft },
  )

  // Sample scale while the smooth settle runs
  const scaleSamples = []
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(50)
    scaleSamples.push(await readViewportScale(page))
    await moveFinger(page, x0 + (x1 - x0) * Math.min(1, (i + 1) / 8), y, i < 7)
  }
  await moveFinger(page, x1, y, false)

  for (const s of scaleSamples) {
    if (s.scale !== 1) {
      throw new Error(`swipe scaled the page: ${JSON.stringify(s)}`)
    }
    if (s.innerW !== VIEWPORT.width) {
      throw new Error(`swipe changed innerWidth: ${JSON.stringify(s)}`)
    }
  }

  const afterScroll = await carousel.evaluate((el) => el.scrollLeft)
  console.log(`carousel scrollLeft ${beforeScroll} → ${afterScroll}`, { scaleSamples: scaleSamples.length })
  if (afterScroll <= beforeScroll) {
    throw new Error('carousel did not scroll horizontally')
  }
  await assertNoPageScale(page, 'after-swipe')
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
    await assertNoErrorBanner(page)
    await assertNoPageScale(page, 'home-ready')
    const meta = await page.evaluate(
      () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    )
    if (!/user-scalable=0/.test(meta) || !/maximum-scale=1/.test(meta)) {
      throw new Error(`capture harness viewport meta must match prod zoom lock: ${meta}`)
    }

    const galleryText = await page.locator('[data-accueil-gallery]').innerText()
    if (!/Séance du jour|Mon programme|Push/i.test(galleryText)) {
      throw new Error(`Accueil looks empty: ${galleryText.slice(0, 180)}`)
    }

    // Hold a beat so the recording opens on Accueil
    await page.waitForTimeout(500)

    const hero = page.locator('[data-accueil-hero]').first()
    await hero.waitFor({ state: 'visible' })
    const box = await hero.boundingBox()
    if (!box) throw new Error('hero bounding box missing')

    // 1) Finger press + move — clear tilt + glare, then spring back
    const path = []
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      path.push({
        x: box.x + box.width * (0.28 + 0.5 * t),
        y: box.y + box.height * (0.62 - 0.38 * t),
      })
    }
    await simulateTouchTilt(page, path, { holdMs: 120 })
    await assertNoPageScale(page, 'after-tilt-1')
    await page.waitForTimeout(350)

    // Second tilt pass for clarity in the video
    const path2 = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      path2.push({
        x: box.x + box.width * (0.7 - 0.4 * t),
        y: box.y + box.height * (0.3 + 0.4 * t),
      })
    }
    await simulateTouchTilt(page, path2, { holdMs: 90 })
    await assertNoPageScale(page, 'after-tilt-2')
    await page.waitForTimeout(300)

    // Mid-tilt PNG while still on Accueil (full-page only — no element screenshot)
    const pngLocal = join(outDir, 'tilt_card_pic.png')
    await midTiltScreenshot(page, pngLocal)
    await copyFile(pngLocal, join(artifactsDir, 'tilt_card_pic.png'))
    await assertNoPageScale(page, 'after-mid-tilt-png')

    // 3) Horizontal swipe — scrollTo + touch pointers (no CDP pinch / element shot)
    await swipeCarousel(page)

    // Reset carousel
    await page.locator('[data-accueil-carousel]').evaluate((el) => {
      el.scrollTo({ left: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(250)

    // 4) Tap opens a card — use Mon programme (open_notebook) so nav stays visible
    const programHero = page.locator('[data-accueil-hero="program"]')
    await programHero.click()
    await page.waitForTimeout(700)
    await page.waitForSelector('[data-nav-tab="training"][aria-current="page"]', {
      timeout: 10_000,
    })
    console.log('after tap: Train tab active')
    await page.waitForTimeout(700)

    // 5) Train → Accueil — heroes still visible
    await page.locator('[data-nav-tab="home"]').click()
    await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 10_000 })
    await page.waitForSelector('[data-accueil-hero="session"]', { state: 'visible', timeout: 10_000 })
    await page.evaluate(() => {
      document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
        el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
      })
    })
    await page.waitForTimeout(800)

    const heroesVisible = await page.evaluate(() => {
      const heroes = [...document.querySelectorAll('[data-accueil-hero]')]
      return heroes.map((el) => {
        const r = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          w: r.width,
          h: r.height,
          opacity: style.opacity,
          visibility: style.visibility,
          label: el.getAttribute('aria-label'),
        }
      })
    })
    console.log('heroes after remount', heroesVisible)
    if (!heroesVisible.some((h) => h.w > 40 && h.h > 40)) {
      throw new Error('Hero cards not visible after Train → Accueil')
    }

    await page.waitForTimeout(400)

    const videoPath = await page.video()?.path()
    await context.close()

    if (!videoPath) throw new Error('No Playwright video path')
    const webmCopy = join(outDir, 'tilt_card.webm')
    await copyFile(videoPath, webmCopy)
    const mp4Local = join(outDir, 'tilt_card.mp4')
    const mp4Artifact = join(artifactsDir, 'tilt_card.mp4')
    webmToMp4(webmCopy, mp4Local)
    await copyFile(mp4Local, mp4Artifact)

    // Probe codecs
    execFileSync('ffprobe', ['-hide_banner', mp4Artifact], { stdio: 'inherit' })
    console.log('Artifacts:')
    console.log(` - ${mp4Artifact}`)
    console.log(` - ${join(artifactsDir, 'tilt_card_pic.png')}`)
  } finally {
    await browser?.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
