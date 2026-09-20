#!/usr/bin/env node
/**
 * Preuve soft-leave : séance immersive → flèche retour → Train Reprendre → restauration.
 * Harness Train (pas d’auth) + Playwright.
 */
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'train-hub-capture', 'vite.config.ts')
const port = 4191

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', captureConfig, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 25_000)
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
  })
  return child
}

async function stopServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000)
    server.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function storedTraining(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('ranked-gym:training') || 'null'))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startServer()
  const browser = await chromium.launch(chromiumLaunchOptions)
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${port}/?scenario=resume`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-harness-ready]')

    // Hub avec séance en cours — pas d’auto-reopen (lastVoluntaryRoute)
    await page.getByRole('button', { name: 'Reprendre', exact: true }).waitFor()
    await page.screenshot({ path: join(outDir, 'soft_leave_01_hub_reprendre.png') })

    await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
    await page.waitForSelector('[data-immersive-session]')
    await page.getByRole('heading', { name: 'Développé couché' }).waitFor()

    // Saisir un poids distinct sur la série active
    const weightInput = page.getByLabel('Série 2 poids')
    await weightInput.fill('77.5')
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(outDir, 'soft_leave_02_session_edited.png') })

    // Flèche retour = soft-leave
    await page.getByRole('button', { name: 'Retour à Train' }).click()
    await page.getByRole('button', { name: 'Reprendre', exact: true }).waitFor()
    const afterLeave = await storedTraining(page)
    assert.equal(afterLeave.lastVoluntaryRoute, 'train-hub')
    assert.equal(afterLeave.activeWorkoutDraft?.routineId, 'push')
    assert.ok(
      afterLeave.routines.find((r) => r.id === 'push')?.exercises?.[0]?.sets?.[1]?.weightKg === 77.5,
      'poids 77.5 doit être persisté',
    )
    await page.screenshot({ path: join(outDir, 'soft_leave_03_hub_after_back.png') })

    // Reprendre = restauration exacte
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
    await page.waitForSelector('[data-immersive-session]')
    const restoredWeight = await page.getByLabel('Série 2 poids').inputValue()
    assert.equal(restoredWeight, '77.5')
    const afterResume = await storedTraining(page)
    assert.equal(afterResume.lastVoluntaryRoute, null)
    await page.screenshot({ path: join(outDir, 'soft_leave_04_restored.png') })

    // popstate (retour navigateur / Android) = soft-leave sans boucle
    await page.goBack()
    await page.getByRole('button', { name: 'Reprendre', exact: true }).waitFor()
    const afterPop = await storedTraining(page)
    assert.equal(afterPop.lastVoluntaryRoute, 'train-hub')
    assert.equal(afterPop.activeWorkoutDraft?.routineId, 'push')
    await page.screenshot({ path: join(outDir, 'soft_leave_05_after_history_back.png') })

    // Pas d’auto-reopen après soft-leave + visibility
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(300)
    assert.equal(await page.locator('[data-immersive-session]').count(), 0)
    await page.getByRole('button', { name: 'Reprendre', exact: true }).waitFor()

    console.log('SOFT_LEAVE_OK')
    await context.close()
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
