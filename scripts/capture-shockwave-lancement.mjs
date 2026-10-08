#!/usr/bin/env node
/**
 * Enregistre Shockwave à taille iPhone 17 (402×874, dsf 3) :
 * - cold open → Accueil
 * - reload → rejoue
 * - changement d’onglet → ne rejoue pas
 * + clip reduced-motion + frames PNG.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4227
const VIEWPORT = { width: 402, height: 874 }
const DEVICE_SCALE = 3

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
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

function webmToMp4(webmPath, mp4Path) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      mp4Path,
    ],
    { stdio: 'inherit' },
  )
}

async function seedPage(page) {
  await page.addInitScript(() => {
    // Reset cold-launch guards for true cold open per navigation
    try {
      delete document.documentElement.dataset.coldLaunchPlayed
      delete document.documentElement.dataset.coldLaunchHandoff
      delete document.documentElement.dataset.coldLaunchLanding
    } catch {
      /* ignore */
    }
  })
}

async function waitSplashGone(page, timeout = 5000) {
  await page.waitForFunction(
    () => document.documentElement.dataset.coldLaunchPlayed === '1',
    { timeout },
  )
  await page.waitForSelector('.app-cold-launch', { state: 'detached', timeout: 2000 }).catch(() => {})
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const tmpDir = join(artifactsDir, 'shockwave-tmp')
  await mkdir(tmpDir, { recursive: true })

  const server = await startServer()
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })

  try {
    // ——— Full animation demo ———
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      recordVideo: { dir: tmpDir, size: VIEWPORT },
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    await seedPage(page)
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })

    const url = `http://127.0.0.1:${port}/auth-welcome-logged-in-fixture?restoreMs=0`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.app-cold-launch, .boot-splash', { timeout: 10_000 })
    await page.waitForSelector('.app-cold-launch[data-shockwave="1"]', { timeout: 8_000 })

    // Frame: start
    await page.screenshot({ path: join(artifactsDir, 'shockwave_start.png') })

    // Frame: wave peak (~220ms into playing — rings + flash visibles)
    await page.waitForTimeout(220)
    await page.screenshot({
      path: join(artifactsDir, 'shockwave_peak.png'),
      animations: 'allow',
    })

    await waitSplashGone(page)
    await page.waitForSelector('[data-accueil-gallery], nav[aria-label="Navigation principale"]', {
      timeout: 10_000,
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(artifactsDir, 'shockwave_end.png') })

    // Reload — must replay
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.app-cold-launch[data-shockwave="1"]', { timeout: 8_000 })
    await waitSplashGone(page)
    await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 10_000 })
    await page.waitForTimeout(350)

    // Tab change — must NOT replay (floating pill = aria-label only)
    await page.getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('button', { name: 'Train' })
      .click()
    await page.waitForTimeout(600)
    const replayed = await page.evaluate(() => Boolean(document.querySelector('.app-cold-launch')))
    if (replayed) throw new Error('Shockwave rejoué après changement d’onglet')

    await page.getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('button', { name: 'Accueil' })
      .click()
    await page.waitForSelector('[data-accueil-gallery="1"]', { timeout: 8_000 })
    await page.waitForFunction(
      () => {
        const heroes = [...document.querySelectorAll('[data-accueil-hero]')]
        if (heroes.length < 1) return false
        return heroes.every((hero) => {
          const wrap = hero.closest('[data-rg-reveal]')
          return wrap?.getAttribute('data-rg-reveal') === 'in'
        })
      },
      { timeout: 4_000 },
    )
    await page.waitForTimeout(400)
    const replayed2 = await page.evaluate(() => Boolean(document.querySelector('.app-cold-launch')))
    if (replayed2) throw new Error('Shockwave rejoué en revenant sur Accueil')
    const heroCount = await page.locator('[data-accueil-hero]').count()
    if (heroCount < 1) throw new Error('Séance du jour absente après retour Accueil')
    await page.screenshot({ path: join(artifactsDir, 'shockwave_accueil_apres_onglet.png') })

    const videoPath = await page.video().path()
    await context.close()
    const fullWebm = join(artifactsDir, 'shockwave_lancement.webm')
    await copyFile(videoPath, fullWebm)
    webmToMp4(fullWebm, join(artifactsDir, 'shockwave_lancement.mp4'))

    // ——— Reduced motion ———
    const ctxReduced = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      recordVideo: { dir: tmpDir, size: VIEWPORT },
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    })
    const pageR = await ctxReduced.newPage()
    await seedPage(pageR)
    await pageR.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    await pageR.goto(url, { waitUntil: 'domcontentloaded' })
    await pageR.waitForSelector('.app-cold-launch[data-reduced="true"]', { timeout: 8_000 })
    await pageR.screenshot({ path: join(artifactsDir, 'shockwave_reduit_start.png') })
    await waitSplashGone(pageR, 3000)
    await pageR.waitForTimeout(250)
    await pageR.screenshot({ path: join(artifactsDir, 'shockwave_reduit_end.png') })
    const videoR = await pageR.video().path()
    await ctxReduced.close()
    const reducedWebm = join(artifactsDir, 'shockwave_reduit.webm')
    await copyFile(videoR, reducedWebm)
    webmToMp4(reducedWebm, join(artifactsDir, 'shockwave_reduit.mp4'))

    console.log('Artifacts written to', artifactsDir)
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
