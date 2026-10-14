#!/usr/bin/env node
/**
 * Démo QA « Ajouter un aliment » v3 — vidéo 390×844 + captures.
 * Usage: node scripts/capture-add-food-v3-qa.mjs
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const artifactsDir = '/opt/cursor/artifacts'
const outDir = join(projectRoot, 'scripts', 'screenshots', 'add-food-v3-qa')
const port = 4191
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
      VITE_ENABLE_FOOD_ADD_V3: 'true',
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

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const videoDir = join(outDir, 'video')
  await mkdir(videoDir, { recursive: true })

  const server = await startAppServer(port)
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'],
    })
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoDir, size: { width, height } },
    })
    const page = await context.newPage()

    await page.goto(`http://127.0.0.1:${port}/add-food-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-add-food-screen]', { timeout: 15_000 })
    await page.waitForTimeout(600)

    await page.screenshot({
      path: join(outDir, 'ajout_390.png'),
      fullPage: false,
    })
    await copyFile(join(outDir, 'ajout_390.png'), join(artifactsDir, 'ajouter-aliment-v3-qa-390.png'))

    // Roue catégorie → Boissons (montre filtre light/sans sucres).
    const boissons = page.getByRole('button', { name: /Boissons/i }).first()
    if (await boissons.count()) {
      await boissons.click()
      await page.waitForTimeout(500)
    }

    await page.evaluate(() => {
      const el = document.querySelector('[data-food-results]')
      if (el) el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(400)

    await page.screenshot({
      path: join(outDir, 'ajout_390_licence.png'),
      fullPage: false,
    })
    await copyFile(
      join(outDir, 'ajout_390_licence.png'),
      join(artifactsDir, 'ajouter-aliment-v3-qa-licence.png'),
    )

    const manual = page.locator('[data-manual-toggle]')
    if (await manual.count()) {
      await manual.click()
      await page.waitForTimeout(400)
      await page.screenshot({
        path: join(outDir, 'ajout_390_manuel.png'),
        fullPage: false,
      })
      await copyFile(
        join(outDir, 'ajout_390_manuel.png'),
        join(artifactsDir, 'ajouter-aliment-v3-qa-manuel.png'),
      )
    }

    // Offline banner
    await page.goto(`http://127.0.0.1:${port}/add-food-fixture?offline=1`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-food-offline-banner]', { timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.screenshot({
      path: join(outDir, 'ajout_390_horsligne.png'),
      fullPage: false,
    })
    await copyFile(
      join(outDir, 'ajout_390_horsligne.png'),
      join(artifactsDir, 'ajouter-aliment-v3-qa-offline.png'),
    )

    // Retour online + sélection d’une carte
    await page.goto(`http://127.0.0.1:${port}/add-food-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-food-card]', { timeout: 10_000 })
    const plus = page.locator('[data-food-card] button').first()
    await plus.click()
    await page.waitForTimeout(400)
    const validate = page.getByRole('button', { name: /Ajouter|Valider|Confirmer/i }).first()
    if (await validate.count()) {
      await validate.click()
      await page.waitForTimeout(500)
    }

    await page.waitForTimeout(400)
    const videoPath = await page.video()?.path()
    await context.close()
    await browser.close()
    browser = null

    if (videoPath && existsSync(videoPath)) {
      const dest = join(artifactsDir, 'ajouter-aliment-v3-iphone.webm')
      await copyFile(videoPath, dest)
      console.log('VIDEO', dest)
    } else {
      throw new Error('Video file missing')
    }
    console.log('OK captures in', outDir)
  } finally {
    if (browser) await browser.close().catch(() => {})
    server.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
