#!/usr/bin/env node
/**
 * Playwright WebKit capture — tasteful reveal / blur-in on Accueil + Nutrition.
 * Viewport 390×844, deviceScaleFactor 3 (iPhone-class).
 *
 * Note: index.html CSP includes `upgrade-insecure-requests`, which breaks WebKit
 * against a plain HTTP Vite server. We strip that directive for local capture only.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { webkit } from 'playwright'
import { projectRoot, stopHarnessServer } from './streak-celeb-browser-utils.mjs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'reveal-blur')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4205
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

/** WebKit + upgrade-insecure-requests + HTTP Vite = TLS failures. Strip for local QA. */
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

async function saveShot(page, name) {
  await page.screenshot({ path: join(outDir, name), fullPage: false })
  await page.screenshot({ path: join(artifactsDir, name), fullPage: false })
}

async function skipColdLaunch(page) {
  await page.addInitScript(() => {
    document.documentElement.dataset.coldLaunchPlayed = '1'
    document.documentElement.dataset.coldLaunchHandoff = 'done'
  })
}

async function open(page, path) {
  await page.goto(`http://127.0.0.1:${port}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.coldLaunchPlayed === '1' ||
      !document.querySelector('.app-cold-launch, .boot-splash'),
    { timeout: 12_000 },
  )
}

/** Replay entrance with a longer duration so stills catch mid-blur / mid-rise. */
async function replayEntranceForStill(page) {
  await page.addStyleTag({
    content: `
      .rg-blur-in--in:not(.rg-blur-in--settled) { animation-duration: 1600ms !important; }
      .rg-reveal--in:not(.rg-reveal--instant) { animation-duration: 1600ms !important; }
    `,
  })
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-rg-blur], [data-rg-reveal]')) {
      el.classList.remove(
        'rg-blur-in--in',
        'rg-blur-in--settled',
        'rg-reveal--in',
        'rg-reveal--instant',
      )
      if (el.hasAttribute('data-rg-blur')) el.setAttribute('data-rg-blur', 'pending')
      if (el.hasAttribute('data-rg-reveal')) {
        el.setAttribute('data-rg-reveal', 'pending')
        const mask = el.querySelector('.rg-mask-reveal')
        mask?.classList.remove('rg-mask-reveal--in', 'rg-mask-reveal--instant', 'rg-reveal--in')
      }
    }
    requestAnimationFrame(() => {
      for (const el of document.querySelectorAll('[data-rg-blur], [data-rg-reveal]')) {
        if (el.hasAttribute('data-rg-blur')) {
          el.classList.add('rg-blur-in--in')
          el.setAttribute('data-rg-blur', 'in')
        }
        if (el.hasAttribute('data-rg-reveal')) {
          el.setAttribute('data-rg-reveal', 'in')
          const mask = el.querySelector('.rg-mask-reveal')
          if (mask) mask.classList.add('rg-mask-reveal--in')
          else el.classList.add('rg-reveal--in')
        }
      }
    })
  })
  await page.waitForTimeout(180)
}

async function scrollMain(page, top) {
  await page.evaluate((y) => {
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) main.scrollTo({ top: y, behavior: 'smooth' })
  }, top)
  await page.waitForTimeout(750)
}

async function capture() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  await mkdir(join(outDir, 'video-tmp'), { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await webkit.launch({ headless: true })

    // --- Before: reduced motion ---
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await allowHttpLocalhost(page)
      await skipColdLaunch(page)

      await open(page, '/accueil-fixture')
      await page.locator('h1').waitFor({ timeout: 10_000 })
      await page.waitForTimeout(350)
      await saveShot(page, 'reveal_before_accueil.png')

      await open(page, '/nutrition-fixture')
      await page.getByRole('heading', { name: 'Nutrition' }).waitFor({ timeout: 15_000 })
      await page.waitForTimeout(350)
      await saveShot(page, 'reveal_before_nutrition.png')
      await context.close()
    }

    // --- After + scroll video ---
    {
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
      await skipColdLaunch(page)

      await open(page, '/accueil-fixture')
      await page.locator('[data-rg-blur]').first().waitFor({ timeout: 10_000 })
      await replayEntranceForStill(page)
      await saveShot(page, 'reveal_after_accueil.png')
      await scrollMain(page, 260)
      await scrollMain(page, 520)
      await scrollMain(page, 0)
      await page.waitForTimeout(350)

      await open(page, '/nutrition-fixture')
      await page.getByRole('heading', { name: 'Nutrition' }).waitFor({ timeout: 15_000 })
      await page.locator('[data-rg-blur]').first().waitFor({ timeout: 10_000 })
      await replayEntranceForStill(page)
      await saveShot(page, 'reveal_after_nutrition.png')
      await scrollMain(page, 300)
      await scrollMain(page, 620)
      await scrollMain(page, 0)
      await page.waitForTimeout(500)

      const video = page.video()
      await context.close()
      if (video) {
        const rawPath = await video.path()
        const webmArtifact = join(artifactsDir, 'reveal_scroll_accueil_nutrition.webm')
        const mp4Artifact = join(artifactsDir, 'reveal_scroll_accueil_nutrition.mp4')
        if (existsSync(rawPath)) {
          await copyFile(rawPath, webmArtifact)
          await copyFile(rawPath, join(outDir, 'reveal_scroll_accueil_nutrition.webm'))
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
        await copyFile(mp4Artifact, join(outDir, 'reveal_scroll_accueil_nutrition.mp4'))
        console.log('mp4:', mp4Artifact)
        console.log('video:', webmArtifact)
      }
    }

    console.log('shots written to', artifactsDir)
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
