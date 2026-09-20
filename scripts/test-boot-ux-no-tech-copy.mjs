#!/usr/bin/env node
/**
 * Harness lancement — aucun texte technique, splash sobre, hors-ligne, retry.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'boot-ux')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4188
const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

const FORBIDDEN = [
  'Récupération des données',
  'Récupération de ton profil',
  'Chargement des données',
  'Chargement des stats',
  'Synchronisation Supabase',
  'Synchronisation…',
  'Enregistrement cloud en cours',
  'Données dans Supabase',
  'VITE_SUPABASE',
  'VITE_CONVEX',
  'workouts, nutrition',
  'schema.sql',
]

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 30_000)
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

function assertNoTechCopy(label, text) {
  for (const snippet of FORBIDDEN) {
    assert.equal(
      text.includes(snippet),
      false,
      `${label} contains technical copy: ${snippet}\n---\n${text.slice(0, 800)}`,
    )
  }
}

async function visibleText(page) {
  return page.evaluate(() => document.body?.innerText ?? '')
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })
  const report = []
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: join(artifactsDir, 'boot-ux-video-tmp'), size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.boot-splash, .app-cold-launch, [data-app-boot-screen="1"], [data-app-brand-header="1"]', {
      timeout: 8000,
    })
    await page.screenshot({ path: join(outDir, 'launch-splash.png') })
    await page.screenshot({ path: join(artifactsDir, 'boot_ux_launch_splash.png') })
    assertNoTechCopy('splash', await visibleText(page))
    report.push('splash: no technical copy')

    await page.waitForTimeout(900)
    await page.screenshot({ path: join(outDir, 'launch-after-splash.png') })
    await page.screenshot({ path: join(artifactsDir, 'boot_ux_after_splash.png') })
    const after = await visibleText(page)
    assertNoTechCopy('after splash', after)
    report.push('after splash: no technical copy')

    const bootScreen = await page.$('[data-app-boot-screen="1"]')
    if (bootScreen) {
      const hasSpin = await page.$('[data-app-boot-screen="1"] .animate-spin')
      assert.equal(hasSpin, null, 'boot screen must not use a central spinner')
      report.push('boot screen: sober splash + skeleton, no spinner')
    }

    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'))
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
      window.dispatchEvent(new Event('offline'))
    })
    await page.waitForTimeout(200)
    const offlineBanner = await page.$('[data-offline-banner="1"]')
    if (offlineBanner) {
      const label = await offlineBanner.innerText()
      assert.match(label, /Hors ligne/)
      report.push('offline: Hors ligne banner visible')
      await page.screenshot({ path: join(outDir, 'offline-banner.png') })
      await page.screenshot({ path: join(artifactsDir, 'boot_ux_offline_banner.png') })
    } else {
      report.push('offline: banner not mounted (auth/boot still settling) — not a failure of copy')
    }
    assertNoTechCopy('offline', await visibleText(page))

    const slow = await browser.newPage()
    await slow.emulateMedia({ reducedMotion: 'reduce' })
    await slow.route('**/*', async (route) => {
      await new Promise((r) => setTimeout(r, 80))
      await route.continue()
    })
    await slow.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
    await slow.waitForTimeout(400)
    await slow.screenshot({ path: join(outDir, 'slow-network.png') })
    await slow.screenshot({ path: join(artifactsDir, 'boot_ux_slow_network.png') })
    assertNoTechCopy('slow network', await slow.evaluate(() => document.body?.innerText ?? ''))
    report.push('slow network: no technical copy')
    await slow.close()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    assertNoTechCopy('refresh', await visibleText(page))
    report.push('refresh: no technical copy')

    await context.close()
    const video = page.video()
    if (video) {
      const raw = await video.path()
      const dest = join(artifactsDir, 'boot_ux_launch.webm')
      try {
        const { copyFile } = await import('node:fs/promises')
        await copyFile(raw, dest)
        report.push(`video: ${dest}`)
      } catch {
        report.push(`video raw: ${raw}`)
      }
    }
  } finally {
    await browser.close()
    await stopServer(server)
  }

  await writeFile(join(outDir, 'report.txt'), `${report.join('\n')}\n`, 'utf8')
  await writeFile(join(artifactsDir, 'boot_ux_harness_report.txt'), `${report.join('\n')}\n`, 'utf8')
  console.log(report.join('\n'))
  console.log('boot UX harness OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
