#!/usr/bin/env node
/**
 * Captures lancement froid — vrai chemin Vite (index.html + AppColdLaunch).
 * Widths 320 / 375 / 390 — phases calm + roar.
 */
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'cold-launch')
const port = 4179
const widths = [320, 375, 390]
const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
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
  await new Promise((r) => {
    const t = setTimeout(r, 2000)
    server.once('exit', () => {
      clearTimeout(t)
      r()
    })
  })
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startServer()
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })
  try {
    for (const width of widths) {
      const page = await browser.newPage()
      await page.setViewportSize({ width, height: 812 })
      // Force animation path
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })

      await page.waitForSelector('.app-cold-launch, .boot-splash')
      // Prefer React overlay when ready
      await page.waitForSelector('.app-cold-launch', { timeout: 5000 }).catch(() => null)
      const phase = await page.evaluate(() =>
        document.querySelector('.app-cold-launch')?.getAttribute('data-phase') ?? 'boot',
      )
      if (phase === 'calm' || phase === 'boot') {
        await page.screenshot({
          path: join(outDir, `launch-calm-${width}px.png`),
        })
      }
      await page.waitForFunction(() => {
        const el = document.querySelector('.app-cold-launch')
        return !el || el.getAttribute('data-phase') === 'roar'
      }, { timeout: 3000 })
      if (await page.$('.app-cold-launch')) {
        await page.screenshot({
          path: join(outDir, `launch-roar-${width}px.png`),
        })
      }
      await page.waitForFunction(
        () => document.documentElement.dataset.coldLaunchPlayed === '1',
        { timeout: 5000 },
      )
      await page.close()
    }
    console.log(`Captures written to ${outDir}`)
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
