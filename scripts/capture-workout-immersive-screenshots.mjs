#!/usr/bin/env node
/**
 * Capture preuves séance immersive — fixture runtime réelle (DÉVELOPPER / 1/1 / 20×8)
 * + variante canonical bench_press (photo locale).
 */
import { mkdir, writeFile } from 'node:fs/promises'
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

async function capturePage(browser, { url, waitHero, filePrefix, expectText }) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const networkHits = []
    page.on('response', async (res) => {
      const u = res.url()
      if (u.includes('developpe-couche') || u.match(/\.(webp|jpg|png)(\?|$)/)) {
        networkHits.push({ url: u, status: res.status(), type: res.headers()['content-type'] })
      }
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-harness-ready]')
    await page.waitForSelector('[data-immersive-session]')
    await page.waitForSelector(`text=${expectText}`)
    await page.waitForSelector(waitHero)

    const path = join(outDir, `${filePrefix}-${vp.name}.png`)
    await page.screenshot({ path, fullPage: false })
    console.log('wrote', path)

    if (vp.name === 'iphone-390') {
      const diag = {
        fixture: await page.getAttribute('[data-harness-ready]', 'data-fixture'),
        hero: await page.getAttribute('[data-immersive-session]', 'data-hero-image'),
        slug: await page.getAttribute('[data-immersive-session]', 'data-exercise-slug'),
        canonical: await page.getAttribute('[data-immersive-session]', 'data-canonical-exercise'),
        title: await page.locator('h1').innerText(),
        progress: await page.locator('text=/Exercice \\d+ sur \\d+/').innerText(),
        networkHits,
      }
      const diagPath = join(outDir, `${filePrefix}-diag.json`)
      await writeFile(diagPath, JSON.stringify(diag, null, 2))
      console.log('wrote', diagPath, JSON.stringify(diag))
    }
    await context.close()
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)

    // 1) Séance réelle Evan — fallback discret, données 20×8
    await capturePage(browser, {
      url: `http://127.0.0.1:${port}/`,
      waitHero: '[data-hero-fallback]',
      filePrefix: 'real-developper',
      expectText: 'DÉVELOPPER',
    })

    // 2) Même composant + canonicalExerciseId → photo Vite locale
    await capturePage(browser, {
      url: `http://127.0.0.1:${port}/?fixture=bench_press`,
      waitHero: '[data-hero-photo]',
      filePrefix: 'canonical-bench',
      expectText: 'DÉVELOPPER',
    })
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
