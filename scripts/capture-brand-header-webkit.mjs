#!/usr/bin/env node
/**
 * Capture sticky brand header at iPhone 390×844 @3x (Playwright WebKit).
 * Usage: node scripts/capture-brand-header-webkit.mjs <label>
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { webkit } from 'playwright'

const label = process.argv[2] || 'shot'
const projectRoot = new URL('..', import.meta.url).pathname
const outDir = '/opt/cursor/artifacts/brand-header-blur'
const port = 4197
const width = 390
const height = 844
const dpr = 3

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_ENABLE_CONVEX_PRIMARY: 'false', VITE_ENABLE_CONVEX_AUTH: 'false' },
  })
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
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer)
        reject(new Error(`Vite exited ${code}\n${output}`))
      }
    })
  })
  return child
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startAppServer(port)
  let browser
  try {
    browser = await webkit.launch()
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.route('**/*', async (route) => {
      const request = route.request()
      if (request.resourceType() === 'document') {
        const response = await route.fetch()
        let body = await response.text()
        body = body.replace(/upgrade-insecure-requests;?/gi, '')
        await route.fulfill({
          status: response.status(),
          headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' },
          body,
        })
        return
      }
      await route.continue()
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const apply = () => {
        const root = document.documentElement
        if (!root) return
        root.dataset.coldLaunchPlayed = '1'
        root.dataset.coldLaunchHandoff = 'done'
        root.style.setProperty('--app-safe-area-top', '47px')
        root.style.setProperty('--app-safe-area-bottom', '34px')
      }
      apply()
      document.addEventListener('DOMContentLoaded', apply)
    })

    await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-app-brand-header="1"]', { timeout: 30_000 })
    await page.waitForSelector('[data-brand-wordmark="compact"]', { timeout: 15_000 })
    await page.waitForTimeout(400)

    const header = page.locator('[data-app-brand-header="1"]')
    const box = await header.boundingBox()
    await page.screenshot({ path: join(outDir, `${label}_full.png`), fullPage: false })
    await header.screenshot({ path: join(outDir, `${label}_header.png`) })
    if (box) {
      await page.screenshot({
        path: join(outDir, `${label}_zoom.png`),
        clip: {
          x: Math.max(0, box.x + box.width / 2 - 90),
          y: Math.max(0, box.y),
          width: 180,
          height: Math.min(box.height + 8, 80),
        },
      })
    }
    const word = page.locator('[data-brand-wordmark="compact"]')
    const mark = page.locator('[data-brand-mark-svg="compact"], [data-brand-mark-image="compact"]')
    if (await word.count()) await word.screenshot({ path: join(outDir, `${label}_wordmark_crop.png`) })
    if (await mark.count()) await mark.screenshot({ path: join(outDir, `${label}_mark_crop.png`) })

    const kind = await page.evaluate(() => ({
      svg: !!document.querySelector('[data-brand-mark-svg="compact"]'),
      img: !!document.querySelector('[data-brand-mark-image="compact"]'),
      word: document.querySelector('[data-brand-wordmark="compact"]')?.textContent,
    }))
    console.log(JSON.stringify({ ok: true, label, kind, outDir }, null, 2))
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
