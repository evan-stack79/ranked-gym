#!/usr/bin/env node
/**
 * Captures Accueil gallery + floating pill nav at iPhone 390×844.
 * Prefers WebKit; falls back to Chromium with simulated safe areas.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'accueil-gallery')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts')
const port = 4198

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

async function assertNoForbiddenCopy(page) {
  const text = await page.locator('body').innerText()
  if (/\bkcal\b/i.test(text) || /calories?/i.test(text)) {
    throw new Error('Forbidden calorie copy on Accueil gallery')
  }
  if (/\bRPE\b/.test(text)) {
    throw new Error('Forbidden RPE copy — use Effort')
  }
  if (/body\s*fat|%.*gras|poids perdu/i.test(text)) {
    throw new Error('Forbidden body-metric percentage copy')
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    const launched = await launchBrowser()
    browser = launched.browser
    console.log(`Browser engine: ${launched.engine}`)

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Inject CSS safe-area simulation for Chromium (WebKit uses harness :root vars)
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--app-safe-area-top', '47px')
      document.documentElement.style.setProperty('--app-safe-area-bottom', '34px')
    })

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-harness-ready]')
    await page.waitForSelector('[data-accueil-gallery]')
    await page.waitForSelector('[data-bottom-nav-variant="floating-pill"]')
    await assertNoForbiddenCopy(page)

    const topPath = join(outDir, 'accueil_nouveau_haut.png')
    await page.screenshot({ path: topPath, fullPage: false })
    await copyFile(topPath, join(artifactsDir, 'accueil_nouveau_haut.png'))

    // Scroll main so Récent sits near the top and the floating pill stays visible.
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      const recent = document.querySelector('[data-accueil-recent]')
      if (main instanceof HTMLElement && recent instanceof HTMLElement) {
        const top = recent.offsetTop - 12
        main.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
      }
    })
    await page.waitForTimeout(250)
    const recentPath = join(outDir, 'accueil_nouveau_recent.png')
    await page.screenshot({ path: recentPath, fullPage: false })
    await copyFile(recentPath, join(artifactsDir, 'accueil_nouveau_recent.png'))

    await page.goto(`http://127.0.0.1:${port}/?tab=training`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-train-stub]')
    await page.waitForSelector('[data-bottom-nav-variant="floating-pill"]')
    await page.waitForSelector('[aria-current="page"][aria-label="Train"]')
    const trainPath = join(outDir, 'nav_pilule_train.png')
    await page.screenshot({ path: trainPath, fullPage: false })
    await copyFile(trainPath, join(artifactsDir, 'nav_pilule_train.png'))

    console.log('Artifacts written:')
    console.log(' - /opt/cursor/artifacts/accueil_nouveau_haut.png')
    console.log(' - /opt/cursor/artifacts/accueil_nouveau_recent.png')
    console.log(' - /opt/cursor/artifacts/nav_pilule_train.png')
  } finally {
    await browser?.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
