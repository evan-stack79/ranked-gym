#!/usr/bin/env node
/**
 * Captures mobile (390×844) des cartes historique : Squat + Développé couché.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'history-titles')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'history-titles-capture', 'vite.config.ts')
const port = 4194

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
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-history-titles]')

    const text = await page.locator('[data-history-titles]').innerText()
    if (!text.includes('Squat')) throw new Error('Missing Squat card title')
    if (!text.includes('Développé couché')) throw new Error('Missing Développé couché card title')
    if (!text.includes('Séance musculation')) throw new Error('Missing multi-exercise title')
    if (!text.includes('Push du soir')) throw new Error('Missing custom title')
    if (/\bBiceps\b/.test(text)) throw new Error('Biceps still visible on history cards')

    const listShot = join(outDir, 'history_cards_squat_bench_390x844.png')
    await page.screenshot({ path: listShot, fullPage: false })
    await copyFile(listShot, join(artifactsDir, 'history_cards_squat_bench_390x844.png'))

    console.log('history titles captures OK')
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
