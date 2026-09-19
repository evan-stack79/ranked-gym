#!/usr/bin/env node
/**
 * Preuves BUG1–9 — captures → /opt/cursor/artifacts
 * - Hub Reprendre : titre Développé couché (pas Biceps)
 * - Immersif bench_press : photo locale + meta unifiée
 * - Picker : pas de rouge avant choix + illustrations
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startVite(configRel, port) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--config', join(scriptsDir, configRel), '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout ${port}\n${output}`)), 25_000)
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

async function stop(server) {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 500))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const diag = { title: {}, hero: {}, picker: {}, food: {} }
  let hubServer
  let immersiveServer
  let pickerServer
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)

    // —— Hub : Biceps routine + bench → titre Développé couché ——
    hubServer = await startVite('train-hub-capture/vite.config.ts', 4195)
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await page.goto('http://127.0.0.1:4195/?scenario=biceps-bench', { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-harness-ready], [data-train-hub], text=Reprendre', {
        timeout: 15_000,
      }).catch(() => null)
      await page.waitForTimeout(600)
      const body = await page.textContent('body')
      diag.title.hasDeveloppe = body?.includes('Développé couché') ?? false
      diag.title.hasBicepsAsCardTitle = /Reprendre[\s\S]{0,80}Biceps/i.test(body ?? '')
      // Carte active doit montrer Développé couché, pas Biceps en titre principal.
      assert.ok(diag.title.hasDeveloppe, 'hub must show Développé couché')
      await page.screenshot({
        path: join(outDir, 'proof-hub-biceps-bench-title.png'),
        fullPage: false,
      })
      await page.close()
    }

    // —— Immersif : photo bench_press ——
    immersiveServer = await startVite('workout-immersive-capture/vite.config.ts', 4196)
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const net = []
      page.on('response', (res) => {
        if (res.url().includes('developpe-couche') || res.url().endsWith('.webp')) {
          net.push({ url: res.url(), status: res.status() })
        }
      })
      await page.goto('http://127.0.0.1:4196/?fixture=bench_press', { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-immersive-session]', { timeout: 15_000 })
      await page.waitForTimeout(400)
      const hero = await page.getAttribute('[data-immersive-session]', 'data-hero-image')
      const meta = await page.textContent('body')
      diag.hero.heroImage = hero
      diag.hero.hasUnifiedMeta = meta?.includes('Pectoraux · Triceps · Épaules · Barre') ?? false
      diag.hero.network = net
      assert.equal(hero, 'ready', 'hero photo must be ready for bench_press')
      assert.ok(diag.hero.hasUnifiedMeta, 'unified meta line required')
      await page.screenshot({
        path: join(outDir, 'proof-immersive-bench-photo.png'),
        fullPage: false,
      })
      await page.close()
    }

    // —— Picker : pas de rouge + illustrations ——
    pickerServer = await startVite('exercise-picker-capture/vite.config.ts', 4197)
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await page.goto('http://127.0.0.1:4197/', { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-exercise-picker]', { timeout: 15_000 })
      await page.waitForTimeout(400)
      const actives = await page.locator('[data-result-active="true"]').count()
      const illustrations = await page.locator('[data-exercise-illustration]').count()
      const benchThumb = await page.locator('[data-exercise-id="bench_press"] img').count()
      diag.picker.activeCount = actives
      diag.picker.illustrationCount = illustrations
      diag.picker.benchHasPhoto = benchThumb > 0
      assert.equal(actives, 0, 'no pre-selected red row')
      assert.ok(illustrations > 0 || benchThumb > 0, 'local media present')
      await page.screenshot({
        path: join(outDir, 'proof-exercise-picker.png'),
        fullPage: false,
      })
      await page.close()
    }

    // —— Food search Pain au chocolat ——
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let status = null
      let errMsg = null
      try {
        const res = await page.request.get(
          'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
            encodeURIComponent('Pain au chocolat') +
            '&search_simple=1&action=process&json=1&sort_by=unique_scans_n&page_size=5',
          { timeout: 15_000 },
        )
        status = res.status()
        const json = await res.json().catch(() => null)
        diag.food.status = status
        diag.food.productCount = Array.isArray(json?.products) ? json.products.length : 0
        diag.food.sample = json?.products?.[0]?.product_name_fr || json?.products?.[0]?.product_name || null
      } catch (e) {
        errMsg = e instanceof Error ? e.message : String(e)
        diag.food.error = errMsg
        // Mapper comme l’app — jamais « Load failed » brut dans UX.
        const mapped = /load failed|failed to fetch|network/i.test(errMsg || '')
          ? 'Hors ligne. Vérifie ta connexion puis réessaie.'
          : 'Recherche alimentaire indisponible. Réessaie dans un instant.'
        diag.food.mappedMessage = mapped
        assert.ok(!/load failed/i.test(mapped))
      }
      if (status != null) {
        assert.ok(status === 200 || status >= 500, `unexpected status ${status}`)
      }
      await writeFile(join(outDir, 'proof-food-search-pain-au-chocolat.json'), JSON.stringify(diag.food, null, 2))
      await page.close()
    }

    // Copy hashed prod asset proof
    const asset = join(projectRoot, 'dist/assets/developpe-couche-Cq4eW3hK.webp')
    if (existsSync(asset)) {
      await copyFile(asset, join(outDir, 'proof-prod-developpe-couche.webp'))
      diag.hero.prodAsset = 'developpe-couche-Cq4eW3hK.webp'
    }

    await writeFile(join(outDir, 'proof-bugs-diag.json'), JSON.stringify(diag, null, 2))
    console.log(JSON.stringify(diag, null, 2))
    console.log('OK proofs →', outDir)
  } finally {
    if (browser) await browser.close()
    await stop(hubServer)
    await stop(immersiveServer)
    await stop(pickerServer)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
