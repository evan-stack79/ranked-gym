#!/usr/bin/env node
/**
 * Repro: Accueil hero Reveal stuck pending after home → Train → home remount.
 *
 * Hypothesis: useInViewOnce + clip-path inset(100%) leaves .rg-mask-reveal
 * without --in when HomeGalleryView remounts with coldEntering=false.
 *
 * Uses the Accueil gallery harness (same unmount path as AppShell renderActiveView).
 * Motion ON (no prefers-reduced-motion) — capture scripts that use reduce mask this.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4217

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

/** Probe Reveal wrappers around [data-accueil-hero]. */
async function probeHeroes(page) {
  return page.evaluate(() => {
    const heroes = [...document.querySelectorAll('[data-accueil-hero]')]
    return heroes.map((hero) => {
      const reveal = hero.closest('[data-rg-reveal]')
      const mask =
        reveal?.querySelector('.rg-mask-reveal') ??
        (reveal?.classList.contains('rg-mask-reveal') ? reveal : null)
      const style = mask ? getComputedStyle(mask) : reveal ? getComputedStyle(reveal) : null
      const rect = reveal?.getBoundingClientRect()
      return {
        heroId: hero.getAttribute('data-accueil-hero'),
        reveal: reveal?.getAttribute('data-rg-reveal') ?? null,
        motion: reveal?.getAttribute('data-rg-motion') ?? null,
        className: reveal?.className ?? null,
        maskClassName: mask?.className ?? null,
        hasInClass: Boolean(mask?.classList.contains('rg-mask-reveal--in')),
        clipPath: style?.clipPath ?? null,
        transform: style?.transform ?? null,
        rect: rect
          ? { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width }
          : null,
        coldLanding: document.documentElement.dataset.coldLaunchLanding ?? null,
        galleryCold: document.querySelector('[data-accueil-gallery]')?.className.includes(
          'home-cold-enter--active',
        ),
      }
    })
  })
}

/** Minimal clip-path × IntersectionObserver sanity check (no React). */
async function probeClipPathIo(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const host = document.createElement('div')
        host.style.cssText =
          'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:40px;pointer-events:none;z-index:99999'
        const el = document.createElement('div')
        el.style.cssText =
          'width:200px;height:280px;background:#f00;clip-path:inset(100% 0 0 0);transform:translate3d(0,10px,0)'
        el.dataset.ioProbe = '1'
        host.appendChild(el)
        document.body.appendChild(host)

        if (typeof IntersectionObserver === 'undefined') {
          host.remove()
          resolve({ supported: false })
          return
        }

        let fired = false
        const entriesLog = []
        const io = new IntersectionObserver(
          (entries) => {
            fired = true
            for (const e of entries) {
              entriesLog.push({
                isIntersecting: e.isIntersecting,
                intersectionRatio: e.intersectionRatio,
              })
            }
          },
          { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.12 },
        )
        io.observe(el)

        // Also check geometric visibility after a couple frames
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const rect = el.getBoundingClientRect()
              const inViewport =
                rect.top < window.innerHeight &&
                rect.bottom > 0 &&
                rect.left < window.innerWidth &&
                rect.right > 0 &&
                rect.height > 0 &&
                rect.width > 0
              io.disconnect()
              host.remove()
              resolve({
                supported: true,
                fired,
                entriesLog,
                inViewport,
                rect: {
                  top: rect.top,
                  height: rect.height,
                  width: rect.width,
                },
              })
            }, 120)
          })
        })
      }),
  )
}

async function waitForHeroes(page, label, { expectIn = true, timeoutMs = 2500 } = {}) {
  const started = Date.now()
  let last = []
  while (Date.now() - started < timeoutMs) {
    last = await probeHeroes(page)
    if (last.length === 0) {
      await page.waitForTimeout(50)
      continue
    }
    const allIn = last.every((h) => h.reveal === 'in')
    const anyPending = last.some((h) => h.reveal === 'pending')
    if (expectIn && allIn) return { ok: true, heroes: last, ms: Date.now() - started }
    if (!expectIn && anyPending) return { ok: true, heroes: last, ms: Date.now() - started }
    await page.waitForTimeout(50)
  }
  return { ok: false, heroes: last, ms: Date.now() - started, label }
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const report = {
    engine: null,
    clipPathIo: null,
    firstMount: null,
    afterRemount: null,
    remountStuckPending: null,
    verdict: null,
  }

  const server = await startServer()
  let browser
  try {
    const launched = await launchBrowser()
    browser = launched.browser
    report.engine = launched.engine
    console.log(`Browser engine: ${launched.engine}`)

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      // Critical: do NOT reduce motion — that forces Reveal instant and masks the bug.
      reducedMotion: null,
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => console.warn('pageerror:', error.message))

    // Prefer no-preference for motion
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    await page.goto(`http://127.0.0.1:${port}/?tab=home`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
    await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 15_000 })
    await page.waitForSelector('[data-accueil-hero]', { state: 'attached', timeout: 15_000 })

    report.clipPathIo = await probeClipPathIo(page)
    console.log('clipPathIo:', JSON.stringify(report.clipPathIo, null, 2))

    const first = await waitForHeroes(page, 'first-mount', { expectIn: true, timeoutMs: 3000 })
    report.firstMount = first
    console.log('firstMount:', JSON.stringify(first, null, 2))
    await page.screenshot({
      path: join(artifactsDir, 'repro-reveal-first-mount.png'),
      fullPage: false,
    })

    // Switch to Train via real bottom nav (unmounts HomeView)
    await page.click('[aria-label="Train"]')
    await page.waitForSelector('[aria-current="page"][aria-label="Train"]', { timeout: 10_000 })
    await page.waitForSelector('[data-accueil-gallery]', { state: 'detached', timeout: 10_000 })
    await page.waitForTimeout(200)

    // Back to Accueil (remount, coldEntering=false)
    await page.click('[aria-label="Accueil"]')
    await page.waitForSelector('[aria-current="page"][aria-label="Accueil"]', { timeout: 10_000 })
    await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 10_000 })
    await page.waitForSelector('[data-accueil-hero]', { state: 'attached', timeout: 10_000 })

    // Immediate probe (before waiting) — captures stuck-pending if IO never fires
    const immediate = await probeHeroes(page)
    console.log('remountImmediate:', JSON.stringify(immediate, null, 2))

    const remount = await waitForHeroes(page, 'remount', { expectIn: true, timeoutMs: 3000 })
    report.afterRemount = { immediate, waited: remount }
    console.log('afterRemount:', JSON.stringify(report.afterRemount, null, 2))

    await page.screenshot({
      path: join(artifactsDir, 'repro-reveal-after-remount.png'),
      fullPage: false,
    })

    const stuckPending =
      remount.heroes.length > 0 && remount.heroes.every((h) => h.reveal === 'pending')
    const clipped =
      remount.heroes.length > 0 &&
      remount.heroes.every(
        (h) =>
          h.reveal === 'pending' &&
          h.clipPath &&
          (h.clipPath.includes('inset(100%') || h.clipPath === 'inset(100%)'),
      )
    report.remountStuckPending = stuckPending
    report.remountStillClipped = clipped
    report.clipPathIoStillBroken = Boolean(
      report.clipPathIo?.fired &&
        report.clipPathIo.entriesLog?.some(
          (e) => e.isIntersecting === false && e.intersectionRatio === 0,
        ) &&
        report.clipPathIo.inViewport,
    )

    // Also: first mount without cold — was it already pending forever?
    const firstStuck =
      !first.ok && first.heroes.length > 0 && first.heroes.every((h) => h.reveal === 'pending')

    if (stuckPending || clipped || firstStuck) {
      report.verdict = 'REAL_BUG'
      report.reason =
        'Hero Reveal stayed data-rg-reveal=pending with clip-path fully inset. Root cause: IntersectionObserver treats clip-path inset(100%) as non-intersecting (ratio 0) while the layout box is on-screen. coldEntering/reduced-motion mask this; remount with coldEntering=false exposes it.'
    } else if (first.ok && remount.ok) {
      report.verdict = report.clipPathIoStillBroken ? 'FIXED' : 'OK'
      report.reason =
        'First mount and remount both reached data-rg-reveal=in. ' +
        (report.clipPathIoStillBroken
          ? 'Isolated clip-path×IO probe still reports ratio 0 (expected) — fix must keep clip-path off the observed node and/or use layout-box fallback.'
          : 'IO sees the observed box normally.')
    } else {
      report.verdict = 'INCONCLUSIVE'
      report.reason = 'Heroes present but reveal state mixed / timed out inconsistently.'
    }

    await writeFile(
      join(artifactsDir, 'repro-accueil-reveal-remount.json'),
      JSON.stringify(report, null, 2),
    )
    console.log('VERDICT:', report.verdict)
    console.log('REASON:', report.reason)
    console.log('Wrote', join(artifactsDir, 'repro-accueil-reveal-remount.json'))
  } finally {
    await browser?.close()
    await stopServer(server)
  }

  if (report.verdict === 'REAL_BUG' || report.verdict === 'INCONCLUSIVE') {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
