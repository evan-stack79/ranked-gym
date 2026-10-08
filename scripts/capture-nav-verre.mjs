#!/usr/bin/env node
/**
 * Demo capture for liquid-glass floating pill (CDP screencast — preserves backdrop-filter).
 *
 * Writes:
 *   /opt/cursor/artifacts/nav_verre.mp4
 *   /opt/cursor/artifacts/nav_verre_accueil.png
 *   /opt/cursor/artifacts/nav_verre_profil.png
 */
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const OUT = '/opt/cursor/artifacts'
const FRAMES = '/tmp/nav-verre-frames'
const HARNESS = process.env.NAV_VERRE_URL ?? 'http://127.0.0.1:5174/'
const VIEWPORT = { width: 402, height: 874 }

const LABEL = {
  home: 'Accueil',
  training: 'Train',
  nutrition: 'Nutri',
  profile: 'Profil',
}

mkdirSync(OUT, { recursive: true })
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

const chromePath = existsSync('/usr/local/bin/google-chrome')
  ? '/usr/local/bin/google-chrome'
  : undefined

async function installImmediateIO(page) {
  await page.addInitScript(() => {
    class ImmediateIO {
      constructor(cb) {
        this._cb = cb
      }
      observe(el) {
        queueMicrotask(() => {
          this._cb(
            [
              {
                isIntersecting: true,
                target: el,
                intersectionRatio: 1,
                boundingClientRect: el.getBoundingClientRect(),
                intersectionRect: el.getBoundingClientRect(),
                rootBounds: null,
                time: performance.now(),
              },
            ],
            this,
          )
        })
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    window.IntersectionObserver = ImmediateIO
  })
}

async function prepareAccueil(page) {
  await page.waitForSelector('[data-harness-ready="1"]', { timeout: 30_000 })
  await page.waitForSelector('[data-accueil-hero]', { timeout: 15_000 })
  await page.waitForSelector('[data-accueil-recent-tile]', { timeout: 15_000 })
  await page.waitForSelector('[data-nav-bubble][data-ready="true"]', { timeout: 15_000 })

  // Demo-only: shrink main bottom pad so Accueil tiles can travel under the
  // floating pill (shows glass blur). Do not override Accueil tile-fill styles.
  await page.addStyleTag({
    content: `[data-app-scroll-main] { padding-bottom: 28px !important; }`,
  })

  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (main instanceof HTMLElement) main.scrollTop = 0
  })
  await page.waitForTimeout(1000)
}

async function scrollMainSlow(page, to, steps = 16, stepMs = 45) {
  await page.evaluate(
    async ({ to, steps, stepMs }) => {
      const main = document.querySelector('[data-app-scroll-main]')
      if (!(main instanceof HTMLElement)) return
      const from = main.scrollTop
      const max = Math.max(0, main.scrollHeight - main.clientHeight)
      const target = Math.min(Math.max(0, to), max)
      for (let i = 1; i <= steps; i++) {
        main.scrollTop = from + ((target - from) * i) / steps
        await new Promise((r) => setTimeout(r, stepMs))
      }
      main.scrollTop = target
    },
    { to, steps, stepMs },
  )
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=420,920'],
  })

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await installImmediateIO(page)

  await page.goto(`${HARNESS}?tab=home`, { waitUntil: 'networkidle', timeout: 60_000 })
  await prepareAccueil(page)

  const cdp = await context.newCDPSession(page)
  let frameIdx = 0
  cdp.on('Page.screencastFrame', async (ev) => {
    const i = frameIdx++
    writeFileSync(
      join(FRAMES, `f${String(i).padStart(4, '0')}.jpg`),
      Buffer.from(ev.data, 'base64'),
    )
    await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId })
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 82,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  })

  const endScroll = await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (!(main instanceof HTMLElement)) return 400
    return Math.max(0, main.scrollHeight - main.clientHeight)
  })

  // Slow scroll: hero → recent/program imagery under glass
  await scrollMainSlow(page, Math.round(endScroll * 0.62), 20, 40)
  await page.waitForTimeout(300)

  const probe = await page.evaluate(() => {
    const pill = document.querySelector('.bottom-nav-pill')
    const pr = pill.getBoundingClientRect()
    const under = [...document.querySelectorAll('[data-accueil-recent-tile], [data-accueil-program-tile]')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.bottom > pr.top + 4 && r.top < pr.bottom - 4
      }).length
    return {
      heroes: document.querySelectorAll('[data-accueil-hero]').length,
      recent: document.querySelectorAll('[data-accueil-recent-tile]').length,
      program: document.querySelectorAll('[data-accueil-program-tile]').length,
      thumbsWithImg: document.querySelectorAll('[data-accueil-recent-tile] img').length,
      underPill: under,
      glassBg: getComputedStyle(pill).backgroundColor,
      glassBlur: getComputedStyle(pill).backdropFilter || getComputedStyle(pill).webkitBackdropFilter,
    }
  })
  console.log('accueilProbe', probe)
  if (probe.heroes < 1 || probe.recent < 3 || probe.thumbsWithImg < 2 || probe.underPill < 1) {
    throw new Error(`Accueil glass demo incomplete: ${JSON.stringify(probe)}`)
  }

  await page.screenshot({ path: join(OUT, 'nav_verre_accueil.png'), fullPage: false })

  await scrollMainSlow(page, endScroll, 12, 40)
  await page.waitForTimeout(250)

  for (const tab of ['training', 'nutrition', 'profile', 'home']) {
    await page.getByRole('button', { name: LABEL[tab], exact: true }).click()
    await page.waitForSelector(`[data-nav-tab="${tab}"][aria-current="page"]`)
    await page.waitForTimeout(1200)
  }

  await page.getByRole('button', { name: LABEL.profile, exact: true }).click()
  await page.waitForSelector('[data-nav-tab="profile"][aria-current="page"]')
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (main instanceof HTMLElement) {
      main.scrollTop = Math.min(520, main.scrollHeight - main.clientHeight)
    }
  })
  await page.waitForTimeout(280)
  await page.screenshot({ path: join(OUT, 'nav_verre_profil.png'), fullPage: false })

  await cdp.send('Page.stopScreencast')
  await page.waitForTimeout(150)
  await context.close()
  await browser.close()

  console.log('frames', frameIdx)
  if (frameIdx < 40) throw new Error(`too few screencast frames: ${frameIdx}`)

  const mp4 = join(OUT, 'nav_verre.mp4')
  // Screencast cadence ~15–25fps; normalize to 30fps, keep ≤10s
  execSync(
    [
      'ffmpeg -y',
      `-framerate 18 -i ${FRAMES}/f%04d.jpg`,
      '-r 30',
      '-an',
      '-c:v libx264 -pix_fmt yuv420p -movflags +faststart',
      `-vf scale=${VIEWPORT.width}:${VIEWPORT.height}`,
      '-t 10',
      JSON.stringify(mp4),
    ].join(' '),
    { stdio: 'inherit' },
  )

  console.log(`Wrote ${mp4} (${statSync(mp4).size} bytes)`)
  console.log(`Wrote ${join(OUT, 'nav_verre_accueil.png')}`)
  console.log(`Wrote ${join(OUT, 'nav_verre_profil.png')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
