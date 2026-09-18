#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'workout-immersive')
const captureConfig = join(scriptsDir, 'workout-immersive-capture', 'vite.config.ts')
const port = 4187

const viewports = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'android-360', width: 360, height: 800 },
]

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
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-harness-ready]')
      await page.waitForSelector('[data-immersive-session]')
      await page.waitForSelector('text=Développé couché')
      await page.waitForSelector('text=Pectoraux · Triceps')
      await page.waitForSelector('text=Exercice 3 sur 8')

      const path = join(outDir, `developpe-couche-${vp.name}.png`)
      await page.screenshot({ path, fullPage: false })
      console.log('wrote', path)
      await context.close()
    }
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
