#!/usr/bin/env node
/**
 * Capture HeightWeightPicker @ 402×874 (iPhone 17) + short drag video.
 * Usage: node scripts/capture-height-weight-picker.mjs
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromiumLaunchOptions, projectRoot } from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4195
const width = 402
const height = 874

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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 60_000)
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

async function shot(page, name) {
  const path = join(artifactsDir, name)
  await page.screenshot({ path, type: 'png' })
  console.log('shot', name)
  return path
}

async function capture() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: artifactsDir,
        size: { width, height },
      },
    })
    const page = await context.newPage()

    // 1) Empty —
    await page.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=empty`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-testid="number-wheel-empty"]')
    await shot(page, 'hw-empty-dash.png')

    // 2) Weight spinning mid-drag feel (value set + neighbors)
    await page.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=weight`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-testid="number-wheel-center"]')
    const wheel = page.locator('[data-testid="number-wheel"]')
    const box = await wheel.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 90, { steps: 12 })
      await shot(page, 'hw-weight-spinning.png')
      await page.mouse.up()
      await page.waitForTimeout(400)
    } else {
      await shot(page, 'hw-weight-spinning.png')
    }

    // 3) Height wheel
    await page.click('[data-testid="fixture-force-height-tab"]')
    await page.waitForTimeout(200)
    await page.click('[data-testid="height-weight-tab-height"]')
    await page.waitForTimeout(150)
    await shot(page, 'hw-height-wheel.png')

    // 4) lb mode
    await page.click('[data-testid="height-weight-tab-weight"]')
    await page.waitForTimeout(100)
    await page.click('[data-testid="weight-unit-lb"]')
    await page.waitForTimeout(150)
    await shot(page, 'hw-lb-mode.png')

    // 5) C’est noté.
    await page.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=noted`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-testid="height-weight-noted"]')
    await shot(page, 'hw-cest-note.png')

    // 6) Profil Effacer
    await page.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=erase`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-testid="height-weight-erase"]')
    await shot(page, 'hw-profil-effacer.png')

    // Short video: flick weight → Continuer → C’est noté.
    const videoPage = await context.newPage()
    await videoPage.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=empty`, {
      waitUntil: 'networkidle',
    })
    await videoPage.waitForSelector('[data-testid="number-wheel-empty"]')
    const vWheel = videoPage.locator('[data-testid="number-wheel"]')
    const vb = await vWheel.boundingBox()
    if (vb) {
      // Finger-like flick
      await videoPage.mouse.move(vb.x + vb.width / 2, vb.y + vb.height * 0.7)
      await videoPage.mouse.down()
      await videoPage.mouse.move(vb.x + vb.width / 2, vb.y + vb.height * 0.2, { steps: 8 })
      await videoPage.mouse.up()
      await videoPage.waitForTimeout(700)
      // Switch to height and set
      await videoPage.click('[data-testid="height-weight-tab-height"]')
      await videoPage.waitForTimeout(200)
      const hb = await videoPage.locator('[data-testid="number-wheel"]').boundingBox()
      if (hb) {
        await videoPage.mouse.move(hb.x + hb.width / 2, hb.y + hb.height * 0.65)
        await videoPage.mouse.down()
        await videoPage.mouse.move(hb.x + hb.width / 2, hb.y + hb.height * 0.35, { steps: 6 })
        await videoPage.mouse.up()
        await videoPage.waitForTimeout(500)
      }
      await videoPage.click('[data-testid="height-weight-continue"]')
      await videoPage.waitForSelector('[data-testid="height-weight-noted"]')
      await videoPage.waitForTimeout(600)
    }

    await videoPage.close()
    await context.close()
    await browser.close()

    // Rename recorded video
    const { readdir, rename } = await import('node:fs/promises')
    const files = await readdir(artifactsDir)
    const webm = files.find((f) => f.endsWith('.webm'))
    if (webm) {
      const src = join(artifactsDir, webm)
      const dest = join(artifactsDir, 'hw-wheel-flick-demo.webm')
      await rename(src, dest)
      console.log('video', dest)
      // Also try ffmpeg to mp4 30fps if available
      try {
        const { spawnSync } = await import('node:child_process')
        const mp4 = join(artifactsDir, 'hw-wheel-flick-demo.mp4')
        const r = spawnSync(
          'ffmpeg',
          ['-y', '-i', dest, '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4],
          { encoding: 'utf8' },
        )
        if (r.status === 0 && existsSync(mp4)) console.log('video mp4', mp4)
        else console.warn('ffmpeg skipped', r.stderr?.slice(0, 200))
      } catch (e) {
        console.warn('ffmpeg unavailable', e)
      }
    }
  } finally {
    server.kill('SIGTERM')
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
