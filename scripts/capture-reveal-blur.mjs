#!/usr/bin/env node
/**
 * Playwright WebKit capture — tasteful reveal / blur-in on Accueil + Nutrition.
 * Viewport 390×844, deviceScaleFactor 3 (iPhone-class).
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { webkit } from 'playwright'
import {
  applySafeAreas,
  preparePage,
  projectRoot,
  stopHarnessServer,
} from './streak-celeb-browser-utils.mjs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'reveal-blur')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4197
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

async function waitColdLaunchDone(page) {
  await page
    .waitForFunction(() => document.documentElement.dataset.coldLaunchPlayed === '1', {
      timeout: 12_000,
    })
    .catch(() => null)
  await page.waitForTimeout(200)
}

async function scrollMain(page, top) {
  await page.evaluate((y) => {
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) main.scrollTo({ top: y, behavior: 'smooth' })
  }, top)
  await page.waitForTimeout(700)
}

async function saveShot(page, name) {
  const local = join(outDir, name)
  const artifact = join(artifactsDir, name)
  await page.screenshot({ path: local, fullPage: false })
  await page.screenshot({ path: artifact, fullPage: false })
  return artifact
}

async function capture() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await webkit.launch({ headless: true })

    // --- Before: reduced motion (instant, no blur) ---
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
        recordVideo: undefined,
      })
      const page = await context.newPage()
      await preparePage(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`http://127.0.0.1:${port}/accueil-fixture`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      })
      await applySafeAreas(page)
      await waitColdLaunchDone(page)
      await page.waitForSelector('[data-rg-blur="settled"], h1', { timeout: 10_000 })
      await saveShot(page, 'reveal_before_accueil.png')

      await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      })
      await applySafeAreas(page)
      await waitColdLaunchDone(page)
      await page.waitForSelector('text=Nutrition', { timeout: 15_000 })
      await page.waitForTimeout(400)
      await saveShot(page, 'reveal_before_nutrition.png')
      await context.close()
    }

    // --- After + scroll video (motion on) ---
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
      await preparePage(page)
      await page.emulateMedia({ reducedMotion: 'no-preference' })

      await page.goto(`http://127.0.0.1:${port}/accueil-fixture`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      await applySafeAreas(page)
      await waitColdLaunchDone(page)
      // Catch mid/post blur-in
      await page.waitForSelector('[data-rg-blur]', { timeout: 10_000 })
      await page.waitForTimeout(180)
      await saveShot(page, 'reveal_after_accueil.png')
      await scrollMain(page, 280)
      await scrollMain(page, 520)
      await scrollMain(page, 0)
      await page.waitForTimeout(400)

      await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      await applySafeAreas(page)
      await waitColdLaunchDone(page)
      await page.waitForSelector('[data-rg-blur], text=Nutrition', { timeout: 15_000 })
      await page.waitForTimeout(180)
      await saveShot(page, 'reveal_after_nutrition.png')
      await scrollMain(page, 320)
      await scrollMain(page, 640)
      await scrollMain(page, 0)
      await page.waitForTimeout(500)

      const video = page.video()
      await context.close()
      if (video) {
        const rawPath = await video.path()
        const destLocal = join(outDir, 'reveal_scroll_accueil_nutrition.webm')
        const destArtifact = join(artifactsDir, 'reveal_scroll_accueil_nutrition.webm')
        if (existsSync(rawPath)) {
          await copyFile(rawPath, destLocal)
          await copyFile(rawPath, destArtifact)
        }
        // Prefer mp4 for PR embeds when ffmpeg is available via playwright
        const mp4Artifact = join(artifactsDir, 'reveal_scroll_accueil_nutrition.mp4')
        const mp4Local = join(outDir, 'reveal_scroll_accueil_nutrition.mp4')
        try {
          const { execFileSync } = await import('node:child_process')
          const ffmpegCandidates = [
            join(process.env.HOME || '', '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux'),
            'ffmpeg',
          ]
          let ffmpeg = null
          for (const c of ffmpegCandidates) {
            if (c === 'ffmpeg' || existsSync(c)) {
              ffmpeg = c
              break
            }
          }
          if (ffmpeg && existsSync(destArtifact)) {
            execFileSync(
              ffmpeg,
              ['-y', '-i', destArtifact, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4Artifact],
              { stdio: 'ignore' },
            )
            await copyFile(mp4Artifact, mp4Local)
            console.log('mp4:', mp4Artifact)
          }
        } catch (err) {
          console.warn('mp4 convert skipped:', err?.message || err)
        }
        console.log('video:', destArtifact)
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
