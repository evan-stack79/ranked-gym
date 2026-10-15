#!/usr/bin/env node
/**
 * WebKit 390×844 — preuves placeholders gris « dernière fois » + rempli au tap.
 * Sortie : /opt/cursor/artifacts/derniere_fois_gris.png
 *           /opt/cursor/artifacts/derniere_fois_rempli.png
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'workout-immersive-capture', 'vite.config.ts')
const port = 4191

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', captureConfig, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 30_000)
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

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await webkit.launch()
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${port}/?clear=1&autoValidate=0`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-harness-ready]')
    await page.waitForSelector('[data-immersive-session]')
    await page.waitForSelector('[data-last-hint="1"]')
    await page.waitForSelector('input[aria-label="kg, la dernière fois 60"]')
    await page.waitForSelector('input[aria-label="reps, la dernière fois 8"]')

    // Ensure no legacy text line
    const bodyText = await page.locator('body').innerText()
    if (bodyText.includes('La dernière fois :')) {
      throw new Error('Legacy hint text still visible')
    }

    const grisPath = join(outDir, 'derniere_fois_gris.png')
    await page.screenshot({ path: grisPath, fullPage: false })
    console.log('wrote', grisPath)

    await page.click('input[aria-label="kg, la dernière fois 60"]')
    await page.waitForFunction(() => {
      const weight = document.querySelector('input[aria-label="Série 1 poids"]')
      const reps = document.querySelector('input[aria-label="Série 1 reps"]')
      return weight?.value === '60' && reps?.value === '8'
    })

    // Blur so caret / focus ring doesn’t dominate the shot
    await page.locator('input[aria-label="Série 1 poids"]').evaluate((el) => el.blur())
    await page.waitForTimeout(100)

    const rempliPath = join(outDir, 'derniere_fois_rempli.png')
    await page.screenshot({ path: rempliPath, fullPage: false })
    console.log('wrote', rempliPath)

    await context.close()
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
