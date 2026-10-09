#!/usr/bin/env node
/**
 * Capture Train hub improvements @ 390×844 + walkthrough video.
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

    // Empty + start card
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
      await page.waitForSelector('[data-testid="train-hub-started"]')
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

    // Beginner programme opened (exercise list + Gainage + Machine prise)
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
      await page.waitForSelector('[data-testid="train-beginner-exercise-list"]')
      await shot(page, 'train-beginner-programme.png')
      // Scroll to Gainage row / hold panel for secondary shot
      await page.locator('[data-testid="gainage-hold-panel"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      await shot(page, 'train-beginner-gainage.png')
      await context.close()
    }

    // Video walkthrough
    {
      const videoContext = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: artifactsDir, size: { width, height } },
      })
      const page = await videoContext.newPage()

      // Empty page + big card → tap starts session
      await openScene(page, 'empty')
      await page.waitForSelector('[data-testid="train-start-session-card"]')
      await page.waitForTimeout(900)
      await page.locator('[data-testid="train-start-session-card"]').click({ force: true })
      await page.waitForSelector('[data-testid="train-hub-started"]')
      await page.locator('[data-testid="train-hub-started"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(1200)

      // Goal picker 1–5 (empty week — no spark mid-cycle; hold each value ~1s)
      await openScene(page, 'goal')
      await page.waitForSelector('[data-testid="train-weekly-goal-select"]')
      await page.waitForTimeout(800)
      const goalSelect = page.locator('[data-testid="train-weekly-goal-select"]')
      for (const n of ['1', '2', '3', '4', '5']) {
        await goalSelect.selectOption(n)
        await page.waitForFunction(
          (v) => document.querySelector('[data-testid="train-weekly-goal-select"]')?.value === v,
          n,
        )
        // Flash select border so the change is obvious on compressed video
        await goalSelect.evaluate((el) => {
          el.style.outline = '2px solid #FF2B2B'
        })
        await page.waitForTimeout(900)
        await goalSelect.evaluate((el) => {
          el.style.outline = ''
        })
        await page.waitForTimeout(150)
      }
      await page.waitForTimeout(400)

      // Bar filling + single spark at 100%
      await openScene(page, 'spark')
      await page.waitForSelector('[data-testid="train-weekly-goal"]')
      await page.waitForSelector('[data-testid="train-weekly-goal-fill"][data-ratio="1"]')
      await page.waitForTimeout(1500)

      // Rest reminder + dismiss (hold after dismiss before next scene)
      await openScene(page, 'rest')
      await page.waitForSelector('[data-testid="train-rest-reminder"]')
      await page.waitForTimeout(1100)
      await page.locator('[data-testid="train-rest-reminder-dismiss"]').click({ force: true })
      await page.waitForFunction(() => !document.querySelector('[data-testid="train-rest-reminder"]'))
      await page.waitForTimeout(1100)

      // Programme opened — stay at top (Machine prise) then scroll to Gainage
      await openScene(page, 'beginner')
      await page.waitForTimeout(600)
      await page.locator('[data-testid="train-beginner-start"]').click({ force: true })
      await page.waitForSelector('[data-testid="train-beginner-session"]')
      await page.waitForSelector('[data-testid="train-machine-busy-badge"]')
      await page.locator('[data-testid="train-machine-busy-swap"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(1600)
      await page.locator('[data-testid="gainage-hold-panel"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
      await page.locator('[data-testid="gainage-hold-toggle"]').click({ force: true })
      await page.waitForTimeout(1200)
      await page.locator('[data-testid="gainage-hold-done"]').click({ force: true })
      await page.waitForTimeout(700)

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
