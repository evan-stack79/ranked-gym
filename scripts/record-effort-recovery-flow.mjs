#!/usr/bin/env node
/**
 * Vidéo : saisie Effort → validation auto → overlay récupération (maquette).
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'
const videoDir = join(outDir, 'recovery-video-tmp')
const captureConfig = join(scriptsDir, 'workout-immersive-capture', 'vite.config.ts')
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

async function typeInto(page, selector, value) {
  const input = page.locator(selector)
  await input.click()
  await input.fill('')
  await input.pressSequentially(value, { delay: 100 })
  // Ne pas blur : auto-validate peut démonter l’input dès la saisie Effort
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(videoDir, { recursive: true })
  const server = await startServer()
  const browser = await chromium.launch(chromiumLaunchOptions)
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(
      `http://127.0.0.1:${port}/?autoValidate=1&fixture=bench_press`,
      { waitUntil: 'networkidle' },
    )
    await page.waitForSelector('[data-harness-ready][data-auto-validate="1"]')
    await page.waitForSelector('input[aria-label="Série 1 effort facultatif"]')
    await page.waitForTimeout(600)

    // Saisie Effort 8 → auto-validate (charge/reps déjà 80×6) → overlay récup
    await typeInto(page, 'input[aria-label="Série 1 effort facultatif"]', '8')
    await page.waitForSelector('[data-recovery-timer]', { timeout: 5000 })
    await page.waitForSelector('[data-recovery-remaining]')
    await page.waitForTimeout(1200)

    // Preuve +15 s
    await page.locator('[data-recovery-add-15]').click()
    await page.waitForTimeout(900)

    const text = await page.locator('[data-immersive-session]').innerText()
    if (!/r[eé]cup[eé]ration/i.test(text)) {
      throw new Error(`Recovery label missing after effort\n${text}`)
    }
    if (!text.includes('Reprendre') || !text.includes('+15 s')) {
      throw new Error(`Controls missing\n${text}`)
    }

    await page.waitForTimeout(400)
    await context.close()

    // Move recorded webm to artifacts
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(videoDir).filter((f) => f.endsWith('.webm'))
    if (!files.length) throw new Error('No video recorded')
    const dest = join(outDir, 'effort-to-recovery-overlay-flow.webm')
    renameSync(join(videoDir, files[0]), dest)
    console.log(`Wrote ${dest}`)
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
