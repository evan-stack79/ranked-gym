#!/usr/bin/env node
/**
 * Capture HeightWeightPicker @ 402×874 (iPhone 17) + short drag video.
 * Usage: node scripts/capture-height-weight-picker.mjs
 */
import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
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
}

async function openMode(page, mode) {
  await page.goto(`http://127.0.0.1:${port}/height-weight-fixture?mode=${mode}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await page.waitForSelector('[data-height-weight-fixture="1"]')
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
    })
    const page = await context.newPage()

    // 1) Empty —
    await openMode(page, 'empty')
    await page.waitForSelector('[data-testid="number-wheel-empty"]')
    await shot(page, 'hw-empty-dash.png')

    // 2) Weight spinning
    await openMode(page, 'weight')
    await page.waitForSelector('[data-testid="number-wheel-center"]')
    const wheel = page.locator('[data-testid="number-wheel"]')
    const box = await wheel.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 110, { steps: 14 })
      await shot(page, 'hw-weight-spinning.png')
      await page.mouse.up()
      await page.waitForTimeout(450)
    } else {
      await shot(page, 'hw-weight-spinning.png')
    }

    // 3) Height wheel — click visible tab
    await page.locator('[data-testid="height-weight-tab-height"]').click({ force: true })
    await page.waitForTimeout(200)
    await page.waitForSelector('[data-testid="number-wheel-center"]')
    await shot(page, 'hw-height-wheel.png')

    // 4) lb mode
    await page.locator('[data-testid="height-weight-tab-weight"]').click({ force: true })
    await page.waitForTimeout(120)
    await page.locator('[data-testid="weight-unit-lb"]').click({ force: true })
    await page.waitForTimeout(150)
    await shot(page, 'hw-lb-mode.png')

    // 5) C’est noté.
    await openMode(page, 'noted')
    await page.waitForSelector('[data-testid="height-weight-noted"]')
    await shot(page, 'hw-cest-note.png')

    // 6) Profil Effacer
    await openMode(page, 'erase')
    await page.waitForSelector('[data-testid="height-weight-erase"]')
    await shot(page, 'hw-profil-effacer.png')

    await context.close()

    // Video context
    const videoContext = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: artifactsDir, size: { width, height } },
    })
    const videoPage = await videoContext.newPage()
    await openMode(videoPage, 'empty')
    await videoPage.waitForSelector('[data-testid="number-wheel-empty"]')

    const vb = await videoPage.locator('[data-testid="number-wheel"]').boundingBox()
    if (vb) {
      await videoPage.mouse.move(vb.x + vb.width / 2, vb.y + vb.height * 0.72)
      await videoPage.mouse.down()
      await videoPage.mouse.move(vb.x + vb.width / 2, vb.y + vb.height * 0.18, { steps: 10 })
      await videoPage.mouse.up()
      await videoPage.waitForTimeout(800)

      await videoPage.locator('[data-testid="height-weight-tab-height"]').click({ force: true })
      await videoPage.waitForTimeout(250)
      const hb = await videoPage.locator('[data-testid="number-wheel"]').boundingBox()
      if (hb) {
        await videoPage.mouse.move(hb.x + hb.width / 2, hb.y + hb.height * 0.68)
        await videoPage.mouse.down()
        await videoPage.mouse.move(hb.x + hb.width / 2, hb.y + hb.height * 0.32, { steps: 8 })
        await videoPage.mouse.up()
        await videoPage.waitForTimeout(600)
      }

      await videoPage.locator('[data-testid="height-weight-continue"]').click({ force: true })
      await videoPage.waitForSelector('[data-testid="height-weight-noted"]', { timeout: 5000 })
      await videoPage.waitForTimeout(700)
    }

    await videoPage.close()
    await videoContext.close()
    await browser.close()

    const files = await readdir(artifactsDir)
    const webm = files.find((f) => f.endsWith('.webm') && !f.startsWith('hw-'))
    if (webm) {
      const src = join(artifactsDir, webm)
      const destWebm = join(artifactsDir, 'hw-wheel-flick-demo.webm')
      await rename(src, destWebm)
      console.log('video', destWebm)
      const mp4 = join(artifactsDir, 'hw-wheel-flick-demo.mp4')
      const r = spawnSync(
        'ffmpeg',
        ['-y', '-i', destWebm, '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4],
        { encoding: 'utf8' },
      )
      if (r.status === 0 && existsSync(mp4)) console.log('video mp4', mp4)
      else console.warn('ffmpeg failed', r.stderr?.slice(0, 300))
    } else {
      console.warn('no webm found', files)
    }
  } finally {
    server.kill('SIGTERM')
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
