#!/usr/bin/env node
/**
 * Capture InscriptionFlow @ 390×844 + short walkthrough video.
 * Usage: node scripts/capture-inscription.mjs
 */
import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromiumLaunchOptions, projectRoot } from './streak-celeb-browser-utils.mjs'

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
      VITE_ENABLE_CALORIE_GOAL: '',
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

async function openFixture(page) {
  await page.goto(`http://127.0.0.1:${port}/inscription-fixture`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await page.waitForSelector('[data-inscription-fixture="1"]')
}

async function dragWheel(page, dy = -120) {
  const wheel = page.locator('[data-testid="number-wheel"]')
  const box = await wheel.boundingBox()
  if (!box) return
  const x = box.x + box.width / 2
  const y = box.y + box.height * 0.65
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}

async function capture() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)

    // --- Stills: happy path with weight screen ---
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openFixture(page)

      await page.waitForSelector('[data-testid="inscription-welcome"]')
      await shot(page, 'inscription-bienvenue.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-age"]')
      await dragWheel(page, -140)
      await shot(page, 'inscription-age.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-sex"]')
      await page.locator('[data-testid="inscription-sex-female"]').click({ force: true })
      await shot(page, 'inscription-sexe.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-health"]')
      await page.locator('[data-testid="inscription-health-none"]').click({ force: true })
      await shot(page, 'inscription-sante-aucune.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-height"]')
      await dragWheel(page, -100)
      await shot(page, 'inscription-taille.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-weight"]')
      await dragWheel(page, -90)
      await shot(page, 'inscription-poids.png')

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-ready"]')
      await shot(page, 'inscription-cest-pret.png')

      await context.close()
    }

    // --- Still: TCA path (no weight, progress complete) ---
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openFixture(page)

      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-age"]')
      await dragWheel(page, -160)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.locator('[data-testid="inscription-sex-female"]').click({ force: true })
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.locator('[data-testid="inscription-health-tca"]').click({ force: true })
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForSelector('[data-testid="inscription-height"]')
      await dragWheel(page, -80)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      // Should skip weight → ready
      await page.waitForSelector('[data-testid="inscription-ready"]')
      await shot(page, 'inscription-tca-sans-poids.png')
      await context.close()
    }

    // --- Video walkthrough ~12s ---
    {
      const videoContext = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: artifactsDir, size: { width, height } },
      })
      const page = await videoContext.newPage()
      await openFixture(page)
      await page.waitForTimeout(700)

      // Bienvenue → Continuer
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(550)

      // Âge wheel
      await page.waitForSelector('[data-testid="inscription-age"]')
      await dragWheel(page, -130)
      await page.waitForTimeout(350)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(450)

      // Sexe
      await page.locator('[data-testid="inscription-sex-female"]').click({ force: true })
      await page.waitForTimeout(400)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(400)

      // Santé exclusivity demo
      await page.locator('[data-testid="inscription-health-pregnancy"]').click({ force: true })
      await page.waitForTimeout(450)
      await page.locator('[data-testid="inscription-health-none"]').click({ force: true })
      await page.waitForTimeout(450)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(400)

      // Back arrow demo
      await page.waitForSelector('[data-testid="inscription-height"]')
      await page.locator('[data-testid="inscription-back"]').click({ force: true })
      await page.waitForTimeout(500)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(350)

      // Taille
      await dragWheel(page, -90)
      await page.waitForTimeout(300)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(400)

      // Poids — show Plus tard briefly then Continuer
      await page.waitForSelector('[data-testid="inscription-weight"]')
      await dragWheel(page, -70)
      await page.waitForTimeout(400)
      await page.locator('[data-testid="inscription-later"]').click({ force: true })
      // Plus tard clears weight and may advance — if still on weight, Continuer
      const ready = await page
        .waitForSelector('[data-testid="inscription-ready"]', { timeout: 2500 })
        .catch(() => null)
      if (!ready) {
        await page.locator('[data-testid="inscription-continue"]').click({ force: true }).catch(() => {})
        await page.waitForSelector('[data-testid="inscription-ready"]', { timeout: 5000 })
      }
      await page.waitForTimeout(1100)
      await page.locator('[data-testid="inscription-continue"]').click({ force: true })
      await page.waitForTimeout(900)

      await page.close()
      await videoContext.close()
    }

    await browser.close()

    const files = await readdir(artifactsDir)
    const webm = files.find((f) => f.endsWith('.webm') && !f.startsWith('inscription-') && !f.startsWith('hw-'))
    if (webm) {
      const src = join(artifactsDir, webm)
      const destWebm = join(artifactsDir, 'inscription-flow-demo.webm')
      await rename(src, destWebm)
      console.log('video', destWebm)
      const mp4 = join(artifactsDir, 'inscription-flow-demo.mp4')
      const r = spawnSync(
        'ffmpeg',
        ['-y', '-i', destWebm, '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4],
        { encoding: 'utf8' },
      )
      if (r.status === 0 && existsSync(mp4)) console.log('video mp4', mp4)
      else console.warn('ffmpeg failed', r.stderr?.slice(0, 400))
    } else {
      console.warn('no webm found', files.filter((f) => f.endsWith('.webm')))
    }
  } finally {
    server.kill('SIGTERM')
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
