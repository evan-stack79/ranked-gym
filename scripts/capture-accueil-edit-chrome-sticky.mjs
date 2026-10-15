#!/usr/bin/env node
/**
 * Accueil edit chrome pin proof at iPhone 17 (402×874, hasTouch/isMobile):
 * long-press → scroll to bottom → OK/+Ajouter still pinned → + Ajouter →
 * add a tile → OK.
 *
 * Artifacts:
 *   /opt/cursor/artifacts/accueil_edit_chrome_sticky.mp4
 *   /opt/cursor/artifacts/accueil_edit_chrome_sticky_demo.mp4
 *   /opt/cursor/artifacts/accueil_edit_chrome_sticky_bottom.png
 *   /opt/cursor/artifacts/accueil_edit_chrome_sticky_log.json
 */
import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const workDir = '/tmp/accueil-edit-chrome-sticky'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4238
const VIEWPORT = { width: 402, height: 874 }
const PREFS_KEY = 'ranked-gym:accueil-widget-prefs'
const WATER_GOAL_KEY = 'ranked-gym:water-goal'
const FPS = 30
const FRAME_MS = Math.round(1000 / FPS)
const PAUSE_FRAMES = 30

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
  // Pre-hide one tile so + Ajouter has something to re-add after scroll.
  hidden: ['series_jour'],
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

function createFrameRecorder(page, framesDir) {
  let idx = 0
  let busy = Promise.resolve()
  const writePng = async (buf) => {
    const n = ++idx
    await writeFile(join(framesDir, `frame-${String(n).padStart(4, '0')}.png`), buf)
    return n
  }
  const push = async () => writePng(await page.screenshot({ type: 'png', animations: 'allow' }))
  return {
    async snap() {
      busy = busy.then(push, push)
      return busy
    },
    async burst(n) {
      for (let i = 0; i < n; i++) await this.snap()
    },
    async hold(ms) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        await this.snap()
        await page.waitForTimeout(FRAME_MS)
      }
    },
    count: () => idx,
  }
}

async function touchLongPress(page, x, y, holdMs, recorder) {
  await recorder.snap()
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
  await recorder.burst(10)
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  try {
    await rm(workDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  await mkdir(workDir, { recursive: true })
  const framesDir = join(workDir, 'frames')
  await mkdir(framesDir, { recursive: true })

  const server = await startServer()
  const log = { steps: [], metrics: [], pinChecks: [], errors: [] }

  try {
    const browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    const recorder = createFrameRecorder(page, framesDir)

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
    await page.waitForFunction(() => {
      const norm = (s) => (s || '').replace(/[\s\u00a0\u202f]/g, '')
      const eau = document.querySelector('[data-accueil-metric-tile="eau"] [data-rg-count="water"]')
      return norm(eau?.textContent) === '1200'
    }, { timeout: 12_000 })

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
            const pin = document.querySelector('[data-accueil-edit-chrome-pin="1"]')
            const pinRect = pin?.getBoundingClientRect()
            return {
              t: performance.now(),
              eau: norm(eauEl?.textContent),
              week: norm(weekEl?.textContent),
              pinVisible: !!pin,
              pinTop: pinRect?.top ?? null,
              pinOk: !!document.querySelector('[data-accueil-edit-chrome-pin] [data-accueil-edit-ok]'),
              pinAdd: !!document.querySelector('[data-accueil-edit-chrome-pin] [data-accueil-edit-add]'),
              scrollTop: document.querySelector('[data-app-scroll-main]')?.scrollTop ?? 0,
            }
          })
          .catch(() => null)
        if (snap) metricLog.push(snap)
        await new Promise((r) => setTimeout(r, 200))
      }
    })()

    await recorder.burst(PAUSE_FRAMES)

    // Pin Eau mid-viewport (above bottom nav) so long-press is not cancelled.
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const eau = document.querySelector('[data-accueil-edit-slot="eau"]')
      if (!(main instanceof HTMLElement) || !(eau instanceof HTMLElement)) return
      const mainRect = main.getBoundingClientRect()
      const desired = mainRect.top + 280
      const r = eau.getBoundingClientRect()
      main.scrollTo({ top: Math.max(0, main.scrollTop + (r.top - desired)), behavior: 'instant' })
    })
    await page.waitForTimeout(200)
    await recorder.burst(8)

    // 1) Long-press Eau → edit
    const eauBox = await page.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau missing')
    if (eauBox.y < 80 || eauBox.y > 620) {
      throw new Error(`Eau not in long-press zone: y=${eauBox.y}`)
    }
    await touchLongPress(
      page,
      eauBox.x + eauBox.width / 2,
      eauBox.y + eauBox.height / 2,
      750,
      recorder,
    )
    await page.waitForSelector('[data-accueil-edit-chrome-pin="1"]', {
      state: 'attached',
      timeout: 5_000,
    })
    log.steps.push('edit-entered-via-longpress')
    await recorder.burst(PAUSE_FRAMES)

    // 2) Scroll to bottom of Accueil
    const scrollBefore = await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (!(main instanceof HTMLElement)) throw new Error('no scroll main')
      return { top: main.scrollTop, max: main.scrollHeight - main.clientHeight }
    })
    const targetTop = Math.max(0, scrollBefore.max)
    // Animate scroll with frames so the video shows motion.
    const steps = 18
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const y = Math.round(scrollBefore.top + (targetTop - scrollBefore.top) * t)
      await page.evaluate((top) => {
        const main = document.querySelector('[data-app-scroll-main]')
        if (main instanceof HTMLElement) main.scrollTo({ top, behavior: 'instant' })
      }, y)
      await recorder.snap()
      await page.waitForTimeout(40)
    }
    log.steps.push(`scrolled-to-bottom:${targetTop}`)

    // Pin must still be at top of viewport
    const pinAtBottom = await page.evaluate(() => {
      const pin = document.querySelector('[data-accueil-edit-chrome-pin="1"]')
      const ok = document.querySelector('[data-accueil-edit-chrome-pin] [data-accueil-edit-ok]')
      const add = document.querySelector('[data-accueil-edit-chrome-pin] [data-accueil-edit-add]')
      const main = document.querySelector('[data-app-scroll-main]')
      const pr = pin?.getBoundingClientRect()
      const style = pin ? getComputedStyle(pin) : null
      return {
        pin: !!pin,
        ok: !!ok,
        add: !!add,
        pinTop: pr?.top ?? null,
        pinHeight: pr?.height ?? null,
        position: style?.position ?? null,
        scrollTop: main instanceof HTMLElement ? main.scrollTop : null,
        recentVisible: !!document.querySelector('[data-accueil-recent]'),
      }
    })
    log.pinChecks.push(pinAtBottom)
    if (!pinAtBottom.pin || !pinAtBottom.ok || !pinAtBottom.add) {
      throw new Error(`Pin missing at bottom: ${JSON.stringify(pinAtBottom)}`)
    }
    if (pinAtBottom.position !== 'fixed') {
      throw new Error(`Expected position:fixed, got ${pinAtBottom.position}`)
    }
    if (pinAtBottom.pinTop == null || pinAtBottom.pinTop > 2) {
      // With safe-area 47px the box starts at 0 (padding inside); top of fixed = 0.
      throw new Error(`Pin not at viewport top: top=${pinAtBottom.pinTop}`)
    }
    if ((pinAtBottom.scrollTop ?? 0) < 200) {
      throw new Error(`Did not scroll far enough: ${pinAtBottom.scrollTop}`)
    }
    log.steps.push('pin-visible-at-bottom')

    // Screenshot at bottom in edit mode
    const bottomShot = join(artifactsDir, 'accueil_edit_chrome_sticky_bottom.png')
    await page.screenshot({ path: bottomShot, type: 'png', animations: 'allow' })
    await recorder.burst(PAUSE_FRAMES)

    // 3) Tap + Ajouter from bottom — sheet opens
    await page.locator('[data-accueil-edit-chrome-pin] [data-accueil-edit-add]').tap()
    await page.waitForSelector('[data-accueil-add-item="series_jour"]', {
      state: 'visible',
      timeout: 8_000,
    })
    log.steps.push('add-sheet-open')
    await recorder.burst(PAUSE_FRAMES)

    // 4) Add Séries du jour
    await page.locator('[data-accueil-add-item="series_jour"]').tap()
    await page.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'visible',
      timeout: 5_000,
    })
    log.steps.push('tile-added')
    await recorder.burst(PAUSE_FRAMES)

    // 5) OK — exit without requiring scroll to top
    const scrollBeforeOk = await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      return main instanceof HTMLElement ? main.scrollTop : 0
    })
    await page.locator('[data-accueil-edit-chrome-pin] [data-accueil-edit-ok]').tap()
    await page.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    await page.waitForSelector('[data-accueil-edit-chrome-pin="1"]', {
      state: 'detached',
      timeout: 3_000,
    })
    const scrollAfterOk = await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      return main instanceof HTMLElement ? main.scrollTop : 0
    })
    if (Math.abs(scrollAfterOk - scrollBeforeOk) > 80) {
      throw new Error(`OK caused scroll jump: ${scrollBeforeOk} → ${scrollAfterOk}`)
    }
    log.steps.push(`ok-no-scroll-jump:${scrollBeforeOk}→${scrollAfterOk}`)
    await recorder.burst(PAUSE_FRAMES)

    metricPollActive = false
    await metricPoll.catch(() => {})
    log.metrics = metricLog

    const badMetrics = metricLog.filter(
      (s) =>
        (s.eau && s.eau !== '1200' && s.eau !== '') ||
        (s.week && s.week !== '2' && s.week !== ''),
    )
    if (badMetrics.length > 0) {
      throw new Error(`Value flash: ${JSON.stringify(badMetrics.slice(0, 4))}`)
    }
    const whileEditing = metricLog.filter((s) => s.pinVisible)
    const pinLost = whileEditing.filter((s) => !s.pinOk || !s.pinAdd)
    if (pinLost.length > 0) {
      throw new Error(`Pin buttons lost while editing: ${JSON.stringify(pinLost.slice(0, 3))}`)
    }

    await context.close()
    await browser.close()

    const frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
    if (frameFiles.length < 40) {
      throw new Error(`Too few frames: ${frameFiles.length}`)
    }

    const destTmp = join(workDir, 'accueil_edit_chrome_sticky.mp4')
    runFfmpeg([
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      join(framesDir, 'frame-%04d.png'),
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      destTmp,
    ])

    const dest = join(artifactsDir, 'accueil_edit_chrome_sticky.mp4')
    const demo = join(artifactsDir, 'accueil_edit_chrome_sticky_demo.mp4')
    await copyFile(destTmp, dest)
    await copyFile(destTmp, demo)

    // Black frame check
    const { createRequire } = await import('node:module')
    let sharp
    try {
      sharp = createRequire(import.meta.url)('sharp')
    } catch {
      sharp = null
    }
    let blackFrames = 0
    if (sharp) {
      for (let i = 3; i < frameFiles.length; i++) {
        const img = sharp(join(framesDir, frameFiles[i]))
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
        if (sum / n < 4) blackFrames++
      }
    }
    if (blackFrames > 0) throw new Error(`Black/blank frames: ${blackFrames}`)

    const dur = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', dest],
      { encoding: 'utf8' },
    ).trim()

    log.video = {
      path: dest,
      demoPath: demo,
      bottomScreenshot: bottomShot,
      durationSec: Number(dur),
      frames30: frameFiles.length,
      blackFrames,
    }
    log.badMetrics = badMetrics
    await writeFile(
      join(artifactsDir, 'accueil_edit_chrome_sticky_log.json'),
      JSON.stringify(log, null, 2),
    )
    console.log(JSON.stringify({ ok: true, ...log.video, steps: log.steps }, null, 2))
  } finally {
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
