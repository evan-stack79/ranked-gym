#!/usr/bin/env node
/**
 * Captures avant/après Mon créneau plein écran via /creneau-layout-fixture.
 * Sortie : /opt/cursor/artifacts/creneau-*-{before,after}.png
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const root = new URL('..', import.meta.url).pathname
const outDir = '/opt/cursor/artifacts'
const port = 5199

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await sleep(500)
  }
  throw new Error(`Server not ready: ${url}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += String(d)
  })
  try {
    await waitForServer(`http://127.0.0.1:${port}/creneau-layout-fixture`)
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/local/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--app-safe-area-top', '47px')
      document.documentElement.style.setProperty('--app-safe-area-bottom', '34px')
    })

    const shots = [
      { qs: 'bleed=0&state=principal', file: 'creneau-fullscreen-before.png' },
      { qs: 'bleed=1&state=principal', file: 'creneau-fullscreen-after.png' },
      { qs: 'bleed=1&state=principal', file: 'creneau-slot-after.png' },
      { qs: 'bleed=1&state=empty', file: 'creneau-empty-after.png' },
      { qs: 'bleed=0&state=empty', file: 'creneau-empty-before.png' },
    ]

    for (const s of shots) {
      await page.goto(`http://127.0.0.1:${port}/creneau-layout-fixture?${s.qs}`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-creneau-v9]')
      await page.waitForTimeout(400)
      await page.screenshot({ path: join(outDir, s.file), fullPage: false })
    }

    await browser.close()
    console.log('Wrote captures to', outDir)
  } finally {
    child.kill('SIGTERM')
    if (stderr && process.env.DEBUG) console.error(stderr)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
