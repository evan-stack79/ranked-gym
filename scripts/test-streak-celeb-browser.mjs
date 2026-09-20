#!/usr/bin/env node
import { chromium } from 'playwright'
import {
  applySafeAreas,
  assertCelebrationState,
  chromiumLaunchOptions,
  preparePage,
  readCelebrationState,
  startHarnessServer,
  stopHarnessServer,
  viewportHeight,
  waitForCelebrationChrome,
  widths,
} from './streak-celeb-browser-utils.mjs'

const port = 4175

async function openHarness(context, width = 375, reducedMotion = 'no-preference') {
  const page = await context.newPage()
  await preparePage(page)
  await page.setViewportSize({ width, height: viewportHeight })
  await page.emulateMedia({ reducedMotion })
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
  await applySafeAreas(page)
  await page.waitForSelector('[data-harness-ready]')
  return page
}

async function startWithNavFocus(page) {
  const home = page.locator('nav[aria-label="Navigation principale"] button').first()
  await home.focus()
  await page.evaluate(() => {
    const homeButton = document.querySelector('nav[aria-label="Navigation principale"] button')
    if (!(homeButton instanceof HTMLElement)) throw new Error('Home nav button missing')
    window.__streakFocusReturns = 0
    homeButton.addEventListener('focus', () => {
      window.__streakFocusReturns += 1
    })
    window.__streakCelebrationHarness?.start()
  })
  await page.waitForSelector('body > .streak-celeb[role="dialog"]')
  await waitForCelebrationChrome(page)
  return home
}

async function assertClosed(page, home) {
  await page.waitForSelector('.streak-celeb', { state: 'detached', timeout: 8_000 })
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden')
  const closed = await page.evaluate(() => {
    const host = document.querySelector('[data-bottom-nav-host]')
    return {
      navVisible: host instanceof HTMLElement && getComputedStyle(host).visibility !== 'hidden',
      navInteractive: host instanceof HTMLElement && !host.hasAttribute('inert'),
      shellInert: document.querySelector('[data-streak-celebration-active]') !== null,
      focusReturns: window.__streakFocusReturns,
    }
  })
  if (!closed.navVisible || !closed.navInteractive || closed.shellInert) {
    throw new Error(`Chrome not restored: ${JSON.stringify(closed)}`)
  }
  if ((await home.evaluate((node) => document.activeElement === node)) !== true) {
    throw new Error('Focus was not restored to the previous BottomNav button')
  }
  if (closed.focusReturns !== 1) {
    throw new Error(`Focus restored ${closed.focusReturns} times instead of once`)
  }
}

async function assertNavNeverFocusable(page) {
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab')
    const inNav = await page.evaluate(() => {
      const nav = document.querySelector('[data-bottom-nav-host]')
      return nav?.contains(document.activeElement) ?? false
    })
    if (inNav) throw new Error('Keyboard focus entered BottomNav during celebration')
  }
}

async function run() {
  const server = await startHarnessServer(port)
  let browser

  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 375, height: viewportHeight },
      isMobile: true,
      hasTouch: true,
    })
    for (const width of widths) {
      const page = await openHarness(context, width, 'reduce')
      const home = await startWithNavFocus(page)
      assertCelebrationState(await readCelebrationState(page), width)
      await assertNavNeverFocusable(page)
      await assertClosed(page, home)
      await page.close()
    }

    const normalPage = await openHarness(context)
    const normalHome = await startWithNavFocus(normalPage)
    assertCelebrationState(await readCelebrationState(normalPage), 375)
    await normalPage.waitForTimeout(5_400)
    if ((await normalPage.locator('.streak-celeb').count()) !== 1) {
      throw new Error('Normal animation closed before its 5700ms timing')
    }
    assertCelebrationState(await readCelebrationState(normalPage), 375)
    await assertClosed(normalPage, normalHome)
    await normalPage.close()

    const skipPage = await openHarness(context)
    const skipHome = await startWithNavFocus(skipPage)
    await skipPage.waitForTimeout(1_750)
    await skipPage.locator('.streak-celeb').click({ position: { x: 8, y: 8 } })
    await skipPage.waitForTimeout(550)
    assertCelebrationState(await readCelebrationState(skipPage), 375)
    await assertClosed(skipPage, skipHome)
    await skipPage.close()

    const unmountPage = await openHarness(context)
    const unmountHome = await startWithNavFocus(unmountPage)
    await unmountPage.waitForTimeout(250)
    await unmountPage.evaluate(() => window.__streakCelebrationHarness?.stop())
    await assertClosed(unmountPage, unmountHome)
    await unmountPage.close()
  } finally {
    await browser?.close()
    await stopHarnessServer(server)
  }
}

run().then(
  () => console.log('STREAK_BROWSER_TESTS_OK normal skip early-unmount 320/375/390 safe-area'),
  (error) => {
    console.error(error)
    process.exitCode = 1
  },
)
