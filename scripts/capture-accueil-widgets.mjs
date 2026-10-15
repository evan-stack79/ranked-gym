#!/usr/bin/env node
/**
 * Captures Accueil widget customisation artifacts at iPhone 17 (402×874), dark.
 * Uses the seeded accueil-gallery harness — real cards, not placeholders.
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
const port = 4212

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

async function waitForCards(page) {
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-accueil-gallery]', { state: 'attached', timeout: 30_000 })
  // Wait for at least one cover image so cards are not blank
  await page.waitForSelector(
    '[data-accueil-hero-img="cover"], [data-history-thumb-img="cover"], [data-accueil-program-img="cover"]',
    { state: 'attached', timeout: 20_000 },
  )
  // Prefer settled reveals (reduced-motion → instant; otherwise wait briefly)
  await page
    .waitForFunction(
      () => {
        const pending = document.querySelectorAll('[data-rg-reveal="pending"]')
        const heroes = document.querySelectorAll('[data-accueil-hero]')
        if (heroes.length === 0) return false
        return pending.length === 0
      },
      { timeout: 5_000 },
    )
    .catch(async () => {
      // Headless IO can stall — force reveal to final state for the shot
      await page.evaluate(() => {
        document.querySelectorAll('.rg-mask-reveal').forEach((el) => {
          el.classList.add('rg-mask-reveal--in', 'rg-mask-reveal--instant')
          el.setAttribute('data-rg-reveal', 'in')
        })
      })
    })
  await page.waitForTimeout(400)
}

async function saveShot(page, name) {
  const path = join(artifactsDir, name)
  await page.screenshot({ path, fullPage: false })
  console.log('saved', path)
}

async function assertNoForbiddenCopy(page) {
  const text = await page.locator('[data-accueil-gallery]').innerText()
  if (/\bkcal\b/i.test(text) || /calories?/i.test(text)) {
    throw new Error('Forbidden calorie copy on Accueil')
  }
  if (/\bRPE\b/.test(text)) throw new Error('Forbidden RPE copy')
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
    // Final settled state for screenshots (prefers-reduced-motion → Reveal instant).
    // Matches scripts/capture-accueil-gallery.mjs so cards are never clip-path hidden.
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

    // --- widgets_defaut.png ---
    await page.goto(`http://127.0.0.1:${port}/?tab=home`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((key) => localStorage.removeItem(key), PREFS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForCards(page)
    await assertNoForbiddenCopy(page)
    // Confirm default sections order
    const defaultOrder = await page.evaluate(() =>
      [...document.querySelectorAll('[data-accueil-widget]')].map((el) =>
        el.getAttribute('data-accueil-widget'),
      ),
    )
    console.log('default widget order', defaultOrder)
    if (JSON.stringify(defaultOrder) !== JSON.stringify(['seance', 'recent', 'programme'])) {
      throw new Error(`Unexpected default order: ${defaultOrder.join(',')}`)
    }
    const heroBox = await page.locator('[data-accueil-hero="session"]').boundingBox()
    if (!heroBox || heroBox.height < 120) {
      throw new Error(`Séance hero missing or blank: ${JSON.stringify(heroBox)}`)
    }
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(200)
    await saveShot(page, 'widgets_defaut.png')

    // --- widgets_modifier.png ---
    await page.click('[data-accueil-edit-open-footer]')
    await page.waitForSelector('[data-accueil-edit-list]', { state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(400)
    await saveShot(page, 'widgets_modifier.png')

    // --- widgets_perso.png ---
    // Hide Séance du jour, move Programme above Récent
    await page.click('[data-accueil-edit-toggle="seance"]')
    await page.click('[data-accueil-edit-up="programme"]')
    await page.waitForTimeout(150)
    await page.click('[data-accueil-edit-done]')
    await page.waitForSelector('[data-accueil-edit-list]', { state: 'detached', timeout: 10_000 })

    const persoOrder = await page.evaluate(() =>
      [...document.querySelectorAll('[data-accueil-widget]')].map((el) =>
        el.getAttribute('data-accueil-widget'),
      ),
    )
    console.log('perso widget order', persoOrder)
    if (JSON.stringify(persoOrder) !== JSON.stringify(['programme', 'recent'])) {
      throw new Error(`Unexpected perso order: ${persoOrder.join(',')}`)
    }
    await page.waitForSelector('[data-accueil-program-tile]', {
      state: 'attached',
      timeout: 10_000,
    })
    await waitForCards(page)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(300)
    const programTile = await page.locator('[data-accueil-program-tile]').first().boundingBox()
    if (!programTile || programTile.height < 80) {
      throw new Error(`Programme tile blank: ${JSON.stringify(programTile)}`)
    }
    await assertNoForbiddenCopy(page)
    await saveShot(page, 'widgets_perso.png')

    console.log('All Accueil widget artifacts captured.')
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
