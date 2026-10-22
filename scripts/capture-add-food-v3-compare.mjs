#!/usr/bin/env node
/**
 * Capture iPhone 17 (393×852) — écran V3 avec 2 aliments choisis
 * + maquette HTML de référence → /opt/cursor/artifacts/compare-5e6436b.png
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const artifactsDir = '/opt/cursor/artifacts'
const port = 4193
const width = 393
const height = 852

const MOCKUP_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Maquette V3</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;background:#0C0C0E;color:#fff;width:${width}px;height:${height}px;overflow:hidden}
  .screen{display:flex;flex-direction:column;height:100%;padding:12px 16px 0;background:radial-gradient(ellipse 120% 55% at 50% -8%,rgb(90 18 22 / .55),transparent 58%),#0C0C0E}
  h1{font-size:28px;font-weight:700;line-height:1.05;letter-spacing:-.02em}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
  .x{width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;color:#EBEBF5;font-size:18px}
  .search{display:flex;align-items:center;gap:10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);padding:14px 14px 14px 14px;margin-bottom:10px;color:#636366;font-size:15px}
  .actions{display:flex;gap:8px;margin-bottom:8px}
  .act{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);padding:12px;font-size:13px;font-weight:600}
  .dot{width:36px;height:36px;border-radius:999px;background:#FF2B2B;display:flex;align-items:center;justify-content:center;font-size:14px}
  .wheel{height:110px;display:flex;align-items:flex-end;justify-content:center;gap:10px;position:relative;margin-bottom:6px}
  .wheel::before{content:"";position:absolute;left:-10%;right:-10%;bottom:0;height:64px;border-radius:100%;border-top:1px solid rgba(255,255,255,.07);background:radial-gradient(ellipse 55% 100% at 50% 0%,rgb(255 43 43 / .12),transparent 72%);transform:translateY(28px)}
  .cat{display:flex;flex-direction:column;align-items:center;gap:6px;opacity:.35;transform:scale(.78) translateY(14px)}
  .cat.sel{opacity:1;transform:scale(1.12) translateY(0)}
  .cat .c{width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:16px}
  .cat.sel .c{width:56px;height:56px;background:#FF2B2B;box-shadow:0 0 18px 2px rgb(255 43 43 / .45)}
  .cat span{font-size:11px;font-weight:600;color:#8E8E93}
  .cat.sel span{color:#fff}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-bottom:96px;overflow:hidden}
  .card{border-radius:22px;border:1px solid rgba(255,255,255,.08);background:#1A1A1C;overflow:hidden;position:relative}
  .card.sel{border-color:#FF2B2B;box-shadow:0 0 0 1px rgb(255 43 43 / .35)}
  .ph{height:120px;display:flex;align-items:center;justify-content:center;background:linear-gradient(#242426,#1A1A1C);font-size:42px}
  .check{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:999px;background:#fff;color:#FF2B2B;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
  .meta{padding:10px 12px 14px}
  .meta h3{font-size:14px;font-weight:700;line-height:1.25;min-height:2.4em}
  .meta p{font-size:12px;color:#8E8E93;margin-top:4px;font-weight:500}
  .bar{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:12px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(28,28,30,.72);backdrop-filter:blur(18px);padding:12px 14px;box-shadow:0 12px 40px rgb(0 0 0 / .45)}
  .thumbs{display:flex}
  .thumbs i{width:28px;height:28px;border-radius:999px;background:#2C2C2E;border:2px solid #1C1C1E;margin-left:-8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
  .thumbs i:first-child{margin-left:0}
  .bar p{flex:1;font-size:13px;font-weight:600}
  .ok{width:44px;height:44px;border-radius:999px;background:#FF2B2B;display:flex;align-items:center;justify-content:center;font-weight:700}
  .tag{position:absolute;top:8px;left:8px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#AEAEB2;background:rgba(0,0,0,.45);padding:4px 8px;border-radius:999px}
</style>
</head>
<body>
  <div class="screen">
    <div class="tag">Maquette</div>
    <div class="head"><h1>Ajouter<br/>un aliment</h1><div class="x">✕</div></div>
    <div class="search">🔍 &nbsp; Rechercher un aliment, une marque…</div>
    <div class="actions">
      <div class="act"><div class="dot">▥</div>Scan Code-Barre</div>
      <div class="act"><div class="dot">📷</div>Photo IA</div>
    </div>
    <div class="wheel">
      <div class="cat"><div class="c">🍎</div><span>Fruits</span></div>
      <div class="cat"><div class="c">🥤</div><span>Boissons</span></div>
      <div class="cat sel"><div class="c">▦</div><span>Tout</span></div>
      <div class="cat"><div class="c">🍽</div><span>Repas</span></div>
      <div class="cat"><div class="c">🍪</div><span>Snacks</span></div>
    </div>
    <div class="grid">
      <div class="card sel"><div class="check">✓</div><div class="ph">🍌</div><div class="meta"><h3>Banane Bio</h3><p>1 portion (120 g)</p></div></div>
      <div class="card sel"><div class="check">✓</div><div class="ph">🍎</div><div class="meta"><h3>Pomme Golden</h3><p>150 g</p></div></div>
      <div class="card"><div class="ph">💧</div><div class="meta"><h3>Eau minérale</h3><p>1 portion (250 ml)</p></div></div>
      <div class="card"><div class="ph">🍊</div><div class="meta"><h3>Jus d’orange</h3><p>200 ml</p></div></div>
    </div>
    <div class="bar">
      <div class="thumbs"><i>🍌</i><i>🍎</i></div>
      <p>2 aliments choisis</p>
      <div class="ok">✓</div>
    </div>
  </div>
</body>
</html>`

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_ENABLE_CONVEX_PRIMARY: 'false',
      VITE_ENABLE_CONVEX_AUTH: 'false',
      VITE_ENABLE_FOOD_ADD_V3: 'true',
    },
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
  await mkdir(artifactsDir, { recursive: true })
  const mockPath = join(artifactsDir, 'maquette-v3-ref-393.png')
  const appPath = join(artifactsDir, 'app-v3-5e6436b-393.png')
  const comparePath = join(artifactsDir, 'compare-5e6436b.png')

  // Maquette HTML
  const mockServer = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(MOCKUP_HTML)
  })
  await new Promise((r) => mockServer.listen(0, '127.0.0.1', r))
  const mockPort = mockServer.address().port

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  })
  try {
    const mockPage = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await mockPage.goto(`http://127.0.0.1:${mockPort}/`, { waitUntil: 'networkidle' })
    await mockPage.screenshot({ path: mockPath, fullPage: false })
    await mockPage.close()
    mockServer.close()

    const server = await startAppServer(port)
    try {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      })
      await page.goto(`http://127.0.0.1:${port}/add-food-fixture`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      })
      await page.waitForSelector('[data-add-food-screen]', { timeout: 15_000 })
      await page.waitForSelector('[data-food-card]', { timeout: 10_000 })
      const cards = page.locator('[data-food-card]')
      await cards.nth(0).click()
      await cards.nth(1).click()
      await page.waitForSelector('[data-food-selection-bar]', { timeout: 5_000 })
      const barText = await page.locator('[data-food-selection-bar]').innerText()
      if (!/2 aliments choisis/i.test(barText)) {
        throw new Error(`Expected 2 aliments choisis, got: ${barText}`)
      }
      await page.waitForTimeout(400)
      await page.screenshot({ path: appPath, fullPage: false })
      await page.close()
    } finally {
      server.kill('SIGTERM')
    }
  } finally {
    await browser.close()
  }

  // Side-by-side with labels via sharp/PIL
  const { default: sharp } = await import('sharp').catch(() => ({ default: null }))
  if (sharp) {
    const left = await sharp(mockPath).resize(393, 852, { fit: 'cover' }).png().toBuffer()
    const right = await sharp(appPath).resize(393, 852, { fit: 'cover' }).png().toBuffer()
    const labelH = 36
    const canvasW = 393 * 2 + 24
    const canvasH = 852 + labelH + 16
    const svg = Buffer.from(
      `<svg width="${canvasW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0C0C0E"/>
        <text x="196" y="24" fill="#AEAEB2" font-size="14" font-family="sans-serif" text-anchor="middle">Maquette V3</text>
        <text x="${393 + 24 + 196}" y="24" fill="#AEAEB2" font-size="14" font-family="sans-serif" text-anchor="middle">App 5e6436b · iPhone 17</text>
      </svg>`,
    )
    await sharp({
      create: { width: canvasW, height: canvasH, channels: 3, background: '#0C0C0E' },
    })
      .composite([
        { input: svg, top: 0, left: 0 },
        { input: left, top: labelH + 8, left: 0 },
        { input: right, top: labelH + 8, left: 393 + 24 },
      ])
      .png()
      .toFile(comparePath)
  } else {
    // Pillow fallback
    const { spawnSync } = await import('node:child_process')
    const py = `
from PIL import Image, ImageDraw, ImageFont
left=Image.open(${JSON.stringify(mockPath)}).convert('RGB').resize((393,852))
right=Image.open(${JSON.stringify(appPath)}).convert('RGB').resize((393,852))
label_h=36
gap=24
canvas=Image.new('RGB',(393*2+gap,852+label_h+16),(12,12,14))
d=ImageDraw.Draw(canvas)
d.text((120,10),'Maquette V3',fill=(174,174,178))
d.text((393+gap+90,10),'App 5e6436b · iPhone 17',fill=(174,174,178))
canvas.paste(left,(0,label_h+8))
canvas.paste(right,(393+gap,label_h+8))
canvas.save(${JSON.stringify(comparePath)})
print('wrote', ${JSON.stringify(comparePath)})
`
    const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(r.stderr || r.stdout)
    console.log(r.stdout)
  }

  console.log('MOCKUP', mockPath)
  console.log('APP', appPath)
  console.log('COMPARE', comparePath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
