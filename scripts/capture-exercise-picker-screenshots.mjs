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

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: join(outDir, 'video-tmp'),
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

    // 1) Avant saisie
    const beforePath = join(outDir, 'picker-before-query-390.png')
    await page.screenshot({ path: beforePath, fullPage: false })
    await copyFile(beforePath, join(artifactsDir, 'picker_before_query.png'))
    console.log('wrote', beforePath)

    // 2) Recherche « développé »
    const search = page.locator('[data-exercise-picker] input[type="search"]')
    await search.fill('développé')
    await page.waitForSelector('[data-exercise-id="bench_press"]')
    await page.waitForSelector('text=Développé couché')
    await page.waitForSelector('text=Développé militaire')
    const afterPath = join(outDir, 'picker-search-developpe-390.png')
    await page.screenshot({ path: afterPath, fullPage: false })
    await copyFile(afterPath, join(artifactsDir, 'picker_search_developpe.png'))
    console.log('wrote', afterPath)

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

    // Guards immersif
    const hero = await page.getAttribute('[data-immersive-session]', 'data-hero-image')
    const canonical = await page.getAttribute(
      '[data-immersive-session]',
      'data-canonical-exercise',
    )
    console.log('immersive', { hero, canonical })
    if (canonical !== 'bench_press') {
      throw new Error(`canonical expected bench_press, got ${canonical}`)
    }

    await context.close()
    // Playwright writes video after context close
    const { readdir } = await import('node:fs/promises')
    const videoTmp = join(outDir, 'video-tmp')
    const videos = (await readdir(videoTmp)).filter((f) => f.endsWith('.webm'))
    if (videos[0]) {
      const src = join(videoTmp, videos[0])
      const dest = join(artifactsDir, 'picker_select_to_immersive.webm')
      await copyFile(src, dest)
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
