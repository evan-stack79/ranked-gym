#!/usr/bin/env node
/**
 * Captures preuve sélecteur d’exercices (390×844) + vidéo sélection → immersif.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'exercise-picker')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'exercise-picker-capture', 'vite.config.ts')
const port = 4191

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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 20_000)
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

async function assertMinCount(locator, min, label) {
  const n = await locator.count()
  if (n < min) throw new Error(`${label}: expected >= ${min}, got ${n}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const videoSearchDir = join(outDir, 'video-search')
    const videoInclineDir = join(outDir, 'video-incline')
    await mkdir(videoSearchDir, { recursive: true })
    await mkdir(videoInclineDir, { recursive: true })

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: videoSearchDir,
        size: { width: 390, height: 844 },
      },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-exercise-picker]')
    await page.waitForSelector('text=Quel est ton premier exercice ?')

    // Guard: jamais « Séance libre » sur cet écran
    const bodyText = await page.locator('body').innerText()
    if (bodyText.includes('Séance libre')) {
      throw new Error('Séance libre visible sur le sélecteur')
    }

    // 1) Avant saisie — plusieurs résultats + thumbs wave1
    await assertMinCount(
      page.locator('[data-exercise-picker] [data-picker-thumb]'),
      8,
      'default list thumbs',
    )
    await assertMinCount(
      page.locator('[data-picker-thumb-state="illustration"]'),
      6,
      'illustrated wave1 thumbs',
    )
    const thumbBox = await page
      .locator('[data-exercise-id="back_squat"] [data-picker-thumb]')
      .boundingBox()
    if (!thumbBox || thumbBox.width !== 64 || thumbBox.height !== 64) {
      throw new Error(`thumb size expected 64×64, got ${JSON.stringify(thumbBox)}`)
    }
    const squatImg = await page.locator('[data-exercise-id="back_squat"] img').getAttribute('src')
    if (!/back-squat/i.test(squatImg ?? '')) {
      throw new Error(`back_squat thumb src unexpected: ${squatImg}`)
    }
    const benchImg = await page.locator('[data-exercise-id="bench_press"] img').getAttribute('src')
    if (!/developpe-couche/i.test(benchImg ?? '') || /\.png(\?|$)/i.test(benchImg ?? '')) {
      throw new Error(`bench_press must keep validated webp, got ${benchImg}`)
    }

    const beforePath = join(outDir, 'picker-before-query-390.png')
    await page.screenshot({ path: beforePath, fullPage: false })
    await copyFile(beforePath, join(artifactsDir, 'picker_before_query.png'))
    await copyFile(beforePath, join(artifactsDir, 'picker_wave1_thumbs_default.png'))
    console.log('wrote', beforePath)

    // 2) Recherche « développé » — plusieurs illu distinctes
    const search = page.locator('[data-exercise-picker] input[type="search"]')
    await search.fill('développé')
    await page.waitForSelector('[data-exercise-id="bench_press"]')
    await page.waitForSelector('text=Développé couché')
    await page.waitForSelector('text=Développé militaire')
    await page.waitForSelector('[data-exercise-id="incline_bench_press"] img')
    const inclineSrc = await page
      .locator('[data-exercise-id="incline_bench_press"] img')
      .getAttribute('src')
    if (!/incline-bench-press/i.test(inclineSrc ?? '')) {
      throw new Error(`incline_bench_press thumb src unexpected: ${inclineSrc}`)
    }
    const afterPath = join(outDir, 'picker-search-developpe-390.png')
    await page.screenshot({ path: afterPath, fullPage: false })
    await copyFile(afterPath, join(artifactsDir, 'picker_search_developpe.png'))
    await copyFile(afterPath, join(artifactsDir, 'picker_wave1_search_developpe.png'))
    console.log('wrote', afterPath)

    // 2b) Fallback — exo catalogue sans illu wave1
    await search.fill('planche')
    await page.waitForSelector('[data-exercise-id="plank"]')
    const plankState = await page
      .locator('[data-exercise-id="plank"] [data-picker-thumb]')
      .getAttribute('data-picker-thumb-state')
    if (plankState !== 'fallback') {
      throw new Error(`plank expected fallback thumb, got ${plankState}`)
    }
    const fallbackPath = join(outDir, 'picker-search-fallback-390.png')
    await page.screenshot({ path: fallbackPath, fullPage: false })
    await copyFile(fallbackPath, join(artifactsDir, 'picker_search_fallback.png'))
    console.log('wrote', fallbackPath)

    // 3) Champ search focus + caret (soft keyboard OS non dispo en Chromium desktop)
    await search.click()
    await search.fill('')
    await search.pressSequentially('dévelop', { delay: 40 })
    await page.waitForTimeout(300)
    const focusPath = join(outDir, 'picker-search-focused-390.png')
    await page.screenshot({ path: focusPath, fullPage: false })
    await copyFile(focusPath, join(artifactsDir, 'picker_search_focused.png'))
    await copyFile(focusPath, join(artifactsDir, 'picker_keyboard_focus.png'))
    console.log('wrote', focusPath)

    // Compléter la query pour la sélection
    await search.fill('développé')
    await page.waitForSelector('[data-exercise-id="bench_press"]')
    await page.locator('[data-exercise-id="bench_press"]').click()
    await page.waitForSelector('[data-immersive-session]')
    await page.waitForSelector('text=Développé couché')
    const immersivePath = join(outDir, 'immersive-after-select-390.png')
    await page.screenshot({ path: immersivePath, fullPage: false })
    await copyFile(immersivePath, join(artifactsDir, 'immersive_after_select.png'))
    console.log('wrote', immersivePath)

    // Guards immersif — wave1 ne doit pas remplacer le hero bench_press
    const hero = await page.getAttribute('[data-immersive-session]', 'data-hero-image')
    const canonical = await page.getAttribute(
      '[data-immersive-session]',
      'data-canonical-exercise',
    )
    const heroSrc = await page.locator('[data-hero-photo]').getAttribute('src')
    console.log('immersive', { hero, canonical, heroSrc })
    if (canonical !== 'bench_press') {
      throw new Error(`canonical expected bench_press, got ${canonical}`)
    }
    if (hero !== 'ready') {
      throw new Error(`bench_press immersive hero expected ready, got ${hero}`)
    }
    if (!/developpe-couche/i.test(heroSrc ?? '') || /\.png(\?|$)/i.test(heroSrc ?? '')) {
      throw new Error(`immersive hero must stay validated webp, got ${heroSrc}`)
    }

    await context.close()
    const { readdir } = await import('node:fs/promises')
    const searchVideos = (await readdir(videoSearchDir)).filter((f) => f.endsWith('.webm'))
    if (searchVideos[0]) {
      const src = join(videoSearchDir, searchVideos[0])
      const dest = join(artifactsDir, 'picker_search_select_wave1.webm')
      await copyFile(src, dest)
      await copyFile(src, join(artifactsDir, 'picker_select_to_immersive.webm'))
      console.log('wrote', dest)
    }

    // No-reg : une illu wave1 du picker ne devient pas le hero immersif
    const context2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: videoInclineDir,
        size: { width: 390, height: 844 },
      },
    })
    const page2 = await context2.newPage()
    await page2.emulateMedia({ reducedMotion: 'reduce' })
    await page2.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await page2.waitForSelector('[data-exercise-id="incline_bench_press"]')
    await page2.locator('[data-exercise-id="incline_bench_press"]').click()
    await page2.waitForSelector('[data-immersive-session]')
    const inclineHero = await page2.getAttribute('[data-immersive-session]', 'data-hero-image')
    const inclineCanon = await page2.getAttribute(
      '[data-immersive-session]',
      'data-canonical-exercise',
    )
    if (inclineCanon !== 'incline_bench_press') {
      throw new Error(`expected incline_bench_press session, got ${inclineCanon}`)
    }
    if (inclineHero !== 'fallback') {
      throw new Error(`wave1 must not wire immersive hero, got ${inclineHero}`)
    }
    if (await page2.locator('[data-hero-photo]').count()) {
      throw new Error('incline_bench_press session unexpectedly has a hero photo')
    }
    const inclineImmersivePath = join(outDir, 'immersive-incline-no-wave1-hero-390.png')
    await page2.screenshot({ path: inclineImmersivePath, fullPage: false })
    await copyFile(inclineImmersivePath, join(artifactsDir, 'immersive_incline_no_wave1_hero.png'))
    await context2.close()
    const inclineVideos = (await readdir(videoInclineDir)).filter((f) => f.endsWith('.webm'))
    if (inclineVideos[0]) {
      const dest = join(artifactsDir, 'picker_incline_no_wave1_hero.webm')
      await copyFile(join(videoInclineDir, inclineVideos[0]), dest)
      console.log('wrote', dest)
    }
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
