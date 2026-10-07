#!/usr/bin/env node
/**
 * WebKit 390×844 — preuves hint « dernière fois » + tap-to-copy.
 * Sortie : /opt/cursor/artifacts/derniere_fois_seance.png
 *           /opt/cursor/artifacts/derniere_fois_copie.png
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
    await page.waitForSelector('[data-last-performance="0"]')
    await page.waitForSelector('text=La dernière fois : 60 kg × 8 · Effort 8')

    const seancePath = join(outDir, 'derniere_fois_seance.png')
    await page.screenshot({ path: seancePath, fullPage: false })
    console.log('wrote', seancePath)

    await page.click('[data-last-performance="0"]')
    await page.waitForFunction(() => {
      const weight = document.querySelector('input[aria-label="Série 1 poids"]')
      const reps = document.querySelector('input[aria-label="Série 1 reps"]')
      return weight?.value === '60' && reps?.value === '8'
    })

    const copiePath = join(outDir, 'derniere_fois_copie.png')
    await page.screenshot({ path: copiePath, fullPage: false })
    console.log('wrote', copiePath)

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
