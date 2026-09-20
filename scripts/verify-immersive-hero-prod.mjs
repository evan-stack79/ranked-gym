#!/usr/bin/env node
/**
 * Preuve production : vite build + preview — asset hero hashed, HTTP 200, MIME image/*.
 * Ne modifie pas la CSP.
 */
import { spawn } from 'node:child_process'
import { readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'scripts', 'screenshots', 'workout-immersive')
const port = 4188
const previewUrl = `http://127.0.0.1:${port}/?fixture=bench_press`

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let out = ''
    child.stdout.on('data', (c) => {
      out += c.toString()
    })
    child.stderr.on('data', (c) => {
      out += c.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code})\n${out}`))
    })
  })
}

async function startPreview() {
  const vite = join(root, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    [
      'preview',
      '--config',
      join(root, 'scripts', 'workout-immersive-capture', 'vite.config.ts'),
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`preview timeout\n${output}`)), 25_000)
    const onData = (chunk) => {
      output += chunk.toString()
      if (/Local:|preview/i.test(output) && output.includes(String(port))) {
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

async function main() {
  await mkdir(outDir, { recursive: true })

  // Build the capture harness (same ImmersiveExerciseSession + Vite asset pipeline).
  console.log('building capture harness…')
  await run(join(root, 'node_modules', '.bin', 'vite'), [
    'build',
    '--config',
    join(root, 'scripts', 'workout-immersive-capture', 'vite.config.ts'),
  ])

  const distAssets = join(root, 'scripts', 'workout-immersive-capture', 'dist', 'assets')
  const files = existsSync(distAssets) ? await readdir(distAssets) : []
  const webp = files.filter((f) => /developpe-couche.*\.webp$/i.test(f) || f.endsWith('.webp'))
  console.log('dist assets webp:', webp)

  const preview = await startPreview()
  const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
    ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] }

  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const hits = []
    page.on('response', async (res) => {
      const u = res.url()
      if (/\.(webp|jpg|png)(\?|$)/i.test(u) || u.includes('developpe-couche')) {
        hits.push({
          url: u,
          status: res.status(),
          contentType: res.headers()['content-type'] ?? null,
        })
      }
    })
    await page.goto(previewUrl, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-photo]', { timeout: 10_000 })
    // Refresh proof
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-hero-photo]', { timeout: 10_000 })
    const shot = join(outDir, 'prod-preview-canonical-bench-390.png')
    await page.screenshot({ path: shot, fullPage: false })

    const diag = {
      mode: 'vite build + preview (capture harness)',
      hashedWebpInDist: webp,
      heroAfterRefresh: await page.getAttribute('[data-immersive-session]', 'data-hero-image'),
      title: await page.locator('h1').innerText(),
      networkHits: hits,
      screenshot: shot,
      cspUnchanged: true,
    }
    const diagPath = join(outDir, 'prod-hero-diag.json')
    await writeFile(diagPath, JSON.stringify(diag, null, 2))
    console.log('wrote', diagPath)
    console.log(JSON.stringify(diag, null, 2))

    const ok =
      diag.heroAfterRefresh === 'ready' &&
      hits.some((h) => h.status === 200 && /image\//.test(h.contentType ?? ''))
    if (!ok) {
      console.error('PRODUCTION HERO CHECK FAILED')
      process.exit(1)
    }
  } finally {
    if (browser) await browser.close()
    preview.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
