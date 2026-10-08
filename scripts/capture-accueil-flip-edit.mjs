#!/usr/bin/env node
/**
 * Accueil edit FLIP proof at iPhone 17 (402×874, hasTouch/isMobile):
 * long-press → drag a tile across 2 positions (siblings slide) → drop glide →
 * − remove → + Ajouter re-add → OK.
 *
 * Artifacts:
 *   /opt/cursor/artifacts/accueil_flip_edit.mp4
 *   /opt/cursor/artifacts/accueil_flip_edit_frames/ (30 fps)
 *   /opt/cursor/artifacts/accueil_flip_edit_log.json
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
const port = 4236
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

function runFfmpeg(args) {
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
}

async function pinEditWidgets(page) {
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    const week = document.querySelector('[data-accueil-edit-slot="seances_semaine"]')
    if (!(main instanceof HTMLElement) || !(week instanceof HTMLElement)) return
    const mainRect = main.getBoundingClientRect()
    const weekRect = week.getBoundingClientRect()
    const desiredTop = mainRect.top + 108
    const delta = weekRect.top - desiredTop
    main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'instant' })
  })
  await page.waitForTimeout(180)
}

async function touchLongPress(page, x, y, holdMs = 700) {
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

/** Slow drag so FLIP sibling slides are visible at 30fps. */
async function touchDrag(page, fromX, fromY, toX, toY, steps = 40, stepDelayMs = 40) {
  return page.evaluate(
    async ({ fromX: x0, fromY: y0, toX: x1, toY: y1, steps: n, stepDelayMs: delay }) => {
      const el = document.elementFromPoint(x0, y0)
      const target = el?.closest('[data-accueil-edit-slot]') ?? el
      if (!(target instanceof HTMLElement)) throw new Error('drag: no slot')
      const fire = (type, x, y, buttons = 1, node = target) =>
        node.dispatchEvent(
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

      /** Sample sibling visual rects + in-flight FLIP marks during drag. */
      const samples = []
      const sample = (label) => {
        const week = document.querySelector('[data-accueil-edit-slot="seances_semaine"]')
        const series = document.querySelector('[data-accueil-edit-slot="series_jour"]')
        const eau = document.querySelector('[data-accueil-edit-slot="eau"]')
        const dragging = document.querySelector('[data-accueil-dragging="1"]')
        const flipping = [...document.querySelectorAll('[data-accueil-flipping="1"]')].map((el) =>
          el.getAttribute('data-accueil-edit-slot'),
        )
        const order = [...document.querySelectorAll('[data-accueil-edit-slot]')].map((el) =>
          el.getAttribute('data-accueil-edit-slot'),
        )
        const wr = week?.getBoundingClientRect()
        samples.push({
          label,
          t: performance.now(),
          weekTop: wr?.top ?? null,
          weekLeft: wr?.left ?? null,
          seriesTop: series?.getBoundingClientRect().top ?? null,
          eauTop: eau?.getBoundingClientRect().top ?? null,
          dragging: dragging?.getAttribute('data-accueil-edit-slot') ?? null,
          settling: !!document.querySelector('[data-accueil-settling="1"]'),
          flipping,
          order,
        })
      }

      fire('pointerdown', x0, y0, 1)
      sample('down')
      for (let i = 1; i <= n; i++) {
        const t = i / n
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const x = x0 + (x1 - x0) * e
        const y = y0 + (y1 - y0) * e
        const live =
          document.querySelector('[data-accueil-dragging="1"]') ??
          document.elementFromPoint(x, y)?.closest('[data-accueil-edit-slot]') ??
          target
        fire('pointermove', x, y, 1, live)
        if (i % 4 === 0 || i === n) sample(`move-${i}`)
        await new Promise((r) => setTimeout(r, delay))
      }
      const liveEnd =
        document.querySelector('[data-accueil-dragging="1"]') ??
        document.elementFromPoint(x1, y1)?.closest('[data-accueil-edit-slot]') ??
        target
      fire('pointerup', x1, y1, 0, liveEnd)
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }))
      // Only force if still dragging (don't abort an in-flight drop glide).
      if (document.querySelector('[data-accueil-dragging="1"]')) {
        window.dispatchEvent(new Event('ranked-gym:accueil-force-drag-end'))
      }
      sample('up')
      // Observe drop glide / settle
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 30))
        sample(`settle-${i}`)
      }
      return samples
    },
    { fromX, fromY, toX, toY, steps, stepDelayMs },
  )
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  const log = { steps: [], flipSamples: [], metrics: [], errors: [] }

  try {
    const browser = await chromium.launch(chromiumLaunchOptions)
    const videoDir = join(artifactsDir, 'accueil_flip_edit_raw')
    await rm(videoDir, { recursive: true, force: true })
    await mkdir(videoDir, { recursive: true })

    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      recordVideo: { dir: videoDir, size: VIEWPORT },
    })
    const page = await context.newPage()
    // Video clock — trim boot/value settle before the long-press.
    const videoT0 = Date.now()
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })

    await page.addInitScript(
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
          delete root.dataset.coldLaunchLanding
        }
        apply()
        document.addEventListener('DOMContentLoaded', apply)
      },
      {
        prefsKey: PREFS_KEY,
        goalKey: WATER_GOAL_KEY,
        prefs: { ...DEFAULT_PREFS, updatedAt: Date.now() },
        top: '47px',
        bottom: '34px',
      },
    )

    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
    await page.waitForSelector('[data-accueil-edit-slot="eau"]', { state: 'visible', timeout: 20_000 })
    await page.evaluate(() => {
      document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
        el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
      })
      document.querySelectorAll('[data-rg-reveal="pending"]').forEach((el) => {
        el.setAttribute('data-rg-reveal', 'in')
      })
    })

    await pinEditWidgets(page)
    // Harness seeds Eau 1200 + week 2 — wait before any drag / before action clock.
    await page.waitForFunction(() => {
      const norm = (s) => (s || '').replace(/[\s\u00a0\u202f]/g, '')
      const eau = document.querySelector('[data-accueil-metric-tile="eau"] [data-rg-count="water"]')
      const week = document.querySelector(
        '[data-accueil-metric-tile="seances_semaine"] [data-rg-count="sessions"]',
      )
      return norm(eau?.textContent) === '1200' && norm(week?.textContent) === '2'
    }, { timeout: 12_000 })
    await page.waitForTimeout(500)

    // Metric poll (starts after settle so boot 0→1200 is outside the action window)
    const metricLog = []
    let metricPollActive = true
    const metricPoll = (async () => {
      while (metricPollActive) {
        const snap = await page
          .evaluate(() => {
            const norm = (s) => (s || '').replace(/[\s\u00a0\u202f]/g, '')
            const eauEl = document.querySelector(
              '[data-accueil-metric-tile="eau"] [data-rg-count="water"]',
            )
            const weekEl = document.querySelector(
              '[data-accueil-metric-tile="seances_semaine"] [data-rg-count="sessions"]',
            )
            const placeholder = document.querySelector('[data-accueil-eau-placeholder="1"]')
            return {
              t: performance.now(),
              eau: placeholder ? '—' : norm(eauEl?.textContent),
              week: norm(weekEl?.textContent),
              dragging: [...document.querySelectorAll('[data-accueil-dragging="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              settling: [...document.querySelectorAll('[data-accueil-settling="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              entering: [...document.querySelectorAll('[data-accueil-entering="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              flipping: [...document.querySelectorAll('[data-accueil-flipping="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              seriesVisible: !!document.querySelector('[data-accueil-edit-slot="series_jour"]'),
            }
          })
          .catch(() => null)
        if (snap) metricLog.push(snap)
        await new Promise((r) => setTimeout(r, 160))
      }
    })()

    const actionStartMs = Date.now() - videoT0

    // 1) Long-press Eau
    const eauBox = await page.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau missing')
    await touchLongPress(page, eauBox.x + eauBox.width / 2, eauBox.y + eauBox.height / 2, 800)
    await page.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
    log.steps.push('edit-entered')
    await pinEditWidgets(page)
    await page.waitForTimeout(700)

    // 2) Drag Eau up onto « Séances de la semaine » (vertical cross of ≥1 wide tile)
    await pinEditWidgets(page)
    const orderBefore = await page.evaluate(() =>
      [...document.querySelectorAll('[data-accueil-edit-slot]')].map((el) =>
        el.getAttribute('data-accueil-edit-slot'),
      ),
    )
    const weekBox = await page.locator('[data-accueil-edit-slot="seances_semaine"]').boundingBox()
    const eauNow = await page.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!weekBox || !eauNow) throw new Error('drag targets missing')
    if (eauNow.y <= weekBox.y) {
      throw new Error(`Expected Eau below week before drag (eau.y=${eauNow.y}, week.y=${weekBox.y})`)
    }
    const flipSamples = await touchDrag(
      page,
      eauNow.x + eauNow.width / 2,
      eauNow.y + eauNow.height / 2,
      weekBox.x + weekBox.width / 2,
      weekBox.y + Math.min(48, weekBox.height * 0.3),
      48,
      45,
    )
    log.flipSamples = flipSamples
    log.steps.push('drag-drop')

    const orderAfter = await page.evaluate(() =>
      [...document.querySelectorAll('[data-accueil-edit-slot]')].map((el) =>
        el.getAttribute('data-accueil-edit-slot'),
      ),
    )
    log.orderBefore = orderBefore
    log.orderAfter = orderAfter
    if (orderBefore.join('|') === orderAfter.join('|')) {
      throw new Error(`Reorder did not change order: ${orderBefore.join(',')}`)
    }
    const eauIdxBefore = orderBefore.indexOf('eau')
    const eauIdxAfter = orderAfter.indexOf('eau')
    if (eauIdxAfter < 0 || eauIdxBefore - eauIdxAfter < 1) {
      throw new Error(
        `Eau did not move up ≥1 slot (before=${eauIdxBefore}, after=${eauIdxAfter})`,
      )
    }
    log.steps.push(`order-eau:${eauIdxBefore}→${eauIdxAfter}`)

    // Prove siblings slid: weekTop range ≥ 40px OR FLIP marks observed mid-drag
    const weekTops = flipSamples.map((s) => s.weekTop).filter((v) => typeof v === 'number')
    const weekMin = Math.min(...weekTops)
    const weekMax = Math.max(...weekTops)
    const weekRange = weekMax - weekMin
    const uniqueWeek = new Set(weekTops.map((v) => Math.round(v / 2) * 2))
    const sawFlipping = flipSamples.some((s) => (s.flipping || []).length > 0)
    if (weekRange < 40 && !sawFlipping) {
      throw new Error(
        `FLIP weak: weekTop range=${weekRange.toFixed(1)}px unique≈${[...uniqueWeek].join(',')} flipping=${sawFlipping}`,
      )
    }
    // Intermediate tops between first and last (not a 2-frame teleport)
    if (uniqueWeek.size < 3) {
      throw new Error(
        `FLIP teleport?: weekTop unique(2px)=${[...uniqueWeek].join(',')} (need ≥3)`,
      )
    }
    log.steps.push(
      `flip-intermediates:${uniqueWeek.size}:range=${Math.round(weekRange)}:flipping=${sawFlipping}`,
    )

    // Drop glide / settle clear
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-accueil-dragging="1"]').length === 0 &&
        document.querySelectorAll('[data-accueil-settling="1"]').length === 0,
      { timeout: 4_000 },
    )
    const sawSettling = flipSamples.some((s) => s.settling) || metricLog.some((s) => (s.settling || []).length > 0)
    log.steps.push(sawSettling ? 'drop-glide-seen' : 'drop-glide-missed')
    await page.waitForTimeout(700)

    // 3) Remove series_jour
    await pinEditWidgets(page)
    await page.locator('[data-accueil-tile-trash="series_jour"]').tap({ force: true })
    await page.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'detached',
      timeout: 4_000,
    })
    log.steps.push('removed-series')
    await page.waitForTimeout(800)

    // 4) + Ajouter → re-add
    await page.locator('[data-accueil-edit-add]').tap()
    await page.waitForSelector('[data-accueil-add-item="series_jour"]', {
      state: 'visible',
      timeout: 8_000,
    })
    await page.waitForTimeout(500)
    await page.locator('[data-accueil-add-item="series_jour"]').tap()
    await page.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'visible',
      timeout: 5_000,
    })
    // Entering attribute may be brief — poll
    const sawEntering = await page
      .waitForFunction(
        () => document.querySelector('[data-accueil-entering="1"]') != null,
        { timeout: 800 },
      )
      .then(() => true)
      .catch(() => metricLog.some((s) => (s.entering || []).length > 0))
    log.steps.push(sawEntering ? 'enter-anim-seen' : 'enter-anim-missed')
    await page.waitForTimeout(900)

    // 5) OK
    await page.locator('[data-accueil-edit-ok]').tap()
    await page.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    log.steps.push('ok')
    await page.waitForTimeout(900)

    metricPollActive = false
    await metricPoll.catch(() => {})
    log.metrics = metricLog

    const badMetrics = metricLog.filter(
      (s) =>
        (s.eau && s.eau !== '1200' && s.eau !== '—') ||
        (s.week && s.week !== '2' && s.week !== ''),
    )
    if (badMetrics.length > 0) {
      throw new Error(`Value flash during edit: ${JSON.stringify(badMetrics.slice(0, 6))}`)
    }
    const zeroFlash = metricLog.filter((s) => s.eau === '0')
    if (zeroFlash.length > 0) {
      throw new Error(`Eau 0 ml flash: ${JSON.stringify(zeroFlash.slice(0, 3))}`)
    }
    const lateDrag = metricLog.filter(
      (s) => s.t > Math.max(...metricLog.map((m) => m.t)) - 1500 && (s.dragging || []).length > 0,
    )
    if (lateDrag.length > 0) {
      throw new Error(`Stuck drag near end: ${JSON.stringify(lateDrag.slice(0, 2))}`)
    }

    const video = page.video()
    await context.close()
    await browser.close()
    if (!video) throw new Error('No video handle')
    const rawPath = await video.path()

    const dest = join(artifactsDir, 'accueil_flip_edit.mp4')
    const trimStart = Math.max(0, actionStartMs / 1000 - 0.25)
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

    // 30 fps frames for intermediate-position audit
    const framesDir = join(artifactsDir, 'accueil_flip_edit_frames')
    try {
      await rm(framesDir, { recursive: true, force: true })
    } catch {
      /* EIO on busy artifact FS — fall through and overwrite */
    }
    await mkdir(framesDir, { recursive: true })
    runFfmpeg(['-y', '-i', dest, '-vf', 'fps=30', join(framesDir, 'frame-%04d.png')])
    const frames = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort()
    if (frames.length < 30) {
      throw new Error(`Too few 30fps frames: ${frames.length}`)
    }

    // Luminance check — reject near-black frames after the first 5
    const { createRequire } = await import('node:module')
    let sharp
    try {
      sharp = createRequire(import.meta.url)('sharp')
    } catch {
      sharp = null
    }
    let blackFrames = 0
    if (sharp) {
      for (let i = 5; i < frames.length; i++) {
        const img = sharp(join(framesDir, frames[i]))
        const { data, info } = await img
          .resize(80, 160, { fit: 'fill' })
          .raw()
          .toBuffer({ resolveWithObject: true })
        let sum = 0
        const n = info.width * info.height
        for (let p = 0; p < n; p++) {
          const o = p * info.channels
          sum += (data[o] + data[o + 1] + data[o + 2]) / 3
        }
        const avg = sum / n
        if (avg < 4) blackFrames++
      }
    }
    if (blackFrames > 0) {
      throw new Error(`Black/blank frames after start: ${blackFrames}`)
    }

    const dur = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', dest],
      { encoding: 'utf8' },
    ).trim()

    log.video = { path: dest, durationSec: Number(dur), frames30: frames.length, blackFrames, trimStart }
    log.badMetrics = badMetrics
    await writeFile(join(artifactsDir, 'accueil_flip_edit_log.json'), JSON.stringify(log, null, 2))
    console.log(JSON.stringify({ ok: true, ...log.video, steps: log.steps, weekUnique: [...uniqueWeek] }, null, 2))
  } finally {
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
