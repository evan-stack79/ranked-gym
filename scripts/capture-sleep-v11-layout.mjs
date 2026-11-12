#!/usr/bin/env node
/**
 * Captures Sleep page + dock nav layout (Evan IPA feedback).
 * Viewports: 393×852, 402×874 (iPhone 17), 375×667.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'sleep-v11-layout')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'sleep-layout-capture', 'vite.config.ts')
const port = 4227

const VIEWPORTS = [
  { name: 'iphone17-402', width: 402, height: 874 },
  { name: 'iphone-se-375', width: 375, height: 667 },
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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 60_000)
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

async function launchBrowser() {
  try {
    const browser = await webkit.launch()
    return { browser, engine: 'webkit' }
  } catch (error) {
    console.warn('WebKit unavailable, falling back to Chromium:', error.message)
    const browser = await chromium.launch(chromiumLaunchOptions)
    return { browser, engine: 'chromium' }
  }
}

async function assertLayout(page, label) {
  const allowScroll = true // grand cadran : scroll OK (diag en bas)
  // Vérifier le CTA au-dessus de la nav (scroll bas si besoin).
  await page.evaluate(() => {
    const btn = document.querySelector('[data-sleep-now]')
    const main = document.querySelector('[data-app-scroll-main]')
    if (btn && main) {
      const nav = document.querySelector('[data-bottom-nav-variant]')
      const btnBottom = btn.getBoundingClientRect().bottom
      const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight
      if (btnBottom > navTop - 4) {
        btn.scrollIntoView({ block: 'center' })
      }
    }
  })
  await page.waitForTimeout(150)
  const probe = await page.evaluate(
    (opts) => {
      const pageEl = document.querySelector('[data-sleep-page]')
      const btn = document.querySelector('[data-sleep-now]')
      const nav = document.querySelector('[data-bottom-nav-variant="floating-pill"]')
      const title = document.querySelector('[data-sleep-page] h1')
      const scrollMain = document.querySelector('[data-app-scroll-main]')
      const bubble = document.querySelector('[data-nav-bubble]')
      if (!pageEl || !btn || !nav || !title || !scrollMain) {
        return { ok: false, reason: 'missing-nodes' }
      }
      const btnRect = btn.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      const titleRect = title.getBoundingClientRect()
      const vh = window.innerHeight
      const btnFullyAboveNav = btnRect.bottom <= navRect.top + 2
      const dialEl = document.querySelector('[data-sleep-clock-dial]')
      const dialSize = Number(dialEl?.getAttribute('data-sleep-dial-size') ?? '0')
      const dialVariant = dialEl?.getAttribute('data-sleep-dial-variant')
      const labels = [...nav.querySelectorAll('[data-nav-tab]')].map(
        (el) => el.getAttribute('aria-label'),
      )
      const overflow = scrollMain.scrollHeight - scrollMain.clientHeight
      const dialOk = dialSize >= opts.minDial && dialVariant === 'v12c'
      return {
        ok:
          btnFullyAboveNav &&
          labels.length === 5 &&
          labels.includes('Sommeil') &&
          Boolean(bubble) &&
          dialOk,
        btnFullyAboveNav,
        titleNearTop: titleRect.top >= 0 && titleRect.top < 100,
        titleTop: titleRect.top,
        btnBottom: btnRect.bottom,
        navTop: navRect.top,
        vh,
        labels,
        variant: nav.getAttribute('data-bottom-nav-variant'),
        dialVariant,
        scrollHeight: scrollMain.scrollHeight,
        clientHeight: scrollMain.clientHeight,
        overflow,
        dialSize,
        allowScrollFlag: opts.allowScrollFlag,
      }
    },
    {
      allowScrollFlag: allowScroll,
      minDial: label.includes('402') ? 300 : 260,
    },
  )
  console.log(`assert ${label}`, probe)
  if (!probe.ok) {
    throw new Error(`Layout assert failed (${label}): ${JSON.stringify(probe)}`)
  }
}

async function captureViewport(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-harness-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('[data-sleep-page]', { state: 'attached', timeout: 15_000 })
  await page.waitForSelector('[data-bottom-nav-variant="floating-pill"]', {
    state: 'attached',
    timeout: 10_000,
  })
  await page.waitForTimeout(400)

  // Capture en haut (titre + grand cadran + liquid glass).
  const file = `sleep-${vp.name}.png`
  const path = join(outDir, file)
  await page.screenshot({ path, fullPage: false })
  await copyFile(path, join(artifactsDir, file))
  console.log('wrote', file)

  await assertLayout(page, vp.name)
  await context.close()
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  const { browser, engine } = await launchBrowser()
  console.log('engine', engine)
  try {
    for (const vp of VIEWPORTS) {
      await captureViewport(browser, vp)
    }
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
