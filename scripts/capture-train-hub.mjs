#!/usr/bin/env node
/**
 * Capture Train hub improvements @ 390×844 + walkthrough video @ 30fps.
 * Usage: node scripts/capture-train-hub.mjs
 */
import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromiumLaunchOptions, projectRoot } from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4199
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
      VITE_ENABLE_GYM_LEADERBOARD: '',
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

async function openScene(page, scene) {
  await page.goto(`http://127.0.0.1:${port}/train-hub-fixture?scene=${scene}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await page.waitForSelector('[data-train-hub-fixture="1"]')
}

async function capture() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)

    // Empty + start card → real Nouvelle séance → carnet (same as ▶)
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openScene(page, 'empty')
      await page.waitForSelector('[data-testid="train-start-session-card"]')
      await shot(page, 'train-empty-start-card.png')
      await page.locator('[data-testid="train-start-session-card"]').click({ force: true })
      await page.waitForSelector('[data-new-session-sheet]')
      await page.locator('[data-new-session-sheet] button').filter({ hasText: 'Musculation' }).click({ force: true })
      // Free session opens the real first-exercise picker (same path as ▶)
      await page.getByText('Quel est ton premier exercice').waitFor({ timeout: 15_000 })
      await page.waitForTimeout(300)
      await shot(page, 'train-start-card-tapped.png')
      await context.close()
    }

    // Goal 1–5
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openScene(page, 'goal')
      await page.waitForSelector('[data-testid="train-weekly-goal"]')
      await shot(page, 'train-weekly-goal.png')
      await page.locator('[data-testid="train-weekly-goal-select"]').selectOption('4')
      await page.waitForTimeout(200)
      await shot(page, 'train-weekly-goal-changed.png')
      await context.close()
    }

    // Rest reminder
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openScene(page, 'rest')
      await page.waitForSelector('[data-testid="train-rest-reminder"]')
      await shot(page, 'train-rest-reminder.png')
      await page.locator('[data-testid="train-rest-reminder-dismiss"]').click({ force: true })
      await page.waitForTimeout(200)
      await shot(page, 'train-rest-reminder-dismissed.png')
      await context.close()
    }

    // Beginner programme opened (list + Machine prise + Gainage in-card timer)
    {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await openScene(page, 'beginner-open')
      await page.waitForSelector('[data-testid="train-beginner-session"]')
      await page.waitForSelector('[data-testid="train-machine-busy-badge"]')
      await shot(page, 'train-beginner-programme.png')
      await page.locator('[data-testid="gainage-hold-panel"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      await shot(page, 'train-beginner-gainage.png')
      await context.close()
    }

    // Video walkthrough @ record then encode 30fps
    {
      const videoContext = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: artifactsDir, size: { width, height } },
      })
      const page = await videoContext.newPage()

      // 1) Empty → Commencer → Nouvelle séance → Musculation → carnet
      await openScene(page, 'empty')
      await page.waitForSelector('[data-testid="train-start-session-card"]')
      await page.waitForTimeout(800)
      await page.locator('[data-testid="train-start-session-card"]').click({ force: true })
      await page.waitForSelector('[data-new-session-sheet]')
      await page.waitForTimeout(700)
      await page.locator('[data-new-session-sheet] button').filter({ hasText: 'Musculation' }).click({ force: true })
      await page.getByText('Quel est ton premier exercice').waitFor({ timeout: 15_000 })
      await page.waitForTimeout(1000)
      // Pick first exercise so the immersive session screen is visible
      await page.getByRole('button', { name: /Développé couché/i }).first().click({ force: true })
      await page.waitForTimeout(1200)

      // 2) Goal picker 1–5
      await openScene(page, 'goal')
      await page.waitForSelector('[data-testid="train-weekly-goal-select"]')
      await page.waitForTimeout(600)
      const goalSelect = page.locator('[data-testid="train-weekly-goal-select"]')
      for (const n of ['1', '2', '3', '4', '5']) {
        await goalSelect.selectOption(n)
        await page.waitForFunction(
          (v) => document.querySelector('[data-testid="train-weekly-goal-select"]')?.value === v,
          n,
        )
        await page.waitForTimeout(550)
      }
      await page.waitForTimeout(400)

      // 3) Bar 1/2 → 2/2 + spark, then 4× slow-mo spark pass
      await openScene(page, 'spark')
      await page.waitForSelector('[data-testid="train-weekly-goal-progress"]')
      await page.waitForFunction(() => {
        const t = document.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent
        return t === '1/2'
      })
      await page.waitForTimeout(400)
      await page.waitForFunction(() => {
        const t = document.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent
        return t === '2/2'
      })
      await page.waitForSelector('[data-testid="train-weekly-goal-spark"]', { timeout: 5000 })
      await page.waitForTimeout(900)
      // Slow-mo remount (4×) — wait for spark with data-spark-ms = 650*4
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="train-weekly-goal-spark"]')
        return el && Number(el.getAttribute('data-spark-ms')) >= 2000
      }, null, { timeout: 8000 }).catch(() => null)
      await page.waitForTimeout(2800)

      // Explicit second slow-mo scene for clarity
      await openScene(page, 'spark-slow')
      await page.waitForFunction(() => {
        const t = document.querySelector('[data-testid="train-weekly-goal-progress"]')?.textContent
        return t === '2/2'
      })
      await page.waitForSelector('[data-testid="train-weekly-goal-spark"]', { timeout: 5000 })
      await page.waitForTimeout(3200)

      // 4) Rest + dismiss
      await openScene(page, 'rest')
      await page.waitForSelector('[data-testid="train-rest-reminder"]')
      await page.waitForTimeout(1000)
      await page.locator('[data-testid="train-rest-reminder-dismiss"]').click({ force: true })
      await page.waitForFunction(() => !document.querySelector('[data-testid="train-rest-reminder"]'))
      await page.waitForTimeout(900)

      // 5) Programme opened — Machine prise then Gainage (timer in-card, no duplicate title)
      await openScene(page, 'beginner')
      await page.waitForTimeout(500)
      await page.locator('[data-testid="train-beginner-start"]').click({ force: true })
      await page.waitForSelector('[data-testid="train-beginner-session"]')
      await page.waitForSelector('[data-testid="train-machine-busy-badge"]')
      await page.waitForTimeout(1400)
      await page.locator('[data-testid="gainage-hold-panel"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
      await page.locator('[data-testid="gainage-hold-toggle"]').click({ force: true })
      await page.waitForTimeout(1200)
      await page.locator('[data-testid="gainage-hold-done"]').click({ force: true })
      await page.waitForTimeout(600)

      await page.close()
      await videoContext.close()
    }

    await browser.close()

    const files = await readdir(artifactsDir)
    const webm = files.find(
      (f) => f.endsWith('.webm') && !f.startsWith('train-') && !f.startsWith('inscription-') && !f.startsWith('hw-'),
    )
    if (webm) {
      const src = join(artifactsDir, webm)
      const destWebm = join(artifactsDir, 'train-hub-demo.webm')
      await rename(src, destWebm)
      console.log('video', destWebm)
      const mp4 = join(artifactsDir, 'train-hub-demo.mp4')
      const r = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          destWebm,
          '-r',
          '30',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-an',
          mp4,
        ],
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
