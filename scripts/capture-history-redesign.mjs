#!/usr/bin/env node
/**
 * Captures page Historique redesigned: iPhone 390 + Android 360, scroll + détail.
 */
import { mkdir, copyFile, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'history-redesign')
const artifactsDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'history-redesign-capture', 'vite.config.ts')
const port = 4195

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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 20_000)
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

async function assertList(page) {
  await page.waitForSelector('[data-history-redesign]')
  await page.waitForSelector('[data-history-page="list"]')
  const text = await page.locator('[data-history-redesign]').innerText()
  if (!text.includes('Historique')) throw new Error('Missing page title Historique')
  if (!text.includes('Aujourd’hui') && !text.includes("Aujourd'hui")) {
    throw new Error('Missing Aujourd’hui group')
  }
  if (!text.includes('Hier')) throw new Error('Missing Hier group')
  if (!text.includes('Squat')) throw new Error('Missing Squat title')
  if (!text.includes('Développé couché')) throw new Error('Missing Développé couché title')
  if (!text.includes('Séance musculation')) throw new Error('Missing multi-exercise title')
  if (!text.includes('Push du soir')) throw new Error('Missing custom title')
  if (/\bBiceps\b/.test(text)) throw new Error('Biceps still visible on history list')
  if (/\bPush\b/.test(text) && !text.includes('Push du soir')) {
    throw new Error('Bare Push split label visible')
  }

  const squatThumb = await page
    .locator('[data-history-row="n-squat"] [data-history-thumb]')
    .getAttribute('data-history-thumb-state')
  if (squatThumb !== 'canonical') {
    throw new Error(`squat thumb expected canonical, got ${squatThumb}`)
  }
  const squatSrc = await page.locator('[data-history-row="n-squat"] img').getAttribute('src')
  if (!/back-squat/i.test(squatSrc ?? '')) {
    throw new Error(`squat illustration unexpected: ${squatSrc}`)
  }
  const multiState = await page
    .locator('[data-history-row="n-multi"] [data-history-thumb]')
    .getAttribute('data-history-thumb-state')
  if (multiState !== 'multi') {
    throw new Error(`multi thumb expected multi, got ${multiState}`)
  }
  const unknownState = await page
    .locator('[data-history-row="n-unknown"] [data-history-thumb]')
    .getAttribute('data-history-thumb-state')
  if (unknownState !== 'fallback') {
    throw new Error(`unknown thumb expected fallback, got ${unknownState}`)
  }

  const html = await page.locator('[data-history-page="list"]').innerHTML()
  if (html.includes('glass-card')) throw new Error('glass-card still present')
  if (html.includes('#FF9F0A') || html.includes('FF9F0A')) {
    throw new Error('orange calorie color still present')
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)

    const iphone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page390 = await iphone.newPage()
    await page390.emulateMedia({ reducedMotion: 'reduce' })
    await page390.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await assertList(page390)

    const full390 = join(outDir, 'history_page_iphone_390x844.png')
    await page390.screenshot({ path: full390, fullPage: true })
    await copyFile(full390, join(artifactsDir, 'history_page_iphone_390x844.png'))

    const viewport390 = join(outDir, 'history_list_iphone_390x844.png')
    await page390.screenshot({ path: viewport390, fullPage: false })
    await copyFile(viewport390, join(artifactsDir, 'history_list_iphone_390x844.png'))
    await iphone.close()

    const android = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page360 = await android.newPage()
    await page360.emulateMedia({ reducedMotion: 'reduce' })
    await page360.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await assertList(page360)
    const androidShot = join(outDir, 'history_page_android_360x800.png')
    await page360.screenshot({ path: androidShot, fullPage: true })
    await copyFile(androidShot, join(artifactsDir, 'history_page_android_360x800.png'))
    await android.close()

    const emptyCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const emptyPage = await emptyCtx.newPage()
    await emptyPage.goto(`http://127.0.0.1:${port}/?empty=1`, { waitUntil: 'networkidle' })
    await emptyPage.waitForSelector('[data-history-page="empty"]')
    const emptyShot = join(outDir, 'history_empty_390x844.png')
    await emptyPage.screenshot({ path: emptyShot, fullPage: false })
    await copyFile(emptyShot, join(artifactsDir, 'history_empty_390x844.png'))
    await emptyCtx.close()

    const videoDir = join(outDir, 'video-scroll-detail')
    await mkdir(videoDir, { recursive: true })
    for (const stale of await readdir(videoDir)) {
      if (stale.endsWith('.webm')) {
        await unlink(join(videoDir, stale))
      }
    }
    const videoCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
    })
    const videoPage = await videoCtx.newPage()
    await videoPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    await assertList(videoPage)
    await videoPage.waitForTimeout(500)

    await videoPage.locator('[data-history-row="n-squat"]').click()
    await videoPage.waitForSelector('[data-history-detail="n-squat"]')
    await videoPage.waitForTimeout(700)
    const squatDetailText = await videoPage.locator('[data-history-detail="n-squat"]').innerText()
    if (!squatDetailText.includes('Série')) throw new Error('Squat detail missing series table')
    if (/\bBiceps\b/.test(squatDetailText)) throw new Error('Biceps in Squat detail')
    const squatHeading = await videoPage.locator('[data-history-exercise="e-squat"] p').count()
    if (squatHeading !== 0) throw new Error('Squat detail repeats exercise name')
    const smallShot = join(outDir, 'history_detail_small_squat_390x844.png')
    await videoPage.screenshot({ path: smallShot, fullPage: false })
    await copyFile(smallShot, join(artifactsDir, 'history_detail_small_squat_390x844.png'))
    await copyFile(smallShot, join(outDir, 'history_detail_squat_390x844.png'))
    await copyFile(smallShot, join(artifactsDir, 'history_detail_squat_390x844.png'))

    await videoPage.locator('.ios-sheet-panel button[aria-label="Fermer"]').click()
    await videoPage.waitForSelector('[data-history-detail="n-squat"]', { state: 'detached' })
    await videoPage.waitForTimeout(400)

    await videoPage.locator('[data-history-row="n-long"]').scrollIntoViewIfNeeded()
    await videoPage.locator('[data-history-row="n-long"]').click()
    await videoPage.waitForSelector('[data-history-detail="n-long"]')
    await videoPage.waitForTimeout(600)
    const longShot = join(outDir, 'history_detail_long_session_390x844.png')
    await videoPage.screenshot({ path: longShot, fullPage: false })
    await copyFile(longShot, join(artifactsDir, 'history_detail_long_session_390x844.png'))
    const longText = await videoPage.locator('[data-history-detail="n-long"]').innerText()
    if (!longText.includes('Développé militaire')) throw new Error('Long detail missing exercise sections')
    if (!longText.includes('Rowing barre')) throw new Error('Long detail missing last exercise')
    await videoPage.locator('[data-sheet-scroll]').evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
    await videoPage.waitForTimeout(900)

    await videoPage.locator('.ios-sheet-panel button[aria-label="Fermer"]').click()
    await videoPage.waitForSelector('[data-history-detail="n-long"]', { state: 'detached' })
    await videoPage.waitForTimeout(400)

    await videoPage.locator('[data-history-row="n-squat"]').click()
    await videoPage.waitForSelector('[data-history-detail="n-squat"]')
    await videoPage.waitForTimeout(400)
    await videoPage.locator('[data-history-delete]').click()
    await videoPage.waitForSelector('[data-history-delete-confirm]')
    await videoPage.waitForTimeout(500)
    const confirmShot = join(outDir, 'history_detail_delete_confirm_390x844.png')
    await videoPage.screenshot({ path: confirmShot, fullPage: false })
    await copyFile(confirmShot, join(artifactsDir, 'history_detail_delete_confirm_390x844.png'))
    await videoPage.locator('[data-history-confirm-cancel]').click()
    await videoPage.waitForSelector('[data-history-delete-confirm]', { state: 'detached' })
    await videoPage.waitForTimeout(400)
    await videoPage.keyboard.press('Escape')
    await videoPage.waitForSelector('[data-history-detail="n-squat"]', { state: 'detached' })
    await videoPage.waitForTimeout(500)
    await videoCtx.close()

    const videos = (await readdir(videoDir))
      .filter((f) => f.endsWith('.webm'))
      .map((f) => join(videoDir, f))
    videos.sort()
    const newest = videos.at(-1)
    if (newest) {
      await copyFile(newest, join(outDir, 'history_scroll_open_detail.webm'))
      await copyFile(newest, join(artifactsDir, 'history_scroll_open_detail.webm'))
      await copyFile(newest, join(outDir, 'history_detail_open_scroll_close_delete_confirm.webm'))
      await copyFile(newest, join(artifactsDir, 'history_detail_open_scroll_close_delete_confirm.webm'))
    }

    console.log('history redesign captures OK')
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
