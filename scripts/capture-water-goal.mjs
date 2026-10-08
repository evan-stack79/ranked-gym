#!/usr/bin/env node
/**
 * iPhone 402×874 screenshots — user water goal UX.
 * Usage: node scripts/capture-water-goal.mjs
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  applySafeAreas,
  chromiumLaunchOptions,
  preparePage,
  projectRoot,
  stopHarnessServer,
} from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4197
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
      VITE_ENABLE_CALORIE_GOAL: '',
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

async function shotPage(page, name) {
  const path = join(artifactsDir, name)
  await page.screenshot({ path, fullPage: false })
  return path
}

async function shotEl(locator, name) {
  const path = join(artifactsDir, name)
  await locator.screenshot({ path })
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
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await preparePage(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto(`http://127.0.0.1:${port}/water-goal-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await applySafeAreas(page)
    await page.waitForSelector('[data-water-goal-fixture="1"]', { timeout: 30_000 })
    await page.waitForSelector('text=Choisir mon objectif', { timeout: 15_000 })
    await page.waitForTimeout(500)

    // Hide any global error banners if present
    await page.evaluate(() => {
      document
        .querySelectorAll('[role="alert"], .supabase-config-banner, [data-config-banner]')
        .forEach((el) => {
          el.style.display = 'none'
        })
    })

    // 1) Accueil NutritionSnapshot without goal
    const accueil = page.locator('[data-capture="accueil-snapshot"]')
    await accueil.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await shotEl(accueil, 'accueil_eau_sans_objectif.png')

    // 2) Nutrition water card without goal
    const card = page.locator('[data-capture="hydration-card"]')
    await card.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await shotEl(card, 'eau_sans_objectif.png')

    // 3) Goal input open (on hydration card)
    await card.getByRole('button', { name: 'Choisir mon objectif' }).click()
    await page.waitForSelector('#water-goal-input-card', { timeout: 5_000 })
    await page.waitForTimeout(250)
    await shotEl(card, 'eau_choisir_objectif.png')

    // 4) Set goal and capture gauge
    await page.fill('#water-goal-input-card', '2000')
    await card.getByRole('button', { name: 'OK' }).click()
    await page.waitForTimeout(400)
    const gauge = page.locator('[data-capture="smart-gauge"]')
    await gauge.scrollIntoViewIfNeeded()
    await page.waitForSelector('text=/ 2 L', { timeout: 8_000 })
    await page.waitForTimeout(300)
    await shotEl(gauge, 'eau_avec_objectif.png')
    // Also keep a full viewport reference for context
    await shotPage(page, 'eau_avec_objectif_viewport.png')

    console.log(
      JSON.stringify({
        ok: true,
        viewport: { width, height },
        artifacts: [
          'accueil_eau_sans_objectif.png',
          'eau_sans_objectif.png',
          'eau_choisir_objectif.png',
          'eau_avec_objectif.png',
        ],
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
