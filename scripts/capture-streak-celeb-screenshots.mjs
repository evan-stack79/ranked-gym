#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import {
  applySafeAreas,
  assertCelebrationState,
  chromiumLaunchOptions,
  preparePage,
  projectRoot,
  readCelebrationState,
  safeAreas,
  startHarnessServer,
  stopHarnessServer,
  viewportHeight,
  widths,
  waitForCelebrationChrome,
} from './streak-celeb-browser-utils.mjs'

const outDir = join(projectRoot, 'scripts', 'screenshots', 'streak-celeb')
const port = 4174

async function capture() {
  await mkdir(outDir, { recursive: true })
  const server = await startHarnessServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 375, height: viewportHeight },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    for (const width of widths) {
      const page = await context.newPage()
      await preparePage(page)
      await page.setViewportSize({ width, height: viewportHeight })
      await page.emulateMedia({ reducedMotion: 'reduce' })

      await page.goto(`http://127.0.0.1:${port}/?legacy=1`, { waitUntil: 'networkidle' })
      await applySafeAreas(page)
      await page.waitForSelector('.streak-card > .streak-celeb[role="dialog"]')
      const legacy = await page.evaluate(() => {
        const card = document.querySelector('.streak-card')
        const dialog = card?.querySelector('.streak-celeb')
        if (!(card instanceof HTMLElement) || !(dialog instanceof HTMLElement)) return null
        const cardRect = card.getBoundingClientRect()
        const dialogRect = dialog.getBoundingClientRect()
        return {
          parentIsCard: dialog.parentElement === card,
          cardOverflow: getComputedStyle(card).overflow,
          cardRadius: Number.parseFloat(getComputedStyle(card).borderRadius),
          visibleHeight: Math.max(
            0,
            Math.min(cardRect.bottom, dialogRect.bottom) - Math.max(cardRect.top, dialogRect.top),
          ),
          dialogHeight: dialogRect.height,
        }
      })
      if (!legacy?.parentIsCard || legacy.cardOverflow !== 'hidden' || legacy.cardRadius <= 0) {
        throw new Error(`Invalid styled legacy capture at ${width}px`)
      }
      if (legacy.visibleHeight >= legacy.dialogHeight) {
        throw new Error(`Legacy overlay is not clipped at ${width}px`)
      }
      await page.screenshot({ path: join(outDir, `before-${width}px.png`) })

      await page.goto(`http://127.0.0.1:${port}/?celebration=1`, { waitUntil: 'networkidle' })
      await applySafeAreas(page)
      await page.waitForSelector('body > .streak-celeb[role="dialog"]')
      await waitForCelebrationChrome(page)
      assertCelebrationState(await readCelebrationState(page), width)
      await page.screenshot({ path: join(outDir, `after-${width}px.png`) })
      await page.close()
    }

    await writeFile(
      join(outDir, 'README.txt'),
      [
        'Captures Daily Streak — vrais composants et styles React/Tailwind',
        `Viewports: ${widths.join(', ')}px × ${viewportHeight}px`,
        `Safe areas CSS explicites: top ${safeAreas.top}px, right ${safeAreas.right}px, bottom ${safeAreas.bottom}px, left ${safeAreas.left}px`,
        'before: même overlay/styles, ancien montage local dans la carte transformée et overflow-hidden',
        'after: portal direct document.body, plein 100dvw/100dvh, BottomNav invisible/inert',
        'Générer: npm run capture:streak',
      ].join('\n'),
    )
  } finally {
    await browser?.close()
    await stopHarnessServer(server)
  }
}

capture().then(
  () => console.log(`CAPTURES_OK ${outDir}`),
  (error) => {
    console.error(error)
    process.exitCode = 1
  },
)
