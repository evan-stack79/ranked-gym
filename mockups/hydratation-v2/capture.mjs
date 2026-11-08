#!/usr/bin/env node
/**
 * Capture 3 maquettes iPhone (390×844 CSS, deviceScaleFactor 3 → 1170×2532).
 * Sortie : /opt/cursor/artifacts/ + mockups/hydratation-v2/rendus/
 */
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(dir, '../..')
const artifactsDir = '/opt/cursor/artifacts'
const rendusDir = join(dir, 'rendus')
const port = 4321
const captureConfig = join(dir, 'vite.config.ts')

const VIEWPORT = { width: 390, height: 844 }
const DPR = 3

const SHOTS = [
  {
    screen: 'accueil',
    file: '1_accueil_widget_eau.png',
    wait: '[data-mockup-eau-glasses]',
    forbid: [/kcal/i, /\bcalories?\b/i],
    require: ['Accueil', 'Eau', '1,25', 'Séries du jour'],
    visible: ['[data-mockup-eau-glasses]'],
  },
  {
    screen: 'alimentation',
    file: '2_alimentation_glisser.png',
    wait: '[data-mockup-drag-panel="plastic_15"]',
    forbid: [/kcal/i, /\bcalories?\b/i, /\bAdd\b/, /\bWater\b/, /\bBottle\b/],
    require: ['Nutrition', 'Bouteille 1,5 L', 'glisse pour régler', 'Ajouter', '620'],
    visible: ['[data-mockup-add-water]', '[data-mockup-estimate]', '[data-mockup-drag-handle]'],
  },
  {
    screen: 'ma-bouteille',
    file: '3_ma_bouteille_pro.png',
    wait: '[data-mockup-bottle="gourd"]',
    forbid: [/kcal/i, /\bcalories?\b/i, /\bXP\b/, /bonus/i],
    require: ['Ma bouteille', 'Pro', 'Exemple', 'Reprendre la photo', 'Pas de visage', 'Ajouter'],
    visible: [
      '[data-mockup-add-water]',
      '[data-mockup-retake-photo]',
      '[data-mockup-no-face]',
      '[data-mockup-estimate]',
    ],
  },
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

function assertFrenchCopy(text, shot) {
  for (const re of shot.forbid) {
    if (re.test(text)) {
      throw new Error(`${shot.file}: texte interdit trouvé (${re}) — extrait: ${text.slice(0, 280)}`)
    }
  }
  for (const needle of shot.require) {
    if (!text.includes(needle)) {
      throw new Error(`${shot.file}: texte manquant « ${needle} »`)
    }
  }
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  await mkdir(rendusDir, { recursive: true })

  const server = await startServer()
  const browser = await chromium.launch(chromiumLaunchOptions)
  const report = []

  try {
    for (const shot of SHOTS) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DPR,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
        locale: 'fr-FR',
      })
      const page = await context.newPage()
      const url = `http://127.0.0.1:${port}/?screen=${shot.screen}`
      const response = await page.goto(url, { waitUntil: 'networkidle' })
      console.log(`goto ${shot.screen} status=${response?.status()}`)
      await page.waitForSelector('[data-harness-ready]', { timeout: 30_000 })
      await page.waitForSelector(shot.wait, { timeout: 20_000 })
      await page.waitForSelector('[data-bottom-nav-variant="floating-pill"]', { timeout: 15_000 })
      await page.waitForTimeout(400)

      const text = await page.locator('[data-app-shell]').innerText()
      assertFrenchCopy(text, shot)

      for (const sel of shot.visible ?? []) {
        const el = page.locator(sel).first()
        await el.waitFor({ state: 'visible', timeout: 10_000 })
        const box = await el.boundingBox()
        if (!box) throw new Error(`${shot.file}: ${sel} sans boundingBox`)
        // BottomNav floating pill + safe-area ≈ 100px — contenu utile au-dessus.
        const maxBottom = VIEWPORT.height - 100
        if (box.y + box.height > maxBottom) {
          throw new Error(
            `${shot.file}: ${sel} sous la nav (bottom=${(box.y + box.height).toFixed(0)} > ${maxBottom})`,
          )
        }
        if (box.x < -2 || box.x + box.width > VIEWPORT.width + 2) {
          throw new Error(`${shot.file}: ${sel} coupe horizontalement`)
        }
      }

      const outLocal = join(rendusDir, shot.file)
      const outArt = join(artifactsDir, shot.file)
      await page.screenshot({ path: outLocal, type: 'png', fullPage: false })
      await copyFile(outLocal, outArt)

      const box = await page.evaluate(() => ({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio,
      }))
      console.log(`saved ${shot.file} viewport=${box.w}x${box.h} dpr=${box.dpr}`)
      report.push({ file: shot.file, ...box, path: outArt })
      await context.close()
    }
  } finally {
    await browser.close()
    await stopServer(server)
  }

  await writeFile(join(artifactsDir, 'hydratation-v2-capture-report.json'), JSON.stringify(report, null, 2))
  console.log('OK', report.map((r) => r.path).join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
