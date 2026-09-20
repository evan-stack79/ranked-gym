import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const root = '/workspace'
const outDir = join(root, 'scripts', 'screenshots', 'workout-immersive')
const port = 4189
const captureConfig = join(root, 'scripts', 'workout-immersive-capture', 'vite.config.ts')

async function startServer() {
  const vite = join(root, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', captureConfig, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`timeout\n${output}`)), 20000)
    const onData = (c) => {
      output += c.toString()
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

const chrome = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

await mkdir(outDir, { recursive: true })
const server = await startServer()
const browser = await chromium.launch(chrome)
try {
  // Video 1: real session load (fallback)
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-fallback]')
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-fallback]')
    await page.waitForTimeout(600)
    await context.close()
    // playwright names video randomly — rename
    const { readdir, rename } = await import('node:fs/promises')
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.webm'))
    const newest = files.sort().at(-1)
    if (newest) {
      await rename(join(outDir, newest), join(outDir, 'load-real-developper.webm'))
      console.log('wrote load-real-developper.webm')
    }
  }
  // Video 2: canonical bench photo load + refresh
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${port}/?fixture=bench_press`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-photo]')
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-photo]')
    await page.waitForTimeout(600)
    await context.close()
    const { readdir, rename } = await import('node:fs/promises')
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.webm') && !f.startsWith('load-'))
    const newest = files.sort().at(-1)
    if (newest) {
      await rename(join(outDir, newest), join(outDir, 'load-canonical-bench-refresh.webm'))
      console.log('wrote load-canonical-bench-refresh.webm')
    }
  }
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
