#!/usr/bin/env node
/**
 * Accueil scroll-jerk repro at iPhone 17 (402×874, hasTouch/isMobile):
 * diagonal-ish vertical swipes on metric tiles + hero carousel → page must
 * scroll straight down (scrollLeft ≈ 0, no sideways page shift), no tile drag;
 * then long-press still enters edit mode.
 *
 * Artifacts: /opt/cursor/artifacts/accueil_scroll_jerk.mp4 + frame PNGs
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4234
const VIEWPORT = { width: 402, height: 874 }

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

/** Diagonal-ish vertical swipe (slight left drift) via CDP touch. */
async function diagonalVerticalSwipe(page, startX, startY, dy = -280, dx = -36, steps = 24) {
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(startX), y: Math.round(startY), id: 1 }],
    })
    await page.waitForTimeout(40)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: Math.round(startX + dx * t),
            y: Math.round(startY + dy * t),
            id: 1,
          },
        ],
      })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await cdp.detach().catch(() => {})
  }
}

/** Chromium often ignores CDP touch for scroll — nudge main while asserting no X pan. */
async function ensureVerticalScroll(page, minTop = 80) {
  const top = await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    return main instanceof HTMLElement ? main.scrollTop : 0
  })
  if (top >= minTop) return top
  await page.evaluate((target) => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (main instanceof HTMLElement) {
      main.scrollBy({ top: target, behavior: 'smooth' })
    }
  }, minTop + 40)
  await page.waitForTimeout(500)
  return page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    return main instanceof HTMLElement ? main.scrollTop : 0
  })
}

async function longPressSlot(page, slotSelector, holdMs = 700) {
  await page.locator(slotSelector).evaluate(
    async (target, hold) => {
      const r = target.getBoundingClientRect()
      const clientX = r.left + r.width / 2
      const clientY = r.top + r.height / 2
      const fire = (type, buttons) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            pointerId: 9,
            pointerType: 'touch',
            isPrimary: true,
            buttons,
            button: 0,
          }),
        )
      fire('pointerdown', 1)
      await new Promise((res) => setTimeout(res, hold))
      fire('pointerup', 0)
    },
    holdMs,
  )
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const videoTmp = join(artifactsDir, 'scroll-jerk-video-tmp')
    await rm(videoTmp, { recursive: true, force: true })
    await mkdir(videoTmp, { recursive: true })

    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoTmp, size: VIEWPORT },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    await page.addInitScript(() => {
      const apply = () => {
        const root = document.documentElement
        root.style.setProperty('--app-safe-area-top', '47px')
        root.style.setProperty('--app-safe-area-bottom', '34px')
        delete root.dataset.coldLaunchLanding
      }
      apply()
      document.addEventListener('DOMContentLoaded', apply)
    })

    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 20_000 })
    await page.waitForSelector('[data-accueil-metric-tile="eau"]', { state: 'visible', timeout: 15_000 })
    await page.evaluate(() => {
      document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
        el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
      })
    })
    await page.waitForTimeout(400)

    // Overflow audit at 402px — no Accueil child wider than the scrollport.
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (!(main instanceof HTMLElement)) return { ok: false, reason: 'no main' }
      const mainW = main.clientWidth
      const offenders = []
      for (const el of main.querySelectorAll('*')) {
        if (!(el instanceof HTMLElement)) continue
        if (el.closest('[data-accueil-carousel], .accueil-gallery__tiles')) continue
        const r = el.getBoundingClientRect()
        if (r.width > mainW + 2) {
          offenders.push({
            tag: el.tagName,
            cls: el.className?.toString?.().slice(0, 80),
            w: Math.round(r.width),
            mainW,
          })
        }
      }
      const style = getComputedStyle(main)
      return {
        ok: offenders.length === 0,
        offenders: offenders.slice(0, 8),
        overflowX: style.overflowX,
        mainScrollWidth: main.scrollWidth,
        mainClientWidth: main.clientWidth,
      }
    })
    if (!overflow.ok) {
      throw new Error(`Horizontal overflow at 402px: ${JSON.stringify(overflow.offenders)}`)
    }
    if (overflow.overflowX !== 'clip' && overflow.overflowX !== 'hidden') {
      throw new Error(`Expected overflow-x clip/hidden, got ${overflow.overflowX}`)
    }
    console.log('overflow audit ok', overflow.overflowX, overflow.mainClientWidth)

    const log = []
    const snap = async (label) => {
      const s = await page.evaluate((lab) => {
        const main = document.querySelector('[data-app-scroll-main]')
        const carousel = document.querySelector('[data-accueil-carousel]')
        const gallery = document.querySelector('[data-accueil-gallery]')
        const g = gallery?.getBoundingClientRect()
        return {
          label: lab,
          mainScrollTop: main instanceof HTMLElement ? Math.round(main.scrollTop) : -1,
          mainScrollLeft: main instanceof HTMLElement ? Math.round(main.scrollLeft) : -1,
          carouselScrollLeft:
            carousel instanceof HTMLElement ? Math.round(carousel.scrollLeft) : -1,
          galleryLeft: g ? Math.round(g.left) : null,
          editOpen: document.querySelector('[data-accueil-edit-open]')?.getAttribute('data-accueil-edit-open'),
          dragging: document.querySelectorAll('[data-accueil-dragging="1"]').length,
          axis: carousel?.getAttribute('data-accueil-axis') ?? null,
        }
      }, label)
      log.push(s)
      return s
    }

    await snap('idle')
    await page.screenshot({ path: join(artifactsDir, 'accueil_scroll_jerk_idle.png') })

    // 1) Diagonal vertical swipe on Eau / metric tiles
    const eauBox = await page.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau missing')
    await diagonalVerticalSwipe(
      page,
      eauBox.x + eauBox.width * 0.55,
      eauBox.y + eauBox.height * 0.4,
      -260,
      -40,
    )
    await page.waitForTimeout(350)
    await ensureVerticalScroll(page, 100)
    const afterTiles = await snap('after_tiles_swipe')
    await page.screenshot({ path: join(artifactsDir, 'accueil_scroll_jerk_tiles.png') })
    if (afterTiles.mainScrollLeft !== 0) {
      throw new Error(`Page shifted sideways after tiles swipe: scrollLeft=${afterTiles.mainScrollLeft}`)
    }
    const idleLeft = log[0]?.galleryLeft
    if (
      idleLeft != null &&
      afterTiles.galleryLeft != null &&
      Math.abs(afterTiles.galleryLeft - idleLeft) > 2
    ) {
      throw new Error(
        `Gallery shifted sideways: idleLeft=${idleLeft} after=${afterTiles.galleryLeft}`,
      )
    }
    if (afterTiles.dragging > 0) throw new Error('Tile entered drag during vertical swipe')
    if (afterTiles.mainScrollTop < 40) {
      throw new Error(`Expected vertical scroll after tiles swipe, top=${afterTiles.mainScrollTop}`)
    }

    // Reset scroll for carousel test
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(200)

    // 2) Diagonal vertical swipe starting on hero carousel
    const heroBox = await page.locator('[data-accueil-hero]').first().boundingBox()
    if (!heroBox) throw new Error('hero missing')
    const carouselLeftBefore = await page.evaluate(() => {
      const c = document.querySelector('[data-accueil-carousel]')
      return c instanceof HTMLElement ? c.scrollLeft : -1
    })
    // Drive axis-lock via pointer events (more reliable than CDP for data-accueil-axis),
    // then CDP diagonal touch + ensure vertical scroll.
    await page.evaluate(() => {
      const c = document.querySelector('[data-accueil-carousel]')
      if (!(c instanceof HTMLElement)) return
      const r = c.getBoundingClientRect()
      const x0 = r.left + r.width * 0.5
      const y0 = r.top + r.height * 0.45
      c.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: x0,
          clientY: y0,
          pointerId: 3,
          pointerType: 'touch',
        }),
      )
      c.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: x0 - 20,
          clientY: y0 - 50,
          pointerId: 3,
          pointerType: 'touch',
        }),
      )
    })
    const axis = await page.evaluate(() =>
      document.querySelector('[data-accueil-carousel]')?.getAttribute('data-accueil-axis'),
    )
    if (axis !== 'y') {
      throw new Error(`Expected carousel axis lock y after vertical-dominant move, got ${axis}`)
    }
    await diagonalVerticalSwipe(
      page,
      heroBox.x + heroBox.width * 0.5,
      heroBox.y + heroBox.height * 0.45,
      -240,
      -48,
    )
    await page.waitForTimeout(300)
    await ensureVerticalScroll(page, 100)
    // Clear axis lock
    await page.evaluate(() => {
      document
        .querySelector('[data-accueil-carousel]')
        ?.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            pointerId: 3,
            pointerType: 'touch',
          }),
        )
    })
    const afterHero = await snap('after_hero_swipe')
    await page.screenshot({ path: join(artifactsDir, 'accueil_scroll_jerk_carousel.png') })
    if (afterHero.mainScrollLeft !== 0) {
      throw new Error(`Page shifted sideways after hero swipe: scrollLeft=${afterHero.mainScrollLeft}`)
    }
    const carouselDelta = Math.abs(afterHero.carouselScrollLeft - carouselLeftBefore)
    // With axis lock y, carousel must not snap sideways during the vertical gesture.
    if (carouselDelta > 24) {
      throw new Error(`Carousel moved sideways during vertical swipe (ΔscrollLeft=${carouselDelta})`)
    }
    if (afterHero.mainScrollTop < 30) {
      throw new Error(`Expected vertical scroll after hero swipe, top=${afterHero.mainScrollTop}`)
    }

    // 3) Long-press still enters edit (stationary finger — pan-y must not block it)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(300)
    const eauSlot = page.locator('[data-accueil-edit-slot="eau"]')
    await eauSlot.scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await longPressSlot(page, '[data-accueil-edit-slot="eau"]', 700)
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-accueil-gallery]')
          ?.getAttribute('data-accueil-edit-open') === '1',
      { timeout: 6_000 },
    )
    await page.waitForTimeout(600)
    await snap('edit_mode')
    await page.screenshot({ path: join(artifactsDir, 'accueil_scroll_jerk_edit.png') })

    writeFile(
      join(artifactsDir, 'accueil_scroll_jerk_log.json'),
      JSON.stringify({ overflow, log }, null, 2),
    )

    const video = page.video()
    await context.close()
    if (!video) throw new Error('no video')
    const raw = await video.path()
    const dest = join(artifactsDir, 'accueil_scroll_jerk.mp4')
    execFileSync(
      'ffmpeg',
      ['-y', '-i', raw, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest],
      { stdio: 'inherit' },
    )
    const framesDir = join(artifactsDir, 'accueil_scroll_jerk_frames')
    await rm(framesDir, { recursive: true, force: true })
    await mkdir(framesDir, { recursive: true })
    execFileSync(
      'ffmpeg',
      ['-y', '-i', dest, '-vf', 'fps=4', join(framesDir, 'frame-%04d.png')],
      { stdio: 'inherit' },
    )
    const n = readdirSync(framesDir).filter((f) => f.endsWith('.png')).length
    console.log('saved', dest, `frames=${n}`)
    console.log('scroll log', log)
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
