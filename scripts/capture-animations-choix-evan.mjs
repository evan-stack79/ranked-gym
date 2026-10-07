#!/usr/bin/env node
/**
 * Playwright capture — Evan’s exact motion choices (Blur In Up, Soft Blur,
 * Mask Reveal, Text Flip, counters). Viewport 390×844. Prefers WebKit.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { chromium, webkit } from 'playwright'
import { projectRoot, stopHarnessServer } from './streak-celeb-browser-utils.mjs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'animations-choix-evan')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4217
const width = 390
const height = 844

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_ENABLE_CONVEX_PRIMARY: 'false',
      VITE_ENABLE_CONVEX_AUTH: 'false',
      VITE_ENABLE_QA_FIXTURES: 'true',
      VITE_ENABLE_CALORIE_GOAL: 'false',
    },
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

async function allowHttpLocalhost(page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.resourceType() !== 'document') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const headers = { ...response.headers() }
    let body = await response.text()
    body = body.replace(/\s*upgrade-insecure-requests;?/gi, '')
    body = body.replace(
      /script-src 'self'/g,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    )
    delete headers['content-security-policy']
    delete headers['Content-Security-Policy']
    await route.fulfill({
      status: response.status(),
      headers,
      body,
      contentType: 'text/html; charset=utf-8',
    })
  })
}

async function open(page, path) {
  await page.goto(`http://127.0.0.1:${port}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
}

async function scrollMain(page, top) {
  await page.evaluate((y) => {
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) main.scrollTo({ top: y, behavior: 'smooth' })
  }, top)
  await page.waitForTimeout(700)
}

async function tapPress(page, selector) {
  const btn = page.locator(selector).first()
  await btn.waitFor({ timeout: 8_000 })
  await btn.dispatchEvent('pointerdown')
  await page.waitForTimeout(140)
  await btn.dispatchEvent('pointerup')
  await btn.click({ force: true }).catch(() => undefined)
  await page.waitForTimeout(200)
}

async function capture() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  await mkdir(join(outDir, 'video-tmp'), { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    try {
      browser = await webkit.launch({ headless: true })
      console.log('browser: webkit')
    } catch (err) {
      console.warn('webkit unavailable, falling back to chromium', err?.message ?? err)
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
      console.log('browser: chromium')
    }

    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'no-preference',
      recordVideo: {
        dir: join(outDir, 'video-tmp'),
        size: { width, height },
      },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await allowHttpLocalhost(page)

    // Accueil — Text Flip + Blur In Up + Soft Blur + Mask Reveal + water counter
    await open(page, '/accueil-fixture')
    await page.locator('[data-rg-text-flip]').waitFor({ timeout: 10_000 })
    await page.locator('[data-rg-blur]').first().waitFor({ timeout: 8_000 })
    await page.waitForTimeout(2800) // catch at least one flip cycle start
    await scrollMain(page, 240)
    await tapPress(page, '[data-testid="accueil-fixture-cta"]')
    await page.waitForTimeout(400)
    await scrollMain(page, 0)
    await page.waitForTimeout(600)

    // Nutrition — titles, soft blur, mask cards, kcal static
    await open(page, '/nutrition-fixture')
    await page.getByRole('heading', { name: 'Nutrition' }).waitFor({ timeout: 15_000 })
    await page.waitForTimeout(500)
    await scrollMain(page, 280)
    await scrollMain(page, 560)
    await page.waitForTimeout(350)

    // Train — Blur In Up title + counters + mask cards
    await open(page, '/train-fixture')
    await page.getByRole('heading', { name: 'Train' }).waitFor({ timeout: 10_000 })
    await page.locator('[data-rg-count="sessions"]').waitFor({ timeout: 8_000 })
    await page.waitForTimeout(700)
    await scrollMain(page, 200)
    await tapPress(page, '[data-testid="train-fixture-cta"]')
    await page.waitForTimeout(500)

    const video = page.video()
    await context.close()
    if (video) {
      const rawPath = await video.path()
      const webmArtifact = join(artifactsDir, 'animations_choix_evan.webm')
      const mp4Artifact = join(artifactsDir, 'animations_choix_evan.mp4')
      if (existsSync(rawPath)) {
        await copyFile(rawPath, webmArtifact)
        await copyFile(rawPath, join(outDir, 'animations_choix_evan.webm'))
      }
      execFileSync(
        '/usr/bin/ffmpeg',
        [
          '-y',
          '-i',
          webmArtifact,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          mp4Artifact,
        ],
        { stdio: 'ignore' },
      )
      await copyFile(mp4Artifact, join(outDir, 'animations_choix_evan.mp4'))
      console.log('mp4:', mp4Artifact)
    }
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
