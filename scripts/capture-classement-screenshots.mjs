#!/usr/bin/env node
/**
 * iPhone 17 screenshots (402×874, DPR 3) for « Classement de ma salle ».
 * Saves under /opt/cursor/artifacts/ and scripts/screenshots/classement/.
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'classement')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4188
const VIEWPORT = { width: 402, height: 874 }
const DPR = 3

const scenes = [
  { scene: 'podium', file: 'classement_podium.png' },
  { scene: 'position', file: 'classement_position.png' },
  { scene: 'regles', file: 'classement_regles.png' },
  { scene: 'ajout_manuel', file: 'classement_ajout_manuel.png' },
  { scene: 'train_carte', file: 'train_carte_classement.png' },
]

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

async function startServer() {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    vite,
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        VITE_ENABLE_GYM_LEADERBOARD: 'true',
        VITE_ENABLE_QA_FIXTURES: 'true',
      },
    },
  )
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 45_000)
    const onData = (chunk) => {
      output += chunk.toString()
      if (output.includes('Local:') || output.includes('localhost')) {
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

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DPR,
      isMobile: true,
      hasTouch: true,
    })

    for (const { scene, file } of scenes) {
      const page = await context.newPage()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`http://127.0.0.1:${port}/classement-fixture?scene=${scene}`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-harness-ready]')
      await page.waitForTimeout(400)
      const dest = join(outDir, file)
      await page.screenshot({ path: dest, fullPage: false })
      await copyFile(dest, join(artifactsDir, file))
      console.log('wrote', file)
      await page.close()
    }
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
