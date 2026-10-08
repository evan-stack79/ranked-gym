#!/usr/bin/env node
/**
 * Captures Accueil coloured widget tiles at iPhone 17 (402×874), dark.
 * Artifacts: tuiles_accueil.png, tuiles_eau_sans_objectif.png,
 * tuiles_eau_avec_objectif.png, tuiles_modifier_accueil.png
 */
import { mkdir } from 'node:fs/promises'
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
  if (/Something went wrong|Erreur/i.test(text) && /stack/i.test(text)) {
    throw new Error('Error UI visible')
  }
}

async function scrollToEau(page) {
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    const eau = document.querySelector('[data-accueil-widget="eau"]')
    if (main instanceof HTMLElement && eau instanceof HTMLElement) {
      const top = eau.offsetTop - 80
      main.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    }
  })
  await page.waitForTimeout(250)
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

    // --- tuiles_accueil.png (default, no water goal) ---
    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((key) => {
      const prefs = {
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
      localStorage.setItem(key, JSON.stringify(prefs))
    }, PREFS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    await assertClean(page)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(200)
    await saveShot(page, 'tuiles_accueil.png')

    // --- tuiles_eau_sans_objectif.png ---
    await scrollToEau(page)
    const ringSans = await page.locator('[data-accueil-metric-tile="eau"] [data-accueil-ring]').count()
    if (ringSans !== 0) throw new Error('Ring shown without user water goal')
    await assertClean(page)
    await saveShot(page, 'tuiles_eau_sans_objectif.png')

    // --- tuiles_eau_avec_objectif.png ---
    await page.evaluate((key) => {
      const raw = localStorage.getItem(key)
      const prefs = raw ? JSON.parse(raw) : {}
      prefs.waterGoalMl = 2500
      prefs.updatedAt = Date.now()
      prefs.version = 2
      localStorage.setItem(key, JSON.stringify(prefs))
    }, PREFS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await settleReveals(page)
    await scrollToEau(page)
    const ringAvec = await page.locator('[data-accueil-metric-tile="eau"] [data-accueil-ring]').count()
    if (ringAvec < 1) throw new Error('Ring missing with user water goal')
    await assertClean(page)
    await saveShot(page, 'tuiles_eau_avec_objectif.png')

    // --- tuiles_modifier_accueil.png ---
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.click('[data-accueil-edit-open-footer]')
    await page.waitForSelector('[data-accueil-edit-list]', { state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(400)
    const rows = await page.locator('[data-accueil-edit-row]').count()
    if (rows < 5) throw new Error(`Expected edit rows for new tiles, got ${rows}`)
    await saveShot(page, 'tuiles_modifier_accueil.png')

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
