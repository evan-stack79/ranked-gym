#!/usr/bin/env node
/**
 * Captures Accueil gallery + floating pill (390×844 + 402×874).
 * Seeded training/nutrition data via harness — no placeholder stubs.
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
const port = 4211

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

async function gotoTab(page, tab) {
  const response = await page.goto(`http://127.0.0.1:${port}/?tab=${tab}`, {
    waitUntil: 'domcontentloaded',
  })
  console.log(`goto ${tab} status=${response?.status()}`)
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  try {
    await page.waitForSelector('[data-bottom-nav-variant="floating-pill"]', {
      state: 'attached',
      timeout: 15_000,
    })
  } catch (error) {
    const probe = await page.evaluate(() => ({
      url: location.href,
      preview: document.documentElement.dataset.bottomNavPreview,
      navs: [...document.querySelectorAll('nav')].map((n) => ({
        variant: n.getAttribute('data-bottom-nav-variant'),
        label: n.getAttribute('aria-label'),
      })),
      gallery: !!document.querySelector('[data-accueil-gallery]'),
      body: document.body?.innerText?.slice(0, 240) ?? '',
    }))
    console.error('pill missing probe', probe)
    throw error
  }
  await page.waitForTimeout(250)
}

async function assertAccueilClean(page) {
  const text = await page.locator('[data-accueil-gallery]').innerText()
  if (/\bkcal\b/i.test(text) || /calories?/i.test(text)) {
    throw new Error('Forbidden calorie copy on Accueil gallery')
  }
  if (/\bRPE\b/.test(text)) {
    throw new Error('Forbidden RPE copy')
  }
  if (/body\s*fat|%.*gras|poids perdu/i.test(text)) {
    throw new Error('Forbidden body-metric percentage copy')
  }
  if (!text.includes('Accueil')) throw new Error('Missing Accueil title')
  if (!text.includes('Récent')) throw new Error('Missing Récent section')
  if (!text.includes('Séance du jour') && !text.includes('Mon programme')) {
    throw new Error('Missing hero cards')
  }
}

/** Assert cover images fill their tile and row gutters match section titles. */
async function assertGalleryLayout(page) {
  const report = await page.evaluate(() => {
    const recent = document.querySelector('[data-accueil-recent]')
    const title = recent?.querySelector('h2')
    const scroller = recent?.querySelector('.accueil-gallery__tiles')
    const firstTile = recent?.querySelector('[data-accueil-recent-tile]')
    const media = firstTile?.querySelector('.accueil-gallery__tile-media')
    const coverImg =
      media?.querySelector('[data-history-thumb-img="cover"]') ||
      media?.querySelector('img')

    const titleLeft = title?.getBoundingClientRect().left ?? -1
    const tileLeft = firstTile?.getBoundingClientRect().left ?? -1
    const mediaBox = media?.getBoundingClientRect()
    const imgBox = coverImg?.getBoundingClientRect()

    const hero = document.querySelector('[data-accueil-hero="session"]')
    const heroLeft = hero?.getBoundingClientRect().left ?? -1
    const heroImg = hero?.querySelector('[data-accueil-hero-img="cover"]')
    const heroBox = hero?.getBoundingClientRect()
    const heroImgBox = heroImg?.getBoundingClientRect()

    return {
      titleLeft,
      tileLeft,
      heroLeft,
      gutterDelta: Math.abs(titleLeft - tileLeft),
      mediaW: mediaBox?.width ?? 0,
      mediaH: mediaBox?.height ?? 0,
      imgW: imgBox?.width ?? 0,
      imgH: imgBox?.height ?? 0,
      hasCover: Boolean(coverImg),
      heroHasCover: Boolean(heroImg),
      heroFillOk:
        !heroImg ||
        (heroImgBox != null &&
          heroBox != null &&
          Math.abs(heroImgBox.width - heroBox.width) < 2 &&
          Math.abs(heroImgBox.height - heroBox.height) < 2),
      fillRatio:
        mediaBox && imgBox && mediaBox.width > 0
          ? Math.min(imgBox.width / mediaBox.width, imgBox.height / mediaBox.height)
          : 0,
    }
  })

  console.log('gallery layout probe', report)
  if (report.gutterDelta > 3) {
    throw new Error(
      `Récent tile left (${report.tileLeft}) does not match title left (${report.titleLeft})`,
    )
  }
  if (report.heroLeft < 12) {
    throw new Error(`Hero card flush to edge (left=${report.heroLeft})`)
  }
  if (!report.hasCover) {
    throw new Error('Expected a cover image on the first Récent tile (Squat)')
  }
  // Scaled PNGs report fillRatio > 1 (transform); opaque covers ≈ 1.
  if (report.fillRatio < 0.95) {
    throw new Error(`Cover image does not fill tile (fillRatio=${report.fillRatio})`)
  }
  if (!report.heroFillOk && report.heroHasCover) {
    // Allow small delta; PNG heroes may scale past the box (clipped by overflow).
    const hero = await page.evaluate(() => {
      const heroEl = document.querySelector('[data-accueil-hero="session"]')
      const img = heroEl?.querySelector('[data-accueil-hero-img="cover"]')
      if (!heroEl || !img) return null
      const hb = heroEl.getBoundingClientRect()
      const ib = img.getBoundingClientRect()
      return {
        coversWidth: ib.width >= hb.width - 1,
        coversHeight: ib.height >= hb.height - 1,
        objectFit: getComputedStyle(img).objectFit,
      }
    })
    if (!hero || hero.objectFit !== 'cover' || !hero.coversWidth || !hero.coversHeight) {
      throw new Error(`Hero cover image does not fill hero card: ${JSON.stringify(hero)}`)
    }
  }
}

async function saveShot(page, name) {
  const local = join(outDir, name)
  await page.screenshot({ path: local, fullPage: false })
  await copyFile(local, join(artifactsDir, name))
}

async function captureAccueilAt(page, viewport, artifactNames) {
  await page.setViewportSize(viewport)
  await gotoTab(page, 'home')
  await page.waitForSelector('[data-accueil-gallery]', { state: 'attached' })
  await page.waitForSelector('[data-accueil-carousel]', { state: 'attached' })
  await page.waitForSelector('[data-history-thumb-img="cover"], [data-accueil-hero-img="cover"]', {
    state: 'attached',
    timeout: 15_000,
  })
  await assertAccueilClean(page)

  // Scroll so Récent (with Développé couché cover) is in view
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    const recent = document.querySelector('[data-accueil-recent]')
    if (main instanceof HTMLElement && recent instanceof HTMLElement) {
      main.scrollTo({ top: Math.max(0, recent.offsetTop - 8), behavior: 'instant' })
    }
  })
  await page.waitForTimeout(350)
  await assertGalleryLayout(page)
  await saveShot(page, artifactNames.recent)

  if (artifactNames.top) {
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.waitForTimeout(200)
    await saveShot(page, artifactNames.top)
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
      colorScheme: 'dark',
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => console.warn('pageerror:', error.message))
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

    // Primary artifact — iPhone-size with filled Récent images
    await captureAccueilAt(page, { width: 390, height: 844 }, {
      recent: 'accueil_images_pleines.png',
      top: 'accueil_final_haut.png',
    })

    // Also keep bas shot name for continuity
    await saveShot(page, 'accueil_final_bas.png')

    // iPhone 17-ish width — filled images + gutter alignment
    await captureAccueilAt(page, { width: 402, height: 874 }, {
      recent: 'accueil_images_pleines_402.png',
    })

    // Train (real hub)
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoTab(page, 'training')
    await page.waitForSelector('h1')
    await page.waitForSelector('[aria-current="page"][aria-label="Train"]')
    const trainText = await page.locator('[data-app-scroll-main]').innerText()
    if (!trainText || trainText.length < 10) throw new Error('Train screen empty')
    await saveShot(page, 'nav_train_reel.png')

    await gotoTab(page, 'nutrition')
    await page.waitForSelector('[aria-current="page"][aria-label="Nutri"]')
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) {
        main.scrollTo({
          top: Math.min(220, main.scrollHeight - main.clientHeight),
          behavior: 'instant',
        })
      }
    })
    await page.waitForTimeout(200)
    await saveShot(page, 'nav_nutri_reel.png')

    await gotoTab(page, 'profile')
    await page.waitForSelector('[aria-current="page"][aria-label="Profil"]')
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (main instanceof HTMLElement) {
        main.scrollTo({ top: main.scrollHeight, behavior: 'instant' })
      }
    })
    await page.waitForTimeout(200)
    await saveShot(page, 'nav_profil_reel.png')

    const artifacts = [
      'accueil_images_pleines.png',
      'accueil_images_pleines_402.png',
      'accueil_final_haut.png',
      'accueil_final_bas.png',
      'nav_train_reel.png',
      'nav_nutri_reel.png',
      'nav_profil_reel.png',
    ]
    console.log('Artifacts written:')
    for (const name of artifacts) {
      console.log(` - ${join(artifactsDir, name)}`)
    }
  } finally {
    await browser?.close()
    await stopServer(server)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
