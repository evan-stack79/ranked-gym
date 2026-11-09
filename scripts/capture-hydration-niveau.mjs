#!/usr/bin/env node
/**
 * Captures Hydratation — mode réglage + mode boire @ 390×844.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import {
  chromiumLaunchOptions,
  preparePage,
  projectRoot,
  stopHarnessServer,
} from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4199
const width = 390
const height = 844

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_ENABLE_CONVEX_PRIMARY: 'false',
      VITE_ENABLE_CONVEX_AUTH: 'false',
      VITE_ENABLE_QA_FIXTURES: 'true',
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

async function capture() {
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
    })
    await preparePage(page)

    const screens = [
      { screen: 'setup', file: 'hydration-niveau-reglage.png', sel: 'setup' },
      { screen: 'drink', file: 'hydration-niveau-boire.png', sel: 'drink' },
    ]

    for (const { screen, file, sel } of screens) {
      const url = `http://127.0.0.1:${port}/hydration-v2-fixture?screen=${screen}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      await page.waitForSelector(`[data-hydration-v2-screen="${sel}"]`, { timeout: 30_000 })
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(artifactsDir, file), fullPage: false })
      console.log('saved', file)
    }
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
