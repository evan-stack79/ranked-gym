#!/usr/bin/env node
/**
 * Capture séquence scroll marque Ranked Gym (header en flux, nav fixe).
 * A) top — marque visible
 * B) scrolled — marque hors écran
 * C) back top — marque revenue
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  applySafeAreas,
  chromiumLaunchOptions,
  preparePage,
  projectRoot,
  stopHarnessServer,
} from './streak-celeb-browser-utils.mjs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'brand-scroll')
const artifactsDir = '/opt/cursor/artifacts'
const port = 4193
const width = 390
const height = 844

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_ENABLE_CONVEX_PRIMARY: 'false', VITE_ENABLE_CONVEX_AUTH: 'false' },
  })

  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 45_000)
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

async function brandHeaderState(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    const header = document.querySelector('[data-app-brand-header="1"]')
    const nav = document.querySelector('[data-bottom-nav-host], nav[aria-label="Navigation principale"]')
    if (!(main instanceof HTMLElement) || !(header instanceof HTMLElement)) {
      return { ok: false }
    }
    const mainRect = main.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const visible =
      headerRect.bottom > mainRect.top + 1 && headerRect.top < mainRect.bottom - 1
    const navEl =
      nav instanceof HTMLElement
        ? nav.querySelector('nav') instanceof HTMLElement
          ? nav.querySelector('nav')
          : nav
        : null
    const navFixed =
      navEl instanceof HTMLElement
        ? getComputedStyle(navEl).position === 'fixed' ||
          (navEl.parentElement && getComputedStyle(navEl.parentElement).position === 'fixed')
        : false
    const sticky = getComputedStyle(header).position
    return {
      ok: true,
      headerVisible: visible,
      headerTop: headerRect.top,
      headerBottom: headerRect.bottom,
      scrollTop: main.scrollTop,
      position: sticky,
      navFixed,
    }
  })
}

async function captureSequence(page, prefix) {
  await page.waitForSelector('[data-app-brand-header="1"]')
  await page.waitForTimeout(400)

  const a = await brandHeaderState(page)
  if (!a.ok || !a.headerVisible || a.position === 'sticky' || a.position === 'fixed') {
    throw new Error(`A top failed: ${JSON.stringify(a)}`)
  }
  await page.screenshot({
    path: join(artifactsDir, `${prefix}_A_top_brand_visible.png`),
    fullPage: false,
  })
  await page.screenshot({
    path: join(outDir, `${prefix}_A_top_brand_visible.png`),
    fullPage: false,
  })

  await page.evaluate(() => {
    const main = document.querySelector('main')
    if (main) {
      main.scrollTo({ top: Math.max(420, Math.min(560, main.scrollHeight - main.clientHeight)) })
    }
  })
  await page.waitForTimeout(350)
  const b = await brandHeaderState(page)
  if (!b.ok || b.headerVisible) {
    throw new Error(`B scrolled failed (brand still visible): ${JSON.stringify(b)}`)
  }
  if (!b.navFixed) {
    throw new Error(`B scrolled: bottom nav not fixed: ${JSON.stringify(b)}`)
  }
  await page.screenshot({
    path: join(artifactsDir, `${prefix}_B_scrolled_brand_gone.png`),
    fullPage: false,
  })
  await page.screenshot({
    path: join(outDir, `${prefix}_B_scrolled_brand_gone.png`),
    fullPage: false,
  })

  await page.evaluate(() => {
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  })
  await page.waitForTimeout(350)
  const c = await brandHeaderState(page)
  if (!c.ok || !c.headerVisible) {
    throw new Error(`C back top failed: ${JSON.stringify(c)}`)
  }
  await page.screenshot({
    path: join(artifactsDir, `${prefix}_C_back_top_brand_visible.png`),
    fullPage: false,
  })
  await page.screenshot({
    path: join(outDir, `${prefix}_C_back_top_brand_visible.png`),
    fullPage: false,
  })

  return { a, b, c }
}

async function capture() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startAppServer(port)
  let browser

  try {
    browser = await chromium.launch(
      existsSync('/usr/local/bin/google-chrome')
        ? chromiumLaunchOptions
        : {},
    )
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await preparePage(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await applySafeAreas(page)
    await page.waitForSelector('text=Nutrition')
    const nutrition = await captureSequence(page, 'nutrition_brand_scroll')

    await page.goto(`http://127.0.0.1:${port}/accueil-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await applySafeAreas(page)
    await page.waitForSelector('[data-app-brand-header="1"]')
    const accueil = await captureSequence(page, 'accueil_brand_scroll')

    console.log(
      JSON.stringify({
        ok: true,
        viewport: { width, height },
        nutrition,
        accueil,
        outDir,
      }),
    )
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
