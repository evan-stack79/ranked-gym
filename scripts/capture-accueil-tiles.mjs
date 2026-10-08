#!/usr/bin/env node
/**
 * Captures Accueil coloured widget tiles at iPhone 17 (402×874), dark.
 * Artifacts: tuiles_accueil.png, tuiles_eau_sans_objectif.png,
 * tuiles_eau_avec_objectif.png, tuiles_mode_edition.png, tuiles_ajouter.png
 * Video: tuiles_edition.mp4 (long-press → drag → trash → re-add → OK)
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4213

const VIEWPORT = { width: 402, height: 874 }
const PREFS_KEY = 'ranked-gym:accueil-widget-prefs'

const DEFAULT_PREFS = {
  version: 2,
  order: [
    'seance',
    'seances_semaine',
    'eau',
    'series_jour',
    'prochaine_seance',
    'programme',
    'recent',
  ],
  hidden: [],
  updatedAt: Date.now(),
  waterGoalMl: null,
}

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

async function launchBrowser() {
  try {
    const browser = await webkit.launch()
    return { browser, engine: 'webkit' }
  } catch (error) {
    console.warn('WebKit unavailable, falling back to Chromium:', error.message)
    const browser = await chromium.launch(chromiumLaunchOptions)
    return { browser, engine: 'chromium' }
  }
}

async function settleReveals(page) {
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-accueil-metric-tile="eau"]', { state: 'attached', timeout: 20_000 })
  await page
    .waitForFunction(
      () => document.querySelectorAll('[data-rg-reveal="pending"]').length === 0,
      { timeout: 5_000 },
    )
    .catch(async () => {
      await page.evaluate(() => {
        document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
          el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
          el.setAttribute('data-rg-reveal', 'in')
        })
      })
    })
  await page.waitForTimeout(350)
}

async function saveShot(page, name) {
  const path = join(artifactsDir, name)
  await page.screenshot({ path, fullPage: false })
  console.log('saved', path)
}

async function assertClean(page) {
  const text = await page.locator('[data-accueil-gallery]').innerText()
  if (/\bkcal\b/i.test(text) || /calories?/i.test(text)) {
    throw new Error('Forbidden calorie copy on Accueil')
  }
  if (/\bRPE\b/.test(text)) throw new Error('Forbidden RPE copy')
  if (/Objectif indisponible/i.test(text)) throw new Error('Error banner visible')
}

async function assertEauLayoutClean(page) {
  const result = await page.evaluate(() => {
    const tile = document.querySelector('[data-accueil-metric-tile="eau"]')
    if (!(tile instanceof HTMLElement)) return { ok: false, reason: 'missing eau tile' }
    const hint = tile.querySelector('.accueil-metric-tile__hint')
    const unit = tile.querySelector('.accueil-metric-tile__unit')
    const corner = tile.querySelector('.accueil-metric-tile__corner')
    if (!(hint instanceof HTMLElement) || !(unit instanceof HTMLElement)) {
      return { ok: false, reason: 'missing hint/unit' }
    }
    const hintText = (hint.textContent || '').trim()
    if (hintText.includes('…') || hintText.includes('...')) {
      return { ok: false, reason: `truncated hint: ${hintText}` }
    }
    if (/Définir un obj…?$/.test(hintText)) {
      return { ok: false, reason: `truncated hint: ${hintText}` }
    }
    if (hint.scrollWidth > hint.clientWidth + 1) {
      return { ok: false, reason: `hint overflow scrollWidth=${hint.scrollWidth}` }
    }
    if (corner instanceof HTMLElement) {
      const u = unit.getBoundingClientRect()
      const c = corner.getBoundingClientRect()
      const overlap = !(u.right <= c.left || u.left >= c.right || u.bottom <= c.top || u.top >= c.bottom)
      if (overlap) return { ok: false, reason: 'unit overlaps corner visual' }
    }
    return { ok: true, hint: hintText }
  })
  if (!result.ok) throw new Error(`Eau layout broken: ${result.reason}`)
}

async function scrollToEau(page) {
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    const eau = document.querySelector('[data-accueil-widget="eau"]')
    if (main instanceof HTMLElement && eau instanceof HTMLElement) {
      main.scrollTo({ top: Math.max(0, eau.offsetTop - 80), behavior: 'instant' })
    }
  })
  await page.waitForTimeout(250)
}

async function setPrefs(page, partial) {
  await page.evaluate(
    ({ key, prefs }) => {
      localStorage.setItem(key, JSON.stringify(prefs))
    },
    { key: PREFS_KEY, prefs: { ...DEFAULT_PREFS, updatedAt: Date.now(), ...partial } },
  )
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    const launched = await launchBrowser()
    browser = launched.browser
    console.log(`Browser engine: ${launched.engine}`)

    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: join(artifactsDir, 'video-tmp'),
        size: VIEWPORT,
      },
    })
    const page = await context.newPage()
    // Screenshots: reduced motion → dashed outline instead of wiggle (still shows edit chrome)
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
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

    // --- tuiles_accueil.png ---
    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await setPrefs(page, { waterGoalMl: null })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    await assertClean(page)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const week = document.querySelector('[data-accueil-widget="seances_semaine"]')
      if (main instanceof HTMLElement && week instanceof HTMLElement) {
        main.scrollTo({ top: Math.max(0, week.offsetTop - 210), behavior: 'instant' })
      }
    })
    await page.waitForTimeout(250)
    await saveShot(page, 'tuiles_accueil.png')

    // --- tuiles_eau_sans_objectif.png ---
    await scrollToEau(page)
    if ((await page.locator('[data-accueil-metric-tile="eau"] [data-accueil-ring]').count()) !== 0) {
      throw new Error('Ring shown without user water goal')
    }
    await assertEauLayoutClean(page)
    await saveShot(page, 'tuiles_eau_sans_objectif.png')

    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(200)
    await scrollToEau(page)
    await assertEauLayoutClean(page)
    await page.setViewportSize(VIEWPORT)
    await page.waitForTimeout(150)

    // --- tuiles_eau_avec_objectif.png ---
    await setPrefs(page, { waterGoalMl: 2500 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    await scrollToEau(page)
    if ((await page.locator('[data-accueil-metric-tile="eau"] [data-accueil-ring]').count()) < 1) {
      throw new Error('Ring missing with user water goal')
    }
    await assertEauLayoutClean(page)
    await saveShot(page, 'tuiles_eau_avec_objectif.png')

    // --- tuiles_mode_edition.png ---
    await setPrefs(page, { waterGoalMl: null })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    await page.click('[data-accueil-edit-open-footer]')
    await page.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 10_000 })
    await page.waitForSelector('[data-accueil-tile-trash]', { state: 'visible', timeout: 5_000 })
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const week = document.querySelector('[data-accueil-widget="seances_semaine"]')
      if (main instanceof HTMLElement && week instanceof HTMLElement) {
        main.scrollTo({ top: Math.max(0, week.offsetTop - 180), behavior: 'instant' })
      }
    })
    await page.waitForTimeout(300)
    await saveShot(page, 'tuiles_mode_edition.png')

    // --- tuiles_ajouter.png ---
    // Hide one tile first so the add list is non-empty
    await page.click('[data-accueil-tile-trash="series_jour"]')
    await page.waitForTimeout(200)
    await page.click('[data-accueil-edit-add]')
    await page.waitForSelector('[data-accueil-add-list], [data-accueil-add-empty]', {
      state: 'visible',
      timeout: 10_000,
    })
    await page.waitForTimeout(350)
    await saveShot(page, 'tuiles_ajouter.png')
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelector('[data-accueil-edit-ok]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    // --- Video: long-press, drag, trash, re-add, OK ---
    // Fresh page with motion ON so wiggle is visible in the recording
    await context.close()
    const videoContext = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: join(artifactsDir, 'video-tmp'), size: VIEWPORT },
    })
    const vpage = await videoContext.newPage()
    await vpage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    await vpage.addInitScript(() => {
      const root = document.documentElement
      root.style.setProperty('--app-safe-area-top', '47px')
      root.style.setProperty('--app-safe-area-bottom', '34px')
    })
    await vpage.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await setPrefs(vpage, { waterGoalMl: null, hidden: [] })
    await vpage.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(vpage)

    const eauSlot = vpage.locator('[data-accueil-edit-slot="eau"]')
    await eauSlot.scrollIntoViewIfNeeded()
    const box = await eauSlot.boundingBox()
    if (!box) throw new Error('eau slot missing for video')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    // Long-press via native PointerEvents (500ms+, no move) — same path as production
    await vpage.evaluate(
      async ({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        const target = el?.closest('[data-accueil-edit-slot]') ?? el
        if (!(target instanceof HTMLElement)) throw new Error('no edit slot under point')
        const opts = {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          buttons: 1,
        }
        target.dispatchEvent(new PointerEvent('pointerdown', opts))
        await new Promise((r) => setTimeout(r, 560))
        target.dispatchEvent(
          new PointerEvent('pointerup', { ...opts, buttons: 0 }),
        )
      },
      { x: cx, y: cy },
    )
    await vpage
      .waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
      .catch(async () => {
        // Fallback accessibility entry if pointer synth failed in headless
        await vpage.click('[data-accueil-edit-open-footer]')
        await vpage.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
      })
    await vpage.waitForTimeout(400)

    // Drag eau toward series_jour (pointer path on the slot)
    const seriesBox = await vpage.locator('[data-accueil-edit-slot="series_jour"]').boundingBox()
    if (seriesBox) {
      const tx = seriesBox.x + seriesBox.width / 2
      const ty = seriesBox.y + seriesBox.height / 2
      await vpage.evaluate(
        async ({ fromX, fromY, toX, toY }) => {
          const el = document.querySelector('[data-accueil-edit-slot="eau"]')
          if (!(el instanceof HTMLElement)) return
          const fire = (type, x, y, buttons = 1) =>
            el.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: true,
                buttons,
              }),
            )
          fire('pointerdown', fromX, fromY)
          const steps = 10
          for (let i = 1; i <= steps; i++) {
            const t = i / steps
            fire('pointermove', fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)
            await new Promise((r) => setTimeout(r, 30))
          }
          fire('pointerup', toX, toY, 0)
        },
        { fromX: cx, fromY: cy, toX: tx, toY: ty },
      )
    }
    await vpage.waitForTimeout(400)

    // Remove prochaine_seance
    await vpage.click('[data-accueil-tile-trash="prochaine_seance"]')
    await vpage.waitForTimeout(400)

    // Re-add via + Ajouter
    await vpage.click('[data-accueil-edit-add]')
    await vpage.waitForSelector('[data-accueil-add-item="prochaine_seance"]', {
      state: 'visible',
      timeout: 8_000,
    })
    await vpage.click('[data-accueil-add-item="prochaine_seance"]')
    await vpage.waitForTimeout(300)
    await vpage.keyboard.press('Escape').catch(() => {})
    await vpage.waitForTimeout(200)

    await vpage.click('[data-accueil-edit-ok]')
    await vpage.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    await vpage.waitForTimeout(500)

    const video = vpage.video()
    await videoContext.close()
    if (video) {
      const tmpPath = await video.path()
      const dest = join(artifactsDir, 'tuiles_edition.mp4')
      await copyFile(tmpPath, dest)
      console.log('saved', dest)
    }

    console.log('All Accueil tile artifacts captured.')
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
