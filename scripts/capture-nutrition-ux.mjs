#!/usr/bin/env node
/**
 * Capture écran Nutrition UX Wave 2 à 390×844 (safe areas iOS).
 * Usage: node scripts/capture-nutrition-ux.mjs
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import {
  applySafeAreas,
  chromiumLaunchOptions,
  preparePage,
  projectRoot,
  safeAreas,
  stopHarnessServer,
} from './streak-celeb-browser-utils.mjs'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'nutrition-ux')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4188
const width = 390
const height = 844

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_ENABLE_CONVEX_PRIMARY: 'false', VITE_ENABLE_CONVEX_AUTH: 'false' },
  })

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
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer)
        reject(new Error(`Vite exited ${code}\n${output}`))
      }
    })
  })

  return child
}

async function capture() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await preparePage(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await applySafeAreas(page)

    // Skip cold launch overlay if present
    await page.waitForSelector('[data-nutrition-fixture="1"]', { timeout: 30_000 })
    await page.waitForSelector('text=Nutrition', { timeout: 15_000 })
    await page.waitForSelector('text=kcal restantes', { timeout: 15_000 })
    await page.waitForTimeout(600)

    const shotPath = join(outDir, 'nutrition-390x844.png')
    const artifactPath = join(artifactsDir, 'nutrition_ux_wave2_390x844.png')
    await page.screenshot({ path: shotPath, fullPage: false })
    await page.screenshot({ path: artifactPath, fullPage: false })

    await page.screenshot({
      path: join(artifactsDir, 'nutrition_ux_wave2_fullpage.png'),
      fullPage: true,
    })

    // Scroll to reveal all meal rows if clipped
    await page.evaluate(() => {
      const main = document.querySelector('main')
      if (main) main.scrollTop = 220
    })
    await page.waitForTimeout(300)
    await page.screenshot({
      path: join(artifactsDir, 'nutrition_ux_wave2_meals_390x844.png'),
      fullPage: false,
    })

    console.log(
      JSON.stringify({
        ok: true,
        viewport: { width, height },
        safeAreas,
        shotPath,
        artifactPath,
        chrome: existsSync('/usr/local/bin/google-chrome'),
      }),
    )
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
