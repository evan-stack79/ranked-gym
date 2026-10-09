#!/usr/bin/env node
/**
 * Playwright capture — 6 team animations + streak.
 * Viewport 390×844 @ ≥30fps. Each clip: interact 2–3× then 4× slow-mo pass.
 * Writes MP4 + PNG under /opt/cursor/artifacts/.
 */
import { mkdir, copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium, webkit } from 'playwright'
import { projectRoot, stopHarnessServer } from './streak-celeb-browser-utils.mjs'

const artifactsDir = '/opt/cursor/artifacts'
const port = 4222
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
      VITE_ENABLE_CALORIE_GOAL: 'false',
    },
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

async function allowHttpLocalhost(page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.resourceType() !== 'document') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const headers = { ...response.headers() }
    let body = await response.text()
    body = body.replace(/\s*upgrade-insecure-requests;?/gi, '')
    body = body.replace(
      /script-src 'self'/g,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    )
    delete headers['content-security-policy']
    delete headers['Content-Security-Policy']
    await route.fulfill({
      status: response.status(),
      headers,
      body,
      contentType: 'text/html; charset=utf-8',
    })
  })
}

function toMp4(webmPath, mp4Path) {
  execFileSync(
    '/usr/bin/ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4Path,
    ],
    { stdio: 'ignore' },
  )
}

async function setSlow(page, factor) {
  await page.evaluate((f) => {
    if (f <= 1) {
      document.documentElement.removeAttribute('data-rg-anim-slow')
    } else {
      document.documentElement.setAttribute('data-rg-anim-slow', String(f))
    }
  }, factor)
}

async function goFixture(page) {
  await page.goto(`http://127.0.0.1:${port}/animations-fixture`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.locator('[data-animations-fixture]').waitFor({ timeout: 15_000 })
  // Skip / wait out cold-launch splash so clips never open on the boot panther plate.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-cold-launch-played', '1')
    document.documentElement.setAttribute('data-cold-launch-handoff', 'done')
    document.querySelectorAll('.app-cold-launch').forEach((el) => el.remove())
  })
  await setSlow(page, 1)
  await page.waitForTimeout(400)
}

async function openTrain(page) {
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByLabel('Train').click()
  await page.locator('[data-fixture-panel="training"]').waitFor({ timeout: 5_000 })
  await page.waitForTimeout(350)
}

async function openHome(page) {
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByLabel('Accueil').click()
  await page.locator('[data-fixture-panel="home"]').waitFor({ timeout: 5_000 })
  await page.waitForTimeout(350)
}

async function captureClip(browser, name, interact) {
  const tmpDir = join(artifactsDir, `_tmp_${name}`)
  await mkdir(tmpDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    // Desktop-like input — no mobile touch markers / assistive-touch overlay on video.
    isMobile: false,
    hasTouch: false,
    reducedMotion: 'no-preference',
    // Hide OS/browser cursor so it never appears as a hand/pointer overlay.
    recordVideo: { dir: tmpDir, size: { width, height } },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await allowHttpLocalhost(page)
  await goFixture(page)
  // After navigation — hide cursor so recordings never show a hand/pointer overlay.
  await page.addStyleTag({
    content: `*, *::before, *::after { cursor: none !important; } html { caret-color: transparent; }`,
  })
  // Park the pointer off-screen — some Chromium builds still composite a hand glyph on click.
  await page.mouse.move(-100, -100)
  await interact(page)
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(artifactsDir, `${name}.png`),
    fullPage: false,
  })
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`no video for ${name}`)
  const rawPath = await video.path()
  const webm = join(artifactsDir, `${name}.webm`)
  const mp4 = join(artifactsDir, `${name}.mp4`)
  await copyFile(rawPath, webm)
  toMp4(webm, mp4)
  await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  console.log('ok', mp4)
}

async function pressHold(page, locator, holdMs = 500) {
  await locator.evaluate((el) => el.setAttribute('data-pressed', 'true'))
  await locator.dispatchEvent('pointerdown')
  await page.waitForTimeout(holdMs)
  await locator.evaluate((el) => el.removeAttribute('data-pressed'))
  await locator.dispatchEvent('pointerup')
  await page.waitForTimeout(200)
}

async function restartNavPlayBreathe(page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-bottom-nav-host] [data-rg-anim="play-breathe"]')
    if (!el) return
    el.classList.remove('rg-play-breathe')
    void el.getBoundingClientRect()
    el.classList.add('rg-play-breathe')
  })
}

async function dismissBurst(page) {
  const burst = page.locator('[data-rg-session-burst]')
  if (await burst.count()) {
    await page.locator('[data-rg-session-burst-skip]').click({ timeout: 1_500 }).catch(async () => {
      await burst.click({ timeout: 1_500 }).catch(() => undefined)
    })
  }
  await burst.waitFor({ state: 'detached', timeout: 4_000 }).catch(() => undefined)
}

async function main() {
  await mkdir(artifactsDir, { recursive: true })
  const only = new Set(
    (process.env.CAPTURE_ONLY || process.argv.slice(2).join(','))
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  const want = (name) => only.size === 0 || only.has(name)

  const server = await startAppServer(port)
  let browser
  try {
    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
    } catch {
      try {
        browser = await chromium.launch({
          executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        })
      } catch {
        browser = await webkit.launch({ headless: true })
      }
    }

    // 1 · Fin de séance
    if (want('anim-1-fin-seance')) await captureClip(browser, 'anim-1-fin-seance', async (page) => {
      await openTrain(page)
      await page.locator('[data-demo="session-complete"]').scrollIntoViewIfNeeded()
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-testid="demo-session-complete"]').click()
        const burst = page.locator('[data-rg-session-burst]')
        await burst.waitFor({ state: 'visible', timeout: 5_000 })
        await page.waitForTimeout(400)
        await dismissBurst(page)
        await page.waitForTimeout(250)
      }
      await setSlow(page, 4)
      await page.locator('[data-testid="demo-session-complete"]').click()
      await page.locator('[data-rg-session-burst]').waitFor({ state: 'visible', timeout: 5_000 })
      await page.waitForTimeout(2400)
      await dismissBurst(page)
      await setSlow(page, 1)
    })

    // 2 · Série validée — show empty check, tap, watch red bounce (×2 then 4×)
    if (want('anim-2-serie-validee'))
      await captureClip(browser, 'anim-2-serie-validee', async (page) => {
        await openTrain(page)
        await page.locator('[data-demo="set-validated"]').scrollIntoViewIfNeeded()
        await setSlow(page, 2)
        for (let i = 0; i < 3; i++) {
          await page.waitForTimeout(600)
          const empty = page.locator('[data-testid="demo-set-check"]:not([data-rg-set-check])')
          if (await empty.count()) {
            await empty.click()
          } else {
            await page.locator('[data-testid="demo-set-validate"]').click()
          }
          await page.locator('[data-rg-set-check]').waitFor({ state: 'visible', timeout: 3_000 })
          await page.waitForTimeout(1100)
        }
        await setSlow(page, 4)
        await page.locator('[data-testid="demo-set-validate"]').click()
        await page.waitForTimeout(2400)
        await setSlow(page, 1)
      })

    // 3 · Passage pages — card expand + tabs (Nutri shows real card)
    if (want('anim-3-passage-pages'))
      await captureClip(browser, 'anim-3-passage-pages', async (page) => {
        await openHome(page)
        await page.locator('[data-demo="card-expand"]').scrollIntoViewIfNeeded()
        for (let i = 0; i < 3; i++) {
          await page.locator('[data-testid="demo-expand-card"]').click()
          const expand = page.locator('[data-rg-anim="card-expand"]')
          await expand.waitFor({ state: 'visible', timeout: 3_000 })
          await page.waitForTimeout(400)
          await expand.waitFor({ state: 'detached', timeout: 3_000 }).catch(() => undefined)
          await page.waitForTimeout(200)
        }
        const nav = page.getByRole('navigation', { name: 'Navigation principale' })
        for (let i = 0; i < 2; i++) {
          await nav.getByLabel('Nutri').click()
          await page.locator('[data-fixture-panel="nutrition"]').waitFor({ timeout: 5_000 })
          // Wait out the crossfade so outgoing is cleared before next tap.
          await page.waitForTimeout(420)
          await nav.getByLabel('Train').click()
          await page.locator('[data-fixture-panel="training"]').waitFor({ timeout: 5_000 })
          await page.waitForTimeout(420)
          await nav.getByLabel('Accueil').click()
          await page.locator('[data-fixture-panel="home"]').waitFor({ timeout: 5_000 })
          await page.waitForTimeout(420)
        }
        await openHome(page)
        await page.waitForTimeout(300)
        await setSlow(page, 4)
        await page.locator('[data-demo="card-expand"]').scrollIntoViewIfNeeded()
        await page.locator('[data-testid="demo-expand-card"]').click()
        await page.locator('[data-rg-anim="card-expand"]').waitFor({ state: 'visible', timeout: 5_000 })
        await page.waitForTimeout(1500)
        await page.locator('[data-rg-anim="card-expand"]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
        await nav.getByLabel('Nutri').click()
        await page.locator('[data-fixture-panel="nutrition"]').waitFor({ timeout: 5_000 })
        await page.waitForTimeout(1400)
        await nav.getByLabel('Accueil').click()
        await page.locator('[data-fixture-panel="home"]').waitFor({ timeout: 5_000 })
        await page.waitForTimeout(1400)
        await setSlow(page, 1)
      })

    // 4 · Wave — remount, watch stagger (×2 then 4×)
    if (want('anim-4-chargement-vague'))
      await captureClip(browser, 'anim-4-chargement-vague', async (page) => {
        await openHome(page)
        await page.locator('[data-demo="wave-enter"]').scrollIntoViewIfNeeded()
        await setSlow(page, 2)
        await page.waitForTimeout(900)
        for (let i = 0; i < 3; i++) {
          await page.locator('[data-testid="demo-wave-replay"]').click()
          await page.waitForTimeout(1200)
        }
        await setSlow(page, 4)
        await page.locator('[data-testid="demo-wave-replay"]').click()
        await page.waitForTimeout(2800)
        await setSlow(page, 1)
      })

    // 5 · Living progress — hold ~30%, fill to 100% + sparks
    if (want('anim-5-barres-vivantes'))
      await captureClip(browser, 'anim-5-barres-vivantes', async (page) => {
        await openHome(page)
        await page.locator('[data-demo="living-progress"]').scrollIntoViewIfNeeded()
        await setSlow(page, 2)
        for (let i = 0; i < 3; i++) {
          await page.locator('[data-testid="demo-progress-fill"]').click()
          await page.waitForTimeout(2400)
        }
        await setSlow(page, 4)
        await page.locator('[data-testid="demo-progress-fill"]').click()
        await page.waitForTimeout(4500)
        await setSlow(page, 1)
      })

    // 6 · Buttons — long press + play glow (demo + bottom nav)
    if (want('anim-6-boutons'))
      await captureClip(browser, 'anim-6-boutons', async (page) => {
        await openHome(page)
        await page.locator('[data-demo="buttons"]').scrollIntoViewIfNeeded()
        await setSlow(page, 2)
        const btn = page.locator('[data-testid="demo-press-btn"]')
        for (let i = 0; i < 3; i++) {
          await pressHold(page, btn, 700)
          await page.locator('[data-testid="demo-play-breathe"]').click()
          await restartNavPlayBreathe(page)
          await page.waitForTimeout(2200)
        }
        await setSlow(page, 4)
        await pressHold(page, btn, 900)
        await page.locator('[data-testid="demo-play-breathe"]').click()
        await restartNavPlayBreathe(page)
        await page.waitForTimeout(8000)
        await setSlow(page, 1)
      })

    // 7 · Streak overlay (red/white palette)
    if (want('anim-7-streak-fix'))
      await captureClip(browser, 'anim-7-streak-fix', async (page) => {
        await openHome(page)
        await page.locator('[data-demo="streak-fix"]').scrollIntoViewIfNeeded()
        // Keyboard-activate + pointer parked off-screen — no click/hand glyphs.
        const trigger = page.locator('[data-testid="demo-streak"]')
        await page.mouse.move(-100, -100)
        for (let i = 0; i < 2; i++) {
          await trigger.focus()
          await page.mouse.move(-100, -100)
          await page.keyboard.press('Enter')
          const streak = page.locator('.streak-celeb')
          await streak.waitFor({ state: 'visible', timeout: 5_000 })
          await page.waitForTimeout(500)
          if (i === 1 && (await streak.count())) {
            await page.keyboard.press('Escape')
          }
          await streak.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
          await page.waitForTimeout(300)
        }
        await setSlow(page, 4)
        await trigger.focus()
        await page.mouse.move(-100, -100)
        await page.keyboard.press('Enter')
        const streak = page.locator('.streak-celeb')
        await streak.waitFor({ state: 'visible', timeout: 5_000 })
        await page.waitForTimeout(2800)
        if (await streak.count()) {
          await page.keyboard.press('Escape')
        }
        await streak.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
        await setSlow(page, 1)
      })
  } finally {
    if (browser) await browser.close()
    await stopHarnessServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
