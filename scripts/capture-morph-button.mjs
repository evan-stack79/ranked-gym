/**
 * Capture MorphButton paiement (succès) → WebM sous /opt/cursor/artifacts/.
 * Usage: node scripts/capture-morph-button.mjs
 */
import { createServer } from 'node:http'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { build } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demoDir = join(root, 'scripts/morph-button-demo')
const outDir = join(root, 'scripts/morph-button-demo/dist')
const artifacts = '/opt/cursor/artifacts'
const videoPath = join(artifacts, 'morph-button-pay-demo.webm')

mkdirSync(artifacts, { recursive: true })
mkdirSync(outDir, { recursive: true })

await build({
  root: demoDir,
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
  },
  logLevel: 'warn',
})

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let path = url.pathname === '/' ? '/index.html' : url.pathname
  const file = join(outDir, path)
  if (!file.startsWith(outDir) || !existsSync(file)) {
    res.writeHead(404)
    res.end('missing')
    return
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' })
  res.end(readFileSync(file))
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()
const url = `http://127.0.0.1:${port}/?auto=1`

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 720 },
  recordVideo: { dir: artifacts, size: { width: 390, height: 720 } },
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-dissolve="morph-button"]')
await page.waitForTimeout(400)
// auto click already scheduled; wait through loading → done → reset
await page.waitForFunction(() => {
  const el = document.querySelector('[data-dissolve="morph-button"]')
  return el?.getAttribute('data-phase') === 'done'
}, null, { timeout: 8000 })
await page.waitForTimeout(2400)
await page.waitForFunction(() => {
  const el = document.querySelector('[data-dissolve="morph-button"]')
  return el?.getAttribute('data-phase') === 'idle'
}, null, { timeout: 5000 })
await page.waitForTimeout(400)

const recorded = await page.video()?.path()
await context.close()
await browser.close()
server.close()

if (recorded && existsSync(recorded)) {
  const { copyFileSync, renameSync } = await import('node:fs')
  try {
    renameSync(recorded, videoPath)
  } catch {
    copyFileSync(recorded, videoPath)
  }
  console.log('Wrote', videoPath)
} else {
  console.error('No video recorded')
  process.exit(1)
}
