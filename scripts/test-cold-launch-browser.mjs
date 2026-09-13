#!/usr/bin/env node
/**
 * Tests navigateur du vrai chemin App/main (pas un harness isolé).
 * - splash natif index.html (noir + panthère calme)
 * - transition React calme → rugissant → disparition
 * - durée totale 1800–2100 ms
 * - complete / naturalWidth des images
 * - chargement lent / erreur roar → reste calm
 * - pas de replay visibilitychange
 * - reduced-motion
 * - pas de flash blanc/vert
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const port = 4178
const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 30_000)
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

function rgbOf(css) {
  const m = String(css).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return { r: +m[1], g: +m[2], b: +m[3] }
}

/**
 * Installe la trace avant la navigation afin de ne pas rater une phase React
 * volontairement brève. Les assertions lisent ensuite cet historique au lieu
 * de supposer que l'état attendu est encore présent au moment du polling.
 */
async function installLaunchObserver(page) {
  await page.addInitScript(() => {
    window.__rgLaunchTrace = []
    let previous = ''

    const imageState = (img) => ({
      src: img?.getAttribute('src') ?? null,
      complete: img?.complete ?? false,
      naturalWidth: img?.naturalWidth ?? 0,
      active: img?.getAttribute('data-active') ?? null,
    })

    const record = () => {
      const boot = document.querySelector('.boot-splash')
      const cold = document.querySelector('.app-cold-launch')
      const phase = cold?.getAttribute('data-phase') ??
        (boot
          ? 'boot'
          : document.documentElement?.dataset.coldLaunchPlayed === '1'
            ? 'done'
            : null)
      const next = {
        phase,
        hasBoot: Boolean(boot),
        roarReady: cold?.getAttribute('data-roar-ready') ?? null,
        calm: imageState(cold?.querySelector('.app-cold-launch__mark--calm')),
        roar: imageState(cold?.querySelector('.app-cold-launch__mark--roar')),
      }
      const signature = JSON.stringify(next)
      if (signature === previous) return
      previous = signature
      window.__rgLaunchTrace.push({ at: performance.now(), ...next })
    }

    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'class',
        'data-phase',
        'data-active',
        'data-calm-ready',
        'data-roar-ready',
        'data-cold-launch-played',
        'src',
      ],
    })
    document.addEventListener('readystatechange', record)
    document.addEventListener('DOMContentLoaded', record)
    document.addEventListener('load', record, true)
    record()
  })
}

async function waitForRecordedPhase(page, phase, timeout = 5000) {
  await page.waitForFunction(
    (expected) => window.__rgLaunchTrace?.some((entry) => entry.phase === expected),
    phase,
    { timeout },
  )
}

async function main() {
  const server = await startServer()
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })
  try {
    // ——— Cold start réel : calm → roar → done, durée mesurée ———
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await installLaunchObserver(page)

    const t0 = Date.now()
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })

    const early = await page.evaluate(() => {
      const boot = document.querySelector('.boot-splash')
      const cold = document.querySelector('.app-cold-launch')
      const bodyBg = getComputedStyle(document.body).backgroundColor
      return {
        hasBoot: Boolean(boot),
        hasCold: Boolean(cold),
        bodyBg,
        phase: cold?.getAttribute('data-phase') ?? null,
      }
    })
    const body = rgbOf(early.bodyBg)
    assert.ok(body, 'body background parsable')
    assert.ok(body.r < 30 && body.g < 30 && body.b < 30, `fond non noir: ${early.bodyBg}`)
    assert.ok(body.g <= body.r + 8, 'pas de fond vert')

    await waitForRecordedPhase(page, 'calm')

    const calmStates = await page.evaluate(() =>
      window.__rgLaunchTrace.filter((entry) => entry.phase === 'calm'),
    )
    assert.ok(calmStates.some((entry) => entry.calm.src?.includes('brand-splash-calm') && entry.calm.active === 'true'))
    assert.ok(
      calmStates.some((entry) => entry.calm.src?.includes('brand-splash-calm') && entry.calm.complete && entry.calm.naturalWidth > 0),
      'calm image decoded',
    )

    await waitForRecordedPhase(page, 'roar')

    const roarCheck = await page.evaluate(() =>
      window.__rgLaunchTrace.find((entry) =>
        entry.phase === 'roar' && entry.roarReady === 'true' && entry.roar.active === 'true'
      ),
    )
    assert.ok(roarCheck, 'phase roar décodée et active absente de la trace')
    assert.equal(roarCheck.phase, 'roar')
    assert.equal(roarCheck.roarReady, 'true')
    assert.ok(roarCheck.roar.complete && roarCheck.roar.naturalWidth > 0, 'roar decoded')
    assert.equal(roarCheck.roar.active, 'true')

    await page.waitForFunction(
      () => document.documentElement.dataset.coldLaunchPlayed === '1',
      undefined,
      { timeout: 6000 },
    )
    const elapsed = Date.now() - t0
    assert.ok(elapsed >= 1400 && elapsed <= 3200, `durée cold launch hors cible: ${elapsed}ms`)
    const documentElapsed = await page.evaluate(() => {
      const done = window.__rgLaunchTrace.find((entry) => entry.phase === 'done')
      return done ? done.at - window.__RG_BOOT_T0__ : Number.NaN
    })
    assert.ok(
      documentElapsed >= 1800 && documentElapsed <= 2100,
      `durée document cold launch hors cible: ${documentElapsed}ms`,
    )
    assert.equal(await page.evaluate(() => document.querySelector('.app-cold-launch')), null)

    // Pas de replay au retour arrière-plan
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))
    assert.equal(
      await page.evaluate(() => document.querySelector('.app-cold-launch')),
      null,
      'replay visibilitychange',
    )
    await page.close()

    // ——— Reduced motion ———
    {
      const ctx = await browser.newContext()
      const reduced = await ctx.newPage()
      await reduced.emulateMedia({ reducedMotion: 'reduce' })
      await reduced.setViewportSize({ width: 375, height: 812 })
      await installLaunchObserver(reduced)
      const r0 = Date.now()
      await reduced.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
      await reduced.waitForFunction(
        () => document.documentElement.dataset.coldLaunchPlayed === '1',
        undefined,
        { timeout: 3000 },
      )
      const rElapsed = Date.now() - r0
      assert.ok(rElapsed < 800, `reduced-motion trop long: ${rElapsed}ms`)
      assert.equal(await reduced.evaluate(() => document.querySelector('.app-cold-launch')), null)
      await ctx.close()
    }

    // ——— Erreur roar : reste calm jusqu’à la borne ———
    {
      const pageErr = await browser.newPage()
      await installLaunchObserver(pageErr)
      await pageErr.route('**/brand-splash-roar.png', (route) => route.abort())
      await pageErr.setViewportSize({ width: 375, height: 812 })
      await pageErr.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
      await waitForRecordedPhase(pageErr, 'calm', 3000)
      await pageErr.waitForFunction(
        () => document.documentElement.dataset.coldLaunchPlayed === '1',
        undefined,
        { timeout: 6000 },
      )
      const errorTrace = await pageErr.evaluate(() => window.__rgLaunchTrace)
      assert.ok(errorTrace.some((entry) => entry.phase === 'calm'), 'calm absent après erreur roar')
      assert.ok(!errorTrace.some((entry) => entry.phase === 'roar'), 'roar affiché malgré erreur')
      assert.ok(!errorTrace.some((entry) => entry.roarReady === 'true'), 'roar marqué prêt malgré erreur')
      await pageErr.close()
    }

    // ——— Chargement roar lent : calm maintenu, puis roar si prêt avant borne ———
    {
      const pageSlow = await browser.newPage()
      await installLaunchObserver(pageSlow)
      await pageSlow.route('**/brand-splash-roar.png', async (route) => {
        await new Promise((r) => setTimeout(r, 600))
        await route.continue()
      })
      await pageSlow.setViewportSize({ width: 320, height: 568 })
      await pageSlow.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
      await waitForRecordedPhase(pageSlow, 'calm', 3000)
      // Pendant le délai : pas de roar actif sans décodage
      const midSlow = await pageSlow.evaluate(() => {
        const cold = document.querySelector('.app-cold-launch')
        return {
          phase: cold?.getAttribute('data-phase'),
          roarReady: cold?.getAttribute('data-roar-ready'),
        }
      })
      assert.equal(midSlow.phase, 'calm')
      await pageSlow.waitForFunction(
        () => document.documentElement.dataset.coldLaunchPlayed === '1',
        undefined,
        { timeout: 7000 },
      )
      await pageSlow.close()
    }

    // Sample backgrounds
    const probe = await browser.newPage()
    await probe.setViewportSize({ width: 320, height: 568 })
    await probe.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
    for (let i = 0; i < 6; i++) {
      const sample = await probe.evaluate(() => getComputedStyle(document.body).backgroundColor)
      const c = rgbOf(sample)
      assert.ok(c && c.r < 30 && c.g < 30 && c.b < 30, `flash non noir: ${sample}`)
      await probe.waitForTimeout(120)
    }
    await probe.close()

    console.log('cold-launch browser OK')
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
