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
const WATER_GOAL_KEY = 'ranked-gym:water-goal'

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
    if (/Choisir mon obj…?$/.test(hintText) || /Définir un obj…?$/.test(hintText)) {
      return { ok: false, reason: `truncated hint: ${hintText}` }
    }
    if (/\b250\b/.test(hintText) || /\b6000\b/.test(hintText)) {
      return { ok: false, reason: `bound numbers leaked: ${hintText}` }
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

async function setPrefs(page, partial = {}) {
  const { waterGoalMl, ...prefsPartial } = partial
  await page.evaluate(
    ({ prefsKey, goalKey, prefs, waterGoalMl: goal }) => {
      localStorage.setItem(prefsKey, JSON.stringify(prefs))
      if (goal == null) {
        localStorage.removeItem(goalKey)
      } else {
        localStorage.setItem(
          goalKey,
          JSON.stringify({
            version: 1,
            goalMl: goal,
            source: 'user',
            updatedAt: Date.now(),
          }),
        )
      }
    },
    {
      prefsKey: PREFS_KEY,
      goalKey: WATER_GOAL_KEY,
      prefs: { ...DEFAULT_PREFS, updatedAt: Date.now(), ...prefsPartial },
      waterGoalMl,
    },
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

/**
 * Sample Reveal health around OK exit — catches real mask re-hides.
 * Returns { pending, clipped, instant, total } per tick (not raw luminance:
 * transparent rgba(0,0,0,0) parents made a luminance heuristic always read 0).
 */
async function sampleExitRevealHealth(page, samples = 12, gapMs = 32) {
  const values = []
  for (let i = 0; i < samples; i++) {
    const snap = await page.evaluate(() => {
      const root = document.querySelector('[data-accueil-gallery]')
      const masks = [...(root?.querySelectorAll('.rg-mask-reveal') ?? [])]
      const pending = root?.querySelectorAll('[data-rg-reveal="pending"]').length ?? 0
      const clipped = masks.filter((m) => {
        if (m.classList.contains('rg-mask-reveal--instant')) return false
        const cp = getComputedStyle(m).clipPath || ''
        return /inset\(100%/.test(cp)
      }).length
      const instant = masks.filter((m) => m.classList.contains('rg-mask-reveal--instant')).length
      return { pending, clipped, instant, total: masks.length }
    })
    values.push(snap)
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

    // Warm Vite + settle WITHOUT recording, then film a tight action clip.
    await setPrefs(page, { waterGoalMl: null, hidden: [] })
    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    const storageState = await context.storageState()
    await context.close()

    // --- Video only: ~15–20s, motion ON, touch path ---
    const videoTmp = join(artifactsDir, 'video-tmp')
    await rm(videoTmp, { recursive: true, force: true })
    await mkdir(videoTmp, { recursive: true })

    const videoContext = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState,
      recordVideo: { dir: videoTmp, size: VIEWPORT },
    })
    const vpage = await videoContext.newPage()
    await vpage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    const seedPrefs = { ...DEFAULT_PREFS, hidden: [], updatedAt: Date.now() }
    await vpage.addInitScript(
      ({ prefsKey, goalKey, prefs, top, bottom }) => {
        try {
          localStorage.setItem(prefsKey, JSON.stringify(prefs))
          localStorage.removeItem(goalKey)
        } catch {
          /* ignore */
        }
        const apply = () => {
          const root = document.documentElement
          root.style.setProperty('--app-safe-area-top', top)
          root.style.setProperty('--app-safe-area-bottom', bottom)
          // Skip cold-launch mask so the clip starts on a settled Accueil.
          delete root.dataset.coldLaunchLanding
        }
        apply()
        document.addEventListener('DOMContentLoaded', apply)
      },
      {
        prefsKey: PREFS_KEY,
        goalKey: WATER_GOAL_KEY,
        prefs: seedPrefs,
        top: '47px',
        bottom: '34px',
      },
    )

    const videoT0 = Date.now()
    await vpage.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await vpage.waitForSelector('[data-accueil-edit-slot="eau"]', { state: 'visible', timeout: 15_000 })
    await vpage.evaluate(() => {
      document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
        el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
      })
      document.querySelectorAll('[data-rg-reveal="pending"]').forEach((el) => {
        el.setAttribute('data-rg-reveal', 'in')
      })
    })

    // Pin scroll so week + eau + series sit above the bottom nav (stable viewport)
    await vpage.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const eau = document.querySelector('[data-accueil-edit-slot="eau"]')
      if (!(main instanceof HTMLElement) || !(eau instanceof HTMLElement)) return
      const mainRect = main.getBoundingClientRect()
      const eauRect = eau.getBoundingClientRect()
      const desiredCenterY = mainRect.top + mainRect.height * 0.48
      const delta = eauRect.top + eauRect.height / 2 - desiredCenterY
      main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'instant' })
    })
    await vpage.waitForTimeout(120)

    const eauBox = await vpage.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau slot missing for video')
    const eauX = eauBox.x + eauBox.width / 2
    const eauY = eauBox.y + eauBox.height / 2
    const hit = await vpage.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        return el?.closest('[data-accueil-edit-slot]')?.getAttribute('data-accueil-edit-slot') ?? null
      },
      { x: eauX, y: eauY },
    )
    if (hit !== 'eau') {
      throw new Error(`Long-press target blocked (hit=${hit}); eau must clear bottom nav`)
    }

    // Action clock — trim ffmpeg from just before the long-press.
    // Every step stays on camera ~1s+ (no jumps/cuts between taps).
    const actionStartMs = Date.now() - videoT0

    // Baseline metrics must be settled before any drag (no mid-count flash).
    await vpage.waitForFunction(() => {
      const eau = document.querySelector('[data-accueil-metric-tile="eau"] [data-rg-count="water"]')
      const week = document.querySelector(
        '[data-accueil-metric-tile="seances_semaine"] [data-rg-count="sessions"]',
      )
      const eauTxt = (eau?.textContent || '').replace(/\s/g, '')
      const weekTxt = (week?.textContent || '').replace(/\s/g, '')
      return eauTxt === '1200' && weekTxt === '2'
    }, { timeout: 8_000 })

    /** Poll DOM every 250ms for the whole action clip — catches data flashes. */
    const metricLog = []
    let metricPollActive = true
    const metricPoll = (async () => {
      while (metricPollActive) {
        const snap = await vpage
          .evaluate(() => {
            const norm = (s) => (s || '').replace(/\s/g, '')
            const eauEl = document.querySelector(
              '[data-accueil-metric-tile="eau"] [data-rg-count="water"]',
            )
            const weekEl = document.querySelector(
              '[data-accueil-metric-tile="seances_semaine"] [data-rg-count="sessions"]',
            )
            const placeholder = document.querySelector('[data-accueil-eau-placeholder="1"]')
            const dragging = [
              ...document.querySelectorAll('[data-accueil-dragging="1"]'),
            ].map((el) => el.getAttribute('data-accueil-edit-slot'))
            return {
              t: Date.now(),
              eau: placeholder ? '—' : norm(eauEl?.textContent),
              week: norm(weekEl?.textContent),
              dragging,
            }
          })
          .catch(() => null)
        if (snap) metricLog.push(snap)
        await vpage.waitForTimeout(250).catch(() => {})
      }
    })()
    await vpage.waitForTimeout(1000)

    // 1) Long-press Eau → wiggle (~1s hold visible)
    await touchLongPress(vpage, eauX, eauY, 900)
    await vpage.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
    await vpage.waitForSelector('[data-accueil-tile-trash="eau"]', { state: 'visible', timeout: 3_000 })
    await vpage.waitForTimeout(1200)

    // 2) Drag Eau above « Séances de la semaine » (slow finger-follow + FLIP)
    const weekBox = await vpage.locator('[data-accueil-edit-slot="seances_semaine"]').boundingBox()
    if (!weekBox) throw new Error('seances_semaine missing for drag target')
    const targetX = weekBox.x + weekBox.width / 2
    const targetY = weekBox.y + Math.min(36, weekBox.height * 0.25)
    const eauNow = await vpage.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauNow) throw new Error('eau slot lost before drag')
    await touchDrag(
      vpage,
      eauNow.x + eauNow.width / 2,
      eauNow.y + eauNow.height / 2,
      targetX,
      targetY,
      40,
      45,
    )
    // Drop settle — confirm not stuck in dragging state
    await vpage.waitForFunction(
      () => document.querySelectorAll('[data-accueil-dragging="1"]').length === 0,
      { timeout: 3_000 },
    )
    await vpage.waitForTimeout(1100)

    // 3) Tap − on « Séries du jour » (must be visible on camera ~1s)
    const seriesTrash = vpage.locator('[data-accueil-tile-trash="series_jour"]')
    await seriesTrash.waitFor({ state: 'visible', timeout: 5_000 })
    await vpage.waitForTimeout(400)
    await seriesTrash.tap({ force: true })
    await vpage.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'detached',
      timeout: 3_000,
    })
    await vpage.waitForTimeout(1100)

    // 4) Tap + Ajouter (must be visible) → sheet opens
    const addBtn = vpage.locator('[data-accueil-edit-add]')
    await addBtn.waitFor({ state: 'visible', timeout: 5_000 })
    await vpage.waitForTimeout(400)
    await addBtn.tap()
    await vpage.waitForSelector('[data-accueil-add-item="series_jour"]', {
      state: 'visible',
      timeout: 8_000,
    })
    // Stuck-drag guard: Eau must not stay lifted after sheet opens
    const stuck = await vpage.evaluate(
      () => document.querySelector('[data-accueil-edit-slot="eau"]')?.getAttribute('data-accueil-dragging'),
    )
    if (stuck === '1') throw new Error('Eau still dragging after Ajouter sheet opened')
    await vpage.waitForTimeout(1100)

    // 5) Re-add Séries
    await vpage.locator('[data-accueil-add-item="series_jour"]').tap()
    await vpage.waitForSelector('.ios-sheet-backdrop', { state: 'detached', timeout: 5_000 }).catch(() => {})
    await vpage.waitForSelector('[data-accueil-add-list]', { state: 'detached', timeout: 5_000 })
    await vpage.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'visible',
      timeout: 5_000,
    })
    await vpage.waitForTimeout(1100)

    // 6) OK — sample Reveal health to prove no mask re-hide / black flash
    const exitSamplesPromise = (async () => {
      await vpage.waitForTimeout(16)
      return sampleExitRevealHealth(vpage, 14, 28)
    })()
    await vpage.locator('[data-accueil-edit-ok]').tap()
    await vpage.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    const exitSamples = await exitSamplesPromise
    const bad = exitSamples.filter((s) => s.pending > 0 || s.clipped > 0 || s.instant < s.total)
    if (bad.length > 0) {
      throw new Error(`Black flash on edit exit: ${JSON.stringify(bad)}`)
    }
    // Finish on Accueil with all default tiles visible + stable Eau 1200
    for (const id of ['seance', 'seances_semaine', 'eau', 'series_jour', 'prochaine_seance', 'programme', 'recent']) {
      if ((await vpage.locator(`[data-accueil-edit-slot="${id}"]`).count()) < 1) {
        throw new Error(`Missing tile after OK: ${id}`)
      }
    }
    await vpage.waitForFunction(() => {
      const eau = document.querySelector('[data-accueil-metric-tile="eau"] [data-rg-count="water"]')
      return (eau?.textContent || '').replace(/\s/g, '') === '1200'
    }, { timeout: 5_000 })
    await vpage.waitForTimeout(1200)

    metricPollActive = false
    await metricPoll.catch(() => {})
    const badMetrics = metricLog.filter(
      (s) =>
        (s.eau && s.eau !== '1200' && s.eau !== '—') ||
        (s.week && s.week !== '2' && s.week !== ''),
    )
    if (badMetrics.length > 0) {
      throw new Error(
        `Data flash during edit video: ${JSON.stringify(badMetrics.slice(0, 8))}`,
      )
    }
    console.log(`metric poll ok: ${metricLog.length} samples @250ms, eau=1200 week=2`)

    const video = vpage.video()
    await videoContext.close()
    if (!video) throw new Error('No Playwright video handle')
    const rawPath = await video.path()
    const dest = join(artifactsDir, 'tuiles_edition.mp4')
    // Trim settle/boot; keep a short beat before the long-press
    const trimStart = Math.max(0, actionStartMs / 1000 - 0.35)
    runFfmpeg([
      '-y',
      '-i',
      rawPath,
      '-ss',
      trimStart.toFixed(2),
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      dest,
    ])
    const dur = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', dest],
      { encoding: 'utf8' },
    ).trim()
    console.log('saved', dest, `trimStart=${trimStart.toFixed(2)}s duration=${dur}s`)
    console.log('exit reveal health', exitSamples[0], '…', exitSamples[exitSamples.length - 1])

    // Extract frames every 0.25s and OCR-check Eau / Séances digits when tesseract exists.
    const framesDir = join(artifactsDir, 'tuiles_edition_frames')
    await rm(framesDir, { recursive: true, force: true })
    await mkdir(framesDir, { recursive: true })
    runFfmpeg(['-y', '-i', dest, '-vf', 'fps=4', join(framesDir, 'frame-%04d.png')])
    const { readdirSync, writeFileSync } = await import('node:fs')
    const frames = readdirSync(framesDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
    writeFileSync(
      join(artifactsDir, 'tuiles_edition_metric_poll.json'),
      JSON.stringify({ samples: metricLog, badMetrics }, null, 2),
    )
    console.log(`frame extract: ${frames.length} frames @ 4fps → ${framesDir}`)

    let tesseractOk = false
    try {
      execFileSync('tesseract', ['--version'], { stdio: 'pipe' })
      tesseractOk = true
    } catch {
      tesseractOk = false
    }
    if (tesseractOk && frames.length > 0) {
      const ocrHits = { eau1200: 0, eauBad: [], week2: 0, weekBad: [] }
      // Crop lower-mid band where metric tiles sit after scroll; OCR whole frame as fallback.
      for (let i = 0; i < frames.length; i++) {
        const name = frames[i]
        const path = join(framesDir, name)
        let text = ''
        try {
          text = execFileSync(
            'tesseract',
            [path, 'stdout', '-l', 'eng', '--psm', '6'],
            { encoding: 'utf8' },
          )
        } catch {
          continue
        }
        const compact = text.replace(/\s/g, '')
        // Accept 1200 / 1 200 / 1,200
        if (/1[,.]?200|1200/.test(compact)) ocrHits.eau1200++
        if (/\b716\b/.test(text) || /(?:^|[^\d])0ml/i.test(compact)) {
          ocrHits.eauBad.push({ frame: name, text: text.slice(0, 120) })
        }
        if (/\b2\b/.test(text) && /s[eé]ance/i.test(text)) ocrHits.week2++
        if (/\b1\s*s[eé]ance/i.test(text) && !/\b2\s*s[eé]ance/i.test(text)) {
          ocrHits.weekBad.push({ frame: name, text: text.slice(0, 120) })
        }
      }
      if (ocrHits.eauBad.length > 0 || ocrHits.weekBad.length > 0) {
        throw new Error(
          `OCR frame audit failed: ${JSON.stringify({ eauBad: ocrHits.eauBad, weekBad: ocrHits.weekBad })}`,
        )
      }
      console.log(
        `OCR frame audit ok: eau1200=${ocrHits.eau1200}/${frames.length} week2hits=${ocrHits.week2}`,
      )
    } else {
      console.log('tesseract unavailable — relied on live 250ms DOM metric poll')
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
