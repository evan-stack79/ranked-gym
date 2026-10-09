#!/usr/bin/env node
/**
 * Playwright capture — 6 team animations + streak fix.
 * Viewport 390×844. Writes MP4 + PNG under /opt/cursor/artifacts/.
 */
import { mkdir, copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { chromium, webkit } from 'playwright'
import { projectRoot, stopHarnessServer } from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4222
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

function toMp4(webmPath, mp4Path) {
  execFileSync(
    '/usr/bin/ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { stdio: 'ignore' },
  )
}

async function captureClip(browser, name, interact) {
  const tmpDir = join(artifactsDir, `_tmp_${name}`)
  await mkdir(tmpDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
    recordVideo: { dir: tmpDir, size: { width, height } },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await allowHttpLocalhost(page)
  await page.goto(`http://127.0.0.1:${port}/animations-fixture`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.locator('[data-animations-fixture]').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(200)
  await interact(page)
  await page.waitForTimeout(250)
  await page.screenshot({
    path: join(artifactsDir, `${name}.png`),
    fullPage: false,
  })
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`no video for ${name}`)
  const rawPath = await video.path()
  const webm = join(artifactsDir, `${name}.webm`)
  const mp4 = join(artifactsDir, `${name}.mp4`)
  await copyFile(rawPath, webm)
  toMp4(webm, mp4)
  await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  console.log('ok', mp4)
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser
  try {
    try {
      browser = await webkit.launch({ headless: true })
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
    }

    await captureClip(browser, 'anim-1-fin-seance', async (page) => {
      await page.locator('[data-testid="demo-session-complete"]').click()
      await page.locator('[data-rg-session-burst]').waitFor({ timeout: 5_000 })
      await page.waitForTimeout(900)
    })

    await captureClip(browser, 'anim-2-serie-validee', async (page) => {
      await page.locator('[data-demo="set-validated"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="demo-set-validate"]').click()
      await page.waitForTimeout(400)
    })

    await captureClip(browser, 'anim-3-passage-pages', async (page) => {
      await page.locator('[data-demo="card-expand"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="demo-expand-card"]').click()
      await page.waitForTimeout(350)
      // tab fade
      await page.getByRole('navigation', { name: 'Navigation principale' }).getByLabel('Nutri').click()
      await page.waitForTimeout(250)
      await page.getByRole('navigation', { name: 'Navigation principale' }).getByLabel('Accueil').click()
      await page.waitForTimeout(250)
    })

    await captureClip(browser, 'anim-4-chargement-vague', async (page) => {
      await page.locator('[data-demo="wave-enter"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="demo-wave-replay"]').click()
      await page.waitForTimeout(500)
    })

    await captureClip(browser, 'anim-5-barres-vivantes', async (page) => {
      await page.locator('[data-demo="living-progress"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="demo-progress-fill"]').click()
      await page.waitForTimeout(500)
    })

    await captureClip(browser, 'anim-6-boutons', async (page) => {
      await page.locator('[data-demo="buttons"]').scrollIntoViewIfNeeded()
      const btn = page.locator('[data-testid="demo-press-btn"]')
      await btn.dispatchEvent('pointerdown')
      await page.waitForTimeout(160)
      await btn.dispatchEvent('pointerup')
      await page.waitForTimeout(900)
    })

    await captureClip(browser, 'anim-7-streak-fix', async (page) => {
      await page.locator('[data-demo="streak-fix"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="demo-streak"]').click()
      await page.locator('.streak-celeb').waitFor({ timeout: 5_000 })
      await page.waitForTimeout(400)
      // show skippability
      await page.locator('.streak-celeb').click()
      await page.waitForTimeout(250)
    })
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
