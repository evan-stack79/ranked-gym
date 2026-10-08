#!/usr/bin/env node
/**
 * Captures Accueil coloured widget tiles at iPhone 17 (402×874), dark.
 * Artifacts: tuiles_accueil.png, tuiles_eau_sans_objectif.png,
 * tuiles_eau_avec_objectif.png, tuiles_mode_edition.png, tuiles_ajouter.png
 * Video: tuiles_edition.mp4 (long-press → drag → trash → re-add → OK)
 */
import { mkdir, copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
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

/** Touch long-press that keeps the finger down long enough for the 500ms timer. */
async function touchLongPress(page, x, y, holdMs = 620) {
  // Real hold: pointerdown → wait → pointerup on the slot (touch-primary).
  await page.evaluate(
    async ({ clientX, clientY, holdMs: hold }) => {
      const el = document.elementFromPoint(clientX, clientY)
      const target = el?.closest('[data-accueil-edit-slot]') ?? el
      if (!(target instanceof HTMLElement)) throw new Error('long-press: no slot')
      const fire = (type, buttons) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            buttons,
          }),
        )
      fire('pointerdown', 1)
      await new Promise((r) => setTimeout(r, hold))
      fire('pointerup', 0)
    },
    { clientX: x, clientY: y, holdMs },
  )
}

/** Slow drag so FLIP + finger-follow are visible in ~25fps video. */
async function touchDrag(page, fromX, fromY, toX, toY, steps = 28, stepDelayMs = 38) {
  await page.evaluate(
    async ({ fromX: x0, fromY: y0, toX: x1, toY: y1, steps: n, stepDelayMs: delay }) => {
      const el = document.elementFromPoint(x0, y0)
      const target = el?.closest('[data-accueil-edit-slot]') ?? el
      if (!(target instanceof HTMLElement)) throw new Error('drag: no slot')
      const fire = (type, x, y, buttons = 1) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            buttons,
          }),
        )
      fire('pointerdown', x0, y0, 1)
      for (let i = 1; i <= n; i++) {
        const t = i / n
        // Ease-in-out so the tile visibly accelerates then settles
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        fire('pointermove', x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, 1)
        await new Promise((r) => setTimeout(r, delay))
      }
      fire('pointerup', x1, y1, 0)
    },
    { fromX, fromY, toX, toY, steps, stepDelayMs },
  )
}

/** Sample widget-area luminance around OK exit — catches Reveal black flash. */
async function sampleExitLuminance(page, samples = 12, gapMs = 32) {
  const values = []
  for (let i = 0; i < samples; i++) {
    const lum = await page.evaluate(() => {
      const root = document.querySelector('[data-accueil-gallery]')
      const widgets = document.querySelector('.accueil-widgets')
      if (!(widgets instanceof HTMLElement)) return -1
      const r = widgets.getBoundingClientRect()
      const x = Math.floor(r.left + r.width / 2)
      const y = Math.floor(r.top + Math.min(120, r.height / 3))
      const el = document.elementFromPoint(x, y)
      if (!el) return 0
      const cs = getComputedStyle(el)
      // Walk up for a non-transparent background approximation
      let node = el
      for (let d = 0; d < 6 && node; d++) {
        const bg = getComputedStyle(node).backgroundColor
        const m = bg?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (m) {
          const rr = Number(m[1])
          const gg = Number(m[2])
          const bb = Number(m[3])
          if (rr + gg + bb > 0 || bg.startsWith('rgb(')) {
            return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
          }
        }
        node = node.parentElement
      }
      // Mask pending / fully clipped reveals leave the dark app shell visible —
      // also flag any pending Reveal in the gallery.
      const pending = root?.querySelectorAll('[data-rg-reveal="pending"]').length ?? 0
      const masks = [...(root?.querySelectorAll('.rg-mask-reveal') ?? [])]
      const clipped = masks.some((m) => {
        const cp = getComputedStyle(m).clipPath || getComputedStyle(m).webkitClipPath
        return cp && cp !== 'none' && /inset\(100%/.test(cp)
      })
      if (pending > 0 || clipped) return 0
      return 40
    })
    values.push(lum)
    await page.waitForTimeout(gapMs)
  }
  return values
}

function runFfmpeg(args) {
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
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

    await context.close()

    // --- Video only: tight 15–20s clip, motion ON, touch path ---
    const videoTmp = join(artifactsDir, 'video-tmp')
    await rm(videoTmp, { recursive: true, force: true })
    await mkdir(videoTmp, { recursive: true })

    const videoContext = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoTmp, size: VIEWPORT },
    })
    const vpage = await videoContext.newPage()
    await vpage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    const seedPrefs = { ...DEFAULT_PREFS, waterGoalMl: null, hidden: [], updatedAt: Date.now() }
    await vpage.addInitScript(
      ({ key, prefs, top, bottom }) => {
        try {
          localStorage.setItem(key, JSON.stringify(prefs))
        } catch {
          /* ignore */
        }
        const apply = () => {
          const root = document.documentElement
          root.style.setProperty('--app-safe-area-top', top)
          root.style.setProperty('--app-safe-area-bottom', bottom)
        }
        apply()
        document.addEventListener('DOMContentLoaded', apply)
      },
      { key: PREFS_KEY, prefs: seedPrefs, top: '47px', bottom: '34px' },
    )

    await vpage.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await settleReveals(vpage)

    // Pin scroll so viewport stays stable (week + eau + series in frame)
    await vpage.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const week = document.querySelector('[data-accueil-widget="seances_semaine"]')
      if (main instanceof HTMLElement && week instanceof HTMLElement) {
        main.scrollTo({ top: Math.max(0, week.offsetTop - 160), behavior: 'instant' })
      }
    })
    await vpage.waitForTimeout(180)

    const eauBox = await vpage.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau slot missing for video')
    const eauX = eauBox.x + eauBox.width / 2
    const eauY = eauBox.y + eauBox.height / 2

    // 1) Long-press Eau → enter edit (wiggle + − badges)
    await touchLongPress(vpage, eauX, eauY, 640)
    await vpage.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
    await vpage.waitForSelector('[data-accueil-tile-trash="eau"]', { state: 'visible', timeout: 3_000 })
    await vpage.waitForTimeout(450)

    // 2) Drag Eau above « Séances de la semaine »
    const weekBox = await vpage.locator('[data-accueil-edit-slot="seances_semaine"]').boundingBox()
    if (!weekBox) throw new Error('seances_semaine missing for drag target')
    const targetX = weekBox.x + weekBox.width / 2
    const targetY = weekBox.y + weekBox.height * 0.35
    const eauNow = await vpage.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauNow) throw new Error('eau slot lost before drag')
    await touchDrag(
      vpage,
      eauNow.x + eauNow.width / 2,
      eauNow.y + eauNow.height / 2,
      targetX,
      targetY,
      30,
      40,
    )
    await vpage.waitForTimeout(380)

    // 3) Tap − on « Séries du jour » (shrink/fade)
    await vpage.locator('[data-accueil-tile-trash="series_jour"]').tap()
    await vpage.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'detached',
      timeout: 3_000,
    })
    await vpage.waitForTimeout(280)

    // 4) + Ajouter → put Séries du jour back
    await vpage.locator('[data-accueil-edit-add]').tap()
    await vpage.waitForSelector('[data-accueil-add-item="series_jour"]', {
      state: 'visible',
      timeout: 8_000,
    })
    await vpage.waitForTimeout(280)
    await vpage.locator('[data-accueil-add-item="series_jour"]').tap()
    await vpage.waitForSelector('[data-accueil-add-list]', { state: 'detached', timeout: 5_000 })
    // Wait sheet backdrop unmount (280ms) so it cannot paint a black frame
    await vpage.waitForTimeout(320)
    await vpage.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'visible',
      timeout: 5_000,
    })
    await vpage.waitForTimeout(200)

    // 5) OK — sample luminance to prove no Reveal black flash
    const exitSamplesPromise = (async () => {
      await vpage.waitForTimeout(16)
      return sampleExitLuminance(vpage, 14, 28)
    })()
    await vpage.locator('[data-accueil-edit-ok]').tap()
    await vpage.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    const exitSamples = await exitSamplesPromise
    const blackFrames = exitSamples.filter((v) => v >= 0 && v < 8).length
    if (blackFrames > 0) {
      throw new Error(
        `Black flash on edit exit: ${blackFrames}/${exitSamples.length} dark samples ${JSON.stringify(exitSamples)}`,
      )
    }
    // Finish on Accueil with all default tiles visible
    for (const id of ['seance', 'seances_semaine', 'eau', 'series_jour', 'prochaine_seance', 'programme', 'recent']) {
      if ((await vpage.locator(`[data-accueil-edit-slot="${id}"]`).count()) < 1) {
        throw new Error(`Missing tile after OK: ${id}`)
      }
    }
    await vpage.waitForTimeout(550)

    const video = vpage.video()
    await videoContext.close()
    if (!video) throw new Error('No Playwright video handle')
    const rawPath = await video.path()
    const dest = join(artifactsDir, 'tuiles_edition.mp4')
    // Drop leading settle idle; keep a tight demo clip
    runFfmpeg([
      '-y',
      '-ss',
      '0.8',
      '-i',
      rawPath,
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      dest,
    ])
    console.log('saved', dest)
    console.log('exit luminance samples', exitSamples)

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
