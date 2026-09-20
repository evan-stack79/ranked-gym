#!/usr/bin/env node
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'train-hub')
const port = 4182
const widths = [320, 375, 390]
const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    [
      '--config',
      join(scriptsDir, 'train-hub-capture', 'vite.config.ts'),
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
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
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })
    const context = await browser.newContext({
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    for (const width of widths) {
      const page = await context.newPage()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 812 })
      await page.goto(`http://127.0.0.1:${port}/?scenario=course`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-harness-ready]')
      await page.getByLabel('Accès Train').getByRole('button', { name: 'Programmes' }).click()
      await page.waitForTimeout(400)
      const path = join(outDir, `agenda-${width}px.png`)
      await page.screenshot({ path, fullPage: true })
      console.log('wrote', path)
      await page.close()
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
