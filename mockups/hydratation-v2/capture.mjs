#!/usr/bin/env node
/**
 * Capture écrans 2+3 (et A/B SVG) — 390×844 @3x → 1170×2532.
 * N’écrase PAS 1_accueil_widget_eau.png.
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
    screen: 'alimentation',
    file: '2_alimentation_glisser.png',
    wait: '[data-mockup-photo-container="plastic_15"]',
    forbid: [/kcal/i, /\bcalories?\b/i, /\bAdd\b/, /\bWater\b/, /\bBottle\b/, /Exemple/],
    require: ['Nutrition', 'Bouteille 1,5 L', 'glisse pour régler', 'Ajouter', '620'],
    visible: ['[data-mockup-add-water]', '[data-mockup-estimate]', '[data-mockup-drag-handle]'],
  },
  {
    screen: 'ma-bouteille',
    file: '3_ma_bouteille_pro.png',
    wait: '[data-mockup-photo-container="gourd"]',
    forbid: [/kcal/i, /\bcalories?\b/i, /Exemple/, /\bXP\b/, /bonus/i],
    require: [
      'Ma bouteille',
      'Pro',
      'Changer la photo',
      'Pas de visage',
      'Ajouter',
      'Photo prise le 12 oct.',
    ],
    visible: [
      '[data-mockup-add-water]',
      '[data-mockup-photo-meta]',
      '[data-mockup-no-face]',
      '[data-mockup-estimate]',
      '[data-mockup-drag-handle]',
    ],
  },
  {
    screen: 'svg-compare',
    file: '_ab_svg_alimentation.png',
    wait: '[data-mockup-svg-bottle="15"]',
    forbid: [/kcal/i],
    require: ['Nutrition', '620'],
    visible: ['[data-mockup-drag-handle]'],
    artifactOnly: true,
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
      throw new Error(`${shot.file}: texte interdit (${re})`)
    }
  }
  for (const needle of shot.require) {
    if (!text.includes(needle)) {
      throw new Error(`${shot.file}: texte manquant « ${needle} » — extrait: ${text.slice(0, 400)}`)
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
      await page.waitForTimeout(500)

      const text = await page.locator('[data-app-shell]').innerText()
      assertFrenchCopy(text, shot)

      for (const sel of shot.visible ?? []) {
        const el = page.locator(sel).first()
        await el.waitFor({ state: 'visible', timeout: 10_000 })
        const box = await el.boundingBox()
        if (!box) throw new Error(`${shot.file}: ${sel} sans boundingBox`)
        const maxBottom = VIEWPORT.height - 100
        if (box.y + box.height > maxBottom) {
          throw new Error(
            `${shot.file}: ${sel} sous la nav (bottom=${(box.y + box.height).toFixed(0)} > ${maxBottom})`,
          )
        }
      }

      // Vérifie ratio eau ~620/1500 + surface utile (~41% zone remplissable)
      if (shot.screen === 'alimentation') {
        const el = page.locator('[data-mockup-drag-panel] [data-mockup-photo-container="plastic_15"]')
        const ratio = Number(await el.getAttribute('data-fill-ratio'))
        const surface = Number(await el.getAttribute('data-water-surface'))
        if (!(Math.abs(ratio - 620 / 1500) < 0.01)) {
          throw new Error(`fillRatio incorrect: ${ratio}`)
        }
        // topInset 0.155 + bottomInset 0.035 → useful 0.81 ; surface = 0.035 + 0.4133*0.81 ≈ 0.370
        if (!(surface > 0.33 && surface < 0.42)) {
          throw new Error(`water surface hors plage utile: ${surface}`)
        }
        const waterVisible = await page
          .locator('[data-mockup-drag-panel] [data-mockup-water-fill]')
          .first()
          .isVisible()
        if (!waterVisible) throw new Error('eau non visible')
      }
      if (shot.screen === 'ma-bouteille') {
        const waterVisible = await page
          .locator('[data-mockup-drag-panel] [data-mockup-water-fill]')
          .first()
          .isVisible()
        if (!waterVisible) throw new Error('eau gourde non visible')
      }

      const outLocal = join(rendusDir, shot.file)
      const outArt = join(artifactsDir, shot.file)
      await page.screenshot({ path: outLocal, type: 'png', fullPage: false })
      await copyFile(outLocal, outArt)
      console.log(`saved ${shot.file}`)
      report.push({ file: shot.file, path: outArt })
      await context.close()
    }
  } finally {
    await browser.close()
    await stopServer(server)
  }

  await writeFile(
    join(artifactsDir, 'hydratation-v2-capture-report.json'),
    JSON.stringify(report, null, 2),
  )
  console.log('OK', report.map((r) => r.path).join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
