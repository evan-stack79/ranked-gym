#!/usr/bin/env node
/**
 * Accueil edit FLIP proof at iPhone 17 (402×874, hasTouch/isMobile):
 * long-press → slow drag Eau across 2 slots (siblings slide) → drop glide →
 * − remove Séries → + Ajouter → pick Séries (fade in) → OK.
 *
 * ~1 s pause between steps; drag move ~600 ms; synthetic finger overlay.
 * Encodes 30fps screenshot-burst video so WAAPI FLIP frames are present.
 *
 * Artifacts:
 *   /opt/cursor/artifacts/accueil_flip_edit.mp4
 *   /opt/cursor/artifacts/accueil_flip_edit_recording_demo.mp4
 *   /opt/cursor/artifacts/accueil_flip_edit_frames/ (30 fps)
 *   /opt/cursor/artifacts/accueil_flip_edit_drag_contact.png (10 fps sheet)
 *   /opt/cursor/artifacts/accueil_flip_edit_log.json
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
/** Scratch frames on local disk — artifact store can EIO on hundreds of rapid PNG writes. */
const workDir = '/tmp/accueil-flip-edit-capture'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4236
const VIEWPORT = { width: 402, height: 874 }
const PREFS_KEY = 'ranked-gym:accueil-widget-prefs'
const WATER_GOAL_KEY = 'ranked-gym:water-goal'
const FPS = 30
const FRAME_MS = Math.round(1000 / FPS)
/** Video-time pause (~1s at 30fps) — burst frames, not wall-clock (screenshots are slow). */
const PAUSE_FRAMES = 30
const DRAG_MS = 600

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
    const desiredTop = mainRect.top + 200
    const weekRect = week.getBoundingClientRect()
    const delta = weekRect.top - desiredTop
    main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'instant' })
  })
  await page.waitForTimeout(160)
  const boxes = await page.evaluate(() => {
    const week = document.querySelector('[data-accueil-edit-slot="seances_semaine"]')
    const eau = document.querySelector('[data-accueil-edit-slot="eau"]')
    const wr = week?.getBoundingClientRect()
    const er = eau?.getBoundingClientRect()
    return {
      weekTop: wr?.top ?? null,
      eauTop: er?.top ?? null,
      weekH: wr?.height ?? null,
      eauH: er?.height ?? null,
    }
  })
  if (
    boxes.weekTop == null ||
    boxes.eauTop == null ||
    boxes.weekTop < 80 ||
    boxes.eauTop < 80 ||
    boxes.weekTop > 620 ||
    boxes.eauTop > 720
  ) {
    throw new Error(`pinEditWidgets off-screen: ${JSON.stringify(boxes)}`)
  }
}

async function ensureFinger(page) {
  await page.evaluate(() => {
    if (document.getElementById('accueil-flip-demo-finger')) return
    const el = document.createElement('div')
    el.id = 'accueil-flip-demo-finger'
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'fixed',
      width: '34px',
      height: '34px',
      marginLeft: '-17px',
      marginTop: '-17px',
      borderRadius: '999px',
      border: '2px solid rgba(255,255,255,0.9)',
      background: 'rgba(255,43,43,0.4)',
      boxShadow: '0 0 0 8px rgba(255,43,43,0.14)',
      zIndex: '99999',
      pointerEvents: 'none',
      opacity: '0',
      left: '0px',
      top: '0px',
    })
    document.body.appendChild(el)
  })
}

async function moveFinger(page, x, y, visible = true) {
  await page.evaluate(
    ({ x: cx, y: cy, visible: on }) => {
      const el = document.getElementById('accueil-flip-demo-finger')
      if (!el) return
      el.style.left = `${cx}px`
      el.style.top = `${cy}px`
      el.style.opacity = on ? '1' : '0'
    },
    { x, y, visible },
  )
}

function createFrameRecorder(page, framesDir) {
  let idx = 0
  let busy = Promise.resolve()
  /** Marks for contact-sheet window (drag start → drop settle). */
  let dragStartIdx = null
  let dragEndIdx = null
  const writePng = async (buf) => {
    const n = ++idx
    const name = `frame-${String(n).padStart(4, '0')}.png`
    await writeFile(join(framesDir, name), buf)
    return n
  }
  const push = async () => {
    const buf = await page.screenshot({ type: 'png', animations: 'allow' })
    return writePng(buf)
  }
  return {
    markDragStart() {
      dragStartIdx = idx + 1
    },
    markDragEnd() {
      dragEndIdx = idx
    },
    dragWindow: () => ({ start: dragStartIdx, end: dragEndIdx }),
    writePng: async (buf) => {
      busy = busy.then(
        () => writePng(buf),
        () => writePng(buf),
      )
      return busy
    },
    async snap() {
      busy = busy.then(push, push)
      return busy
    },
    async hold(ms) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        await this.snap()
        await page.waitForTimeout(FRAME_MS)
      }
    },
    async burst(n) {
      for (let i = 0; i < n; i++) {
        await this.snap()
      }
    },
    count: () => idx,
  }
}

async function sampleFlip(page) {
  return page.evaluate(() => {
    const week = document.querySelector('[data-accueil-edit-slot="seances_semaine"]')
    const floatBody = document.querySelector('[data-accueil-drag-float="1"]')
    const wr = week?.getBoundingClientRect()
    const fr = floatBody?.getBoundingClientRect()
    return {
      t: performance.now(),
      weekTop: wr?.top ?? null,
      weekLeft: wr?.left ?? null,
      floatTop: fr?.top ?? null,
      floatLeft: fr?.left ?? null,
      floatVisible: !!floatBody,
      flipping: [...document.querySelectorAll('[data-accueil-flipping="1"]')].map((el) =>
        el.getAttribute('data-accueil-edit-slot'),
      ),
      settling: !!document.querySelector('[data-accueil-settling="1"]'),
      dragging: document
        .querySelector('[data-accueil-dragging="1"]')
        ?.getAttribute('data-accueil-edit-slot'),
      order: [...document.querySelectorAll('[data-accueil-edit-slot]')].map((el) =>
        el.getAttribute('data-accueil-edit-slot'),
      ),
    }
  })
}

async function touchLongPress(page, x, y, holdMs, recorder) {
  await moveFinger(page, x, y, true)
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

/**
 * Slow ~600ms drag with CDP screencast + screenshot samples.
 * Keeps lifted tile under a visible synthetic finger.
 */
async function touchDrag(page, fromX, fromY, toX, toY, recorder, samples) {
  const steps = 18
  const stepDelay = Math.round(DRAG_MS / steps)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Page.enable').catch(() => {})
  const castFrames = []
  const onFrame = (frame) => {
    castFrames.push(Buffer.from(frame.data, 'base64'))
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  }
  cdp.on('Page.screencastFrame', onFrame)
  await cdp.send('Page.startScreencast', { format: 'png', quality: 82, everyNthFrame: 1 })

  await moveFinger(page, fromX, fromY, true)
  await recorder.snap()

  let moved
  try {
    moved = await page.evaluate(
      async ({ x0, y0, x1, y1, steps: n, stepDelay: delay }) => {
        const samplesLocal = []
        const sample = (label) => {
          const week = document.querySelector('[data-accueil-edit-slot="seances_semaine"]')
          const floatBody = document.querySelector('[data-accueil-drag-float="1"]')
          const wr = week?.getBoundingClientRect()
          const fr = floatBody?.getBoundingClientRect()
          samplesLocal.push({
            label,
            t: performance.now(),
            weekTop: wr?.top ?? null,
            weekLeft: wr?.left ?? null,
            floatTop: fr?.top ?? null,
            floatLeft: fr?.left ?? null,
            floatVisible: !!floatBody,
            flipping: [...document.querySelectorAll('[data-accueil-flipping="1"]')].map((el) =>
              el.getAttribute('data-accueil-edit-slot'),
            ),
            settling: !!document.querySelector('[data-accueil-settling="1"]'),
            dragging: document
              .querySelector('[data-accueil-dragging="1"]')
              ?.getAttribute('data-accueil-edit-slot'),
            order: [...document.querySelectorAll('[data-accueil-edit-slot]')].map((el) =>
              el.getAttribute('data-accueil-edit-slot'),
            ),
          })
        }
        const finger = document.getElementById('accueil-flip-demo-finger')
        const setFinger = (x, y) => {
          if (!finger) return
          finger.style.left = `${x}px`
          finger.style.top = `${y}px`
          finger.style.opacity = '1'
        }
        const el = document.elementFromPoint(x0, y0)
        const target = el?.closest('[data-accueil-edit-slot]') ?? el
        if (!(target instanceof HTMLElement)) throw new Error('drag: no slot')
        const fire = (type, x, y, buttons = 1, node = target) => {
          const live =
            document.querySelector('[data-accueil-dragging="1"]') ??
            document.elementFromPoint(x, y)?.closest('[data-accueil-edit-slot]') ??
            node
          if (!(live instanceof HTMLElement)) return
          live.dispatchEvent(
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
          // Also feed window listeners (remount loses element capture).
          window.dispatchEvent(
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
        }
        setFinger(x0, y0)
        fire('pointerdown', x0, y0, 1)
        sample('down')
        let dropX = x1
        let dropY = y1
        let movedUp = false
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
          const x = x0 + (x1 - x0) * e
          const y = y0 + (y1 - y0) * e
          setFinger(x, y)
          fire('pointermove', x, y, 1)
          if (i % 2 === 0 || i === n) sample(`move-${i}`)
          await new Promise((r) => setTimeout(r, delay))
          const orderNow = [...document.querySelectorAll('[data-accueil-edit-slot]')].map((node) =>
            node.getAttribute('data-accueil-edit-slot'),
          )
          const eauI = orderNow.indexOf('eau')
          const weekI = orderNow.indexOf('seances_semaine')
          if (eauI >= 0 && weekI >= 0 && eauI < weekI) {
            dropX = x
            dropY = y
            movedUp = true
            sample(`moved-up-at-${i}`)
            // Hold in-page for FLIP ease-out (~250ms) while screencast runs.
            for (let h = 0; h < 10; h++) {
              await new Promise((r) => setTimeout(r, 25))
              sample(`flip-hold-${h}`)
            }
            break
          }
        }
        return { samplesLocal, dropX, dropY, movedUp }
      },
      { x0: fromX, y0: fromY, x1: toX, y1: toY, steps, stepDelay },
    )
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {})
    cdp.off('Page.screencastFrame', onFrame)
    await cdp.stabilize?.().catch?.(() => {})
    await cdp.detach().catch(() => {})
  }

  samples.push(...moved.samplesLocal)
  if (!moved.movedUp) {
    throw new Error('Drag finished without Eau moving above Séances')
  }
  const missingFloat = moved.samplesLocal.filter(
    (s) => s.label.startsWith('move-') || s.label.startsWith('flip-') || s.label.startsWith('moved-'),
  ).filter((s) => !s.floatVisible)
  if (missingFloat.length > 0) {
    throw new Error(
      `Dragged tile vanished mid-drag: ${JSON.stringify(missingFloat.slice(0, 4))}`,
    )
  }
  // Keep cast frames (workDir is local disk — artifact store gets finals only).
  const picked = castFrames.slice(0, 72)
  console.log(`screencast frames: ${castFrames.length} → kept ${picked.length}`)
  for (const buf of picked) await recorder.writePng(buf)

  await moveFinger(page, moved.dropX, moved.dropY, true)
  await page.evaluate(
    ({ dropX, dropY }) => {
      const live =
        document.querySelector('[data-accueil-dragging="1"]') ??
        document.elementFromPoint(dropX, dropY)?.closest('[data-accueil-edit-slot]')
      if (live instanceof HTMLElement) {
        live.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientX: dropX,
            clientY: dropY,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            buttons: 0,
          }),
        )
      }
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: dropX,
          clientY: dropY,
          pointerId: 7,
        }),
      )
      if (document.querySelector('[data-accueil-dragging="1"]')) {
        window.dispatchEvent(new Event('ranked-gym:accueil-force-drag-end'))
      }
    },
    { dropX: moved.dropX, dropY: moved.dropY },
  )

  for (let i = 0; i < 12; i++) {
    samples.push({ label: `settle-${i}`, ...(await sampleFlip(page)) })
    await recorder.snap()
  }
  await moveFinger(page, moved.dropX, moved.dropY, false)
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
  const log = { steps: [], flipSamples: [], metrics: [], errors: [] }

  try {
    const browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: VIEWPORT,
      // dsf 1 keeps screenshot bursts fast enough for a ≥12s 30fps demo.
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
    await ensureFinger(page)

    await pinEditWidgets(page)
    await page.waitForFunction(() => {
      const norm = (s) => (s || '').replace(/[\s\u00a0\u202f]/g, '')
      const eau = document.querySelector('[data-accueil-metric-tile="eau"] [data-rg-count="water"]')
      const week = document.querySelector(
        '[data-accueil-metric-tile="seances_semaine"] [data-rg-count="sessions"]',
      )
      return norm(eau?.textContent) === '1200' && norm(week?.textContent) === '2'
    }, { timeout: 12_000 })
    await page.waitForTimeout(300)

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
            const floatBody = document.querySelector('[data-accueil-drag-float="1"]')
            return {
              t: performance.now(),
              eau: placeholder ? '—' : norm(eauEl?.textContent),
              week: norm(weekEl?.textContent),
              floatVisible: !!floatBody,
              dragging: [...document.querySelectorAll('[data-accueil-dragging="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              settling: [...document.querySelectorAll('[data-accueil-settling="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              entering: [...document.querySelectorAll('[data-accueil-entering="1"]')].map((el) =>
                el.getAttribute('data-accueil-edit-slot'),
              ),
              seriesVisible: !!document.querySelector('[data-accueil-edit-slot="series_jour"]'),
            }
          })
          .catch(() => null)
        if (snap) metricLog.push(snap)
        await new Promise((r) => setTimeout(r, 200))
      }
    })()

    // Settled Accueil (~1s video)
    await recorder.burst(PAUSE_FRAMES)

    // 1) Long-press Eau
    const eauBox = await page.locator('[data-accueil-edit-slot="eau"]').boundingBox()
    if (!eauBox) throw new Error('eau missing')
    await touchLongPress(
      page,
      eauBox.x + eauBox.width / 2,
      eauBox.y + eauBox.height / 2,
      750,
      recorder,
    )
    await page.waitForSelector('[data-accueil-edit-ok]', { state: 'visible', timeout: 5_000 })
    log.steps.push('edit-entered')
    await pinEditWidgets(page)
    await moveFinger(page, 0, 0, false)
    await recorder.burst(PAUSE_FRAMES)

    // 2) Drag Eau up across week (FLIP siblings) — ~600ms move
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
      throw new Error(`Expected Eau below week (eau.y=${eauNow.y}, week.y=${weekBox.y})`)
    }
    const fromX = eauNow.x + eauNow.width / 2
    const fromY = eauNow.y + eauNow.height / 2
    const toX = weekBox.x + weekBox.width / 2
    const toY = weekBox.y + Math.min(48, weekBox.height * 0.3)
    const flipSamples = []
    recorder.markDragStart()
    await touchDrag(page, fromX, fromY, toX, toY, recorder, flipSamples)
    recorder.markDragEnd()
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
      throw new Error(`Eau did not move up (before=${eauIdxBefore}, after=${eauIdxAfter})`)
    }
    log.steps.push(`order-eau:${eauIdxBefore}→${eauIdxAfter}`)

    const weekTops = flipSamples.map((s) => s.weekTop).filter((v) => typeof v === 'number')
    const weekRange = Math.max(...weekTops) - Math.min(...weekTops)
    const uniqueWeek = new Set(weekTops.map((v) => Math.round(v / 2) * 2))
    const sawFlipping = flipSamples.some((s) => (s.flipping || []).length > 0)
    if (weekRange < 40 && !sawFlipping) {
      throw new Error(`FLIP weak: range=${weekRange.toFixed(1)} flipping=${sawFlipping}`)
    }
    if (uniqueWeek.size < 3) {
      throw new Error(`FLIP teleport?: unique=${[...uniqueWeek].join(',')}`)
    }
    log.steps.push(
      `flip-intermediates:${uniqueWeek.size}:range=${Math.round(weekRange)}:flipping=${sawFlipping}`,
    )

    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-accueil-dragging="1"]').length === 0 &&
        document.querySelectorAll('[data-accueil-settling="1"]').length === 0,
      { timeout: 4_000 },
    )
    const sawSettling = flipSamples.some((s) => s.settling)
    log.steps.push(sawSettling ? 'drop-glide-seen' : 'drop-glide-missed')
    await recorder.burst(PAUSE_FRAMES)

    // 3) − remove series_jour (fade out + siblings slide up)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const series = document.querySelector('[data-accueil-edit-slot="series_jour"]')
      if (!(main instanceof HTMLElement) || !(series instanceof HTMLElement)) return
      const mainRect = main.getBoundingClientRect()
      const r = series.getBoundingClientRect()
      const desired = mainRect.top + 360
      main.scrollTo({ top: Math.max(0, main.scrollTop + (r.top - desired)), behavior: 'instant' })
    })
    await page.waitForTimeout(160)
    const trashBox = await page.locator('[data-accueil-tile-trash="series_jour"]').boundingBox()
    if (trashBox) {
      await moveFinger(page, trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2, true)
      await recorder.burst(6)
    }
    await page.locator('[data-accueil-tile-trash="series_jour"]').tap({ force: true })
    await moveFinger(page, 0, 0, false)
    // Exit ~180ms + sibling FLIP — ~24 frames (~0.8s video)
    await recorder.burst(24)
    await page.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'detached',
      timeout: 4_000,
    })
    log.steps.push('removed-series')
    await recorder.burst(PAUSE_FRAMES)

    // 4) + Ajouter → pick Séries du jour (fade in)
    const addBox = await page.locator('[data-accueil-edit-add]').boundingBox()
    if (addBox) {
      await moveFinger(page, addBox.x + addBox.width / 2, addBox.y + addBox.height / 2, true)
      await recorder.burst(6)
    }
    await page.locator('[data-accueil-edit-add]').tap()
    await moveFinger(page, 0, 0, false)
    await page.waitForSelector('[data-accueil-add-item="series_jour"]', {
      state: 'visible',
      timeout: 8_000,
    })
    await recorder.burst(PAUSE_FRAMES)
    const addItem = await page.locator('[data-accueil-add-item="series_jour"]').boundingBox()
    if (addItem) {
      await moveFinger(page, addItem.x + addItem.width / 2, addItem.y + addItem.height / 2, true)
      await recorder.burst(6)
    }
    await page.locator('[data-accueil-add-item="series_jour"]').tap()
    await moveFinger(page, 0, 0, false)
    await page.waitForSelector('[data-accueil-edit-slot="series_jour"]', {
      state: 'visible',
      timeout: 5_000,
    })
    const sawEntering = await page
      .waitForFunction(() => document.querySelector('[data-accueil-entering="1"]') != null, {
        timeout: 800,
      })
      .then(() => true)
      .catch(() => metricLog.some((s) => (s.entering || []).length > 0))
    log.steps.push(sawEntering ? 'enter-anim-seen' : 'enter-anim-missed')
    // Enter fade + settle (~1s video)
    await recorder.burst(PAUSE_FRAMES)

    // 5) OK — jiggle stops, no stuck tile
    const okBox = await page.locator('[data-accueil-edit-ok]').boundingBox()
    if (okBox) {
      await moveFinger(page, okBox.x + okBox.width / 2, okBox.y + okBox.height / 2, true)
      await recorder.burst(6)
    }
    await page.locator('[data-accueil-edit-ok]').tap()
    await moveFinger(page, 0, 0, false)
    await page.waitForSelector('[data-accueil-edit-open="0"]', { timeout: 5_000 })
    log.steps.push('ok')
    await recorder.burst(PAUSE_FRAMES)

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
    if (metricLog.some((s) => s.eau === '0')) {
      throw new Error('Eau 0 ml flash')
    }
    const tMax = Math.max(...metricLog.map((m) => m.t), 0)
    const lateDrag = metricLog.filter(
      (s) => s.t > tMax - 1500 && (s.dragging || []).length > 0,
    )
    if (lateDrag.length > 0) {
      throw new Error(`Stuck drag near end: ${JSON.stringify(lateDrag.slice(0, 2))}`)
    }
    const midDragMissing = metricLog.filter(
      (s) => (s.dragging || []).includes('eau') && s.floatVisible === false,
    )
    if (midDragMissing.length > 0) {
      throw new Error(`Float missing while dragging: ${JSON.stringify(midDragMissing.slice(0, 3))}`)
    }

    await context.close()
    await browser.close()

    const frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
    if (frameFiles.length < 80) {
      throw new Error(`Too few screenshot frames: ${frameFiles.length}`)
    }

    const destTmp = join(workDir, 'accueil_flip_edit.mp4')
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

    const dest = join(artifactsDir, 'accueil_flip_edit.mp4')
    const demo = join(artifactsDir, 'accueil_flip_edit_recording_demo.mp4')
    await copyFile(destTmp, dest)
    await copyFile(destTmp, demo)

    // Contact sheet of drag+drop window at 10 fps
    const win = recorder.dragWindow()
    let contactStart = win.start ?? 1
    let contactEnd = win.end ?? frameFiles.length
    if (contactEnd < contactStart) {
      contactStart = 1
      contactEnd = frameFiles.length
    }
    const dragFramesDir = join(workDir, 'drag_frames')
    await mkdir(dragFramesDir, { recursive: true })
    // Sample every 3rd frame from 30fps → 10fps
    let sheetIdx = 0
    for (let i = contactStart; i <= contactEnd; i += 3) {
      const src = join(framesDir, `frame-${String(i).padStart(4, '0')}.png`)
      if (!existsSync(src)) continue
      sheetIdx++
      await copyFile(src, join(dragFramesDir, `sheet-${String(sheetIdx).padStart(3, '0')}.png`))
    }
    if (sheetIdx < 4) {
      throw new Error(`Contact sheet too short: ${sheetIdx} frames`)
    }
    const contactTmp = join(workDir, 'accueil_flip_edit_drag_contact.png')
    const contactPath = join(artifactsDir, 'accueil_flip_edit_drag_contact.png')
    // Tile into a contact sheet (max ~8 columns)
    const cols = Math.min(8, sheetIdx)
    runFfmpeg([
      '-y',
      '-i',
      join(dragFramesDir, 'sheet-%03d.png'),
      '-vf',
      `scale=201:-1,tile=${cols}x${Math.ceil(sheetIdx / cols)}`,
      '-frames:v',
      '1',
      contactTmp,
    ])
    await copyFile(contactTmp, contactPath)

    // Also publish a short 30fps extract of the drag window for ffmpeg verify
    const framesOut = join(artifactsDir, 'accueil_flip_edit_frames')
    try {
      await rm(framesOut, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    await mkdir(framesOut, { recursive: true })
    // Copy drag-window frames only (keeps artifact store light)
    let pub = 0
    for (let i = contactStart; i <= contactEnd; i++) {
      const src = join(framesDir, `frame-${String(i).padStart(4, '0')}.png`)
      if (!existsSync(src)) continue
      pub++
      await copyFile(src, join(framesOut, `frame-${String(pub).padStart(4, '0')}.png`))
    }

    // Luminance check — reject near-black frames after the first few
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

    const durationSec = Number(dur)
    if (!(durationSec >= 10)) {
      throw new Error(`Video too short for full flow: ${durationSec}s (need ≥10s)`)
    }

    log.video = {
      path: dest,
      demoPath: demo,
      contactSheet: contactPath,
      durationSec,
      frames30: frameFiles.length,
      dragContactFrames: sheetIdx,
      dragWindow: win,
      blackFrames,
      method: 'screenshot-burst+screencast',
    }
    log.badMetrics = badMetrics
    await writeFile(join(artifactsDir, 'accueil_flip_edit_log.json'), JSON.stringify(log, null, 2))
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...log.video,
          steps: log.steps,
          weekUnique: [...uniqueWeek],
        },
        null,
        2,
      ),
    )
  } finally {
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
