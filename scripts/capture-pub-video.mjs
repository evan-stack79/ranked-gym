#!/usr/bin/env node
/**
 * Prépare les ressources de la pub vidéo (marketing/pub-video/assets/) :
 * vrais écrans de l'app (harnais Accueil + Train, sans connexion), séquences
 * de défilement image par image, logo panthère et police Inter 500–900.
 * Usage : node scripts/capture-pub-video.mjs
 * Puis : node scripts/render-pub-video.mjs
 */
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const assetsDir = join(projectRoot, 'marketing', 'pub-video', 'assets')
const imgDir = join(assetsDir, 'img')
const clipsDir = join(assetsDir, 'clips')
const fontsDir = join(assetsDir, 'fonts')
const VIEWPORT = { width: 402, height: 874 }
const LABEL = { home: 'Accueil', training: 'Train', nutrition: 'Nutri', profile: 'Profil' }

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

// Les deux harnais partagent le cache de deps Vite : les lancer en même temps
// provoque des ré-optimisations croisées et des pages qui ne montent jamais.
function startServer(config, port) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--config', config, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    let out = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${out}`)), 45_000)
    const onData = (chunk) => {
      out += chunk
      if (out.includes('Local:')) {
        clearTimeout(timer)
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
  })
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return Promise.resolve()
  child.kill('SIGTERM')
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function preparePage(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await page.addInitScript(() => {
    class ImmediateIO {
      constructor(cb) { this._cb = cb }
      observe(el) {
        queueMicrotask(() => this._cb([{
          isIntersecting: true, target: el, intersectionRatio: 1,
          boundingClientRect: el.getBoundingClientRect(), intersectionRect: el.getBoundingClientRect(),
          rootBounds: null, time: performance.now(),
        }], this))
      }
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
    window.IntersectionObserver = ImmediateIO
    const apply = () => {
      const root = document.documentElement
      if (!root?.style) return
      root.style.setProperty('--app-safe-area-top', '54px')
      root.style.setProperty('--app-safe-area-bottom', '30px')
    }
    apply()
    document.addEventListener('DOMContentLoaded', apply)
  })
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

async function shot(page, path) {
  await page.screenshot({ path, type: 'jpeg', quality: 90 })
}

async function scrollClip(page, name, frames, distance) {
  const dir = join(clipsDir, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const max = await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    return main ? main.scrollHeight - main.clientHeight : 0
  })
  const target = Math.min(distance, max)
  for (let i = 0; i < frames; i++) {
    await page.evaluate((top) => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main) main.scrollTop = top
    }, target * easeInOut(i / (frames - 1)))
    await page.waitForTimeout(16)
    await shot(page, join(dir, `f${String(i).padStart(4, '0')}.jpg`))
  }
  console.log(`clip ${name}: ${frames} images`)
}

async function gotoTab(page, tab) {
  await page.getByRole('button', { name: LABEL[tab], exact: true }).click()
  await page.waitForSelector(`[data-nav-tab="${tab}"][aria-current="page"]`)
  await page.waitForTimeout(1800)
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (main) main.scrollTop = 0
  })
  await page.waitForTimeout(300)
}

async function downloadFonts() {
  await mkdir(fontsDir, { recursive: true })
  const css = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap', {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
  }).then((r) => r.text())
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1])
  if (urls.length !== 4) throw new Error(`Inter: 4 graisses attendues, ${urls.length} trouvées`)
  for (const [i, url] of urls.entries()) {
    const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()))
    await writeFile(join(fontsDir, `inter-${i + 1}.ttf`), buf)
  }
  console.log('polices Inter 500/700/800/900')
}

await mkdir(imgDir, { recursive: true })
await downloadFonts()
await copyFile(join(projectRoot, 'src', 'assets', 'brand', 'panther-calm-crowned.png'), join(imgDir, 'logo.png'))

let server
const browser = await chromium.launch(chromiumLaunchOptions)
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
try {
  server = await startServer(join(scriptsDir, 'accueil-gallery-capture', 'vite.config.ts'), 4301)
  const page = await context.newPage()
  await preparePage(page)
  await page.goto('http://127.0.0.1:4301/?tab=home', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-accueil-hero]', { state: 'attached', timeout: 15_000 })
  await page.waitForTimeout(2000)
  await shot(page, join(imgDir, 'home.jpg'))
  await scrollClip(page, 'clip-home', 120, 900)
  for (const tab of ['training', 'nutrition', 'profile']) {
    await gotoTab(page, tab)
    await shot(page, join(imgDir, `${tab}.jpg`))
  }
  await gotoTab(page, 'nutrition')
  await scrollClip(page, 'clip-nutrition', 90, 520)
  await page.close()
  await stopServer(server)

  server = await startServer(join(scriptsDir, 'train-hub-capture', 'vite.config.ts'), 4302)
  for (const scenario of ['strength', 'course', 'football-match', 'other']) {
    const p = await context.newPage()
    await preparePage(p)
    await p.goto(`http://127.0.0.1:4302/?scenario=${scenario}`, { waitUntil: 'networkidle' })
    await p.waitForSelector('[data-harness-ready]', { state: 'attached' })
    await p.waitForTimeout(1500)
    await shot(p, join(imgDir, `train-${scenario}.jpg`))
    await p.close()
  }
  console.log(`ressources prêtes dans ${assetsDir}`)
} finally {
  await browser.close()
  await stopServer(server)
}
