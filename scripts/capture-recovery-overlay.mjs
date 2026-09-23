#!/usr/bin/env node
/**
 * Capture mobile preuve overlay récupération (maquette Evan).
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'workout-immersive-capture', 'vite.config.ts')
const port = 4193

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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 20_000)
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
  const browser = await chromium.launch(chromiumLaunchOptions)
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${port}/?fixture=recovery`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-harness-ready][data-recovery-mode="1"]')
    await page.waitForSelector('[data-recovery-timer]')
    await page.waitForSelector('[data-recovery-remaining]')
    const text = await page.locator('[data-immersive-session]').innerText()
    const lower = text.toLowerCase()
    if (!lower.includes('récupération') && !lower.includes('recuperation')) {
      throw new Error(`Missing Récupération\n${text}`)
    }
    if (!text.includes('1 min 30') && !text.includes('47 s') && !/00:4\d/.test(text)) {
      throw new Error(`Missing duration/timer\n${text}`)
    }
    if (!text.includes('Reprendre')) throw new Error('Missing Reprendre')
    if (!text.includes('+15 s')) throw new Error('Missing +15 s')
    if (!text.includes('Série 1 terminée') || !text.includes('80')) {
      throw new Error(`Missing completed summary\n${text}`)
    }
    if (text.includes('+30 s') || text.includes('Passer') || text.includes('RPE')) {
      throw new Error(`Forbidden labels\n${text}`)
    }
    // No horizontal progress bar vestige
    const progressBar = await page.locator('[data-recovery-timer] .h-1\\.5').count()
    if (progressBar > 0) throw new Error('Progress bar still present')

    const path = join(outDir, 'recovery-overlay-mobile-390.png')
    await page.screenshot({ path, fullPage: false })
    console.log(`Wrote ${path}`)
    console.log('UI check OK: recovery overlay maquette')
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
