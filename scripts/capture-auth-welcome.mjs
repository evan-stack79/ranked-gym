#!/usr/bin/env node
/**
 * Preuves visuelles écran d’accueil déconnecté + skip session.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'auth-welcome')
const port = 4188
const origin = `http://127.0.0.1:${port}`
const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] }

const SAFE = {
  island: ':root{--app-safe-area-top:59px;--app-safe-area-bottom:34px;--app-safe-area-left:0px;--app-safe-area-right:0px;}',
  se: ':root{--app-safe-area-top:20px;--app-safe-area-bottom:16px;}',
  android: ':root{--app-safe-area-top:24px;--app-safe-area-bottom:20px;}',
}

async function startServer(command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`server timeout\n${output}`)), 60_000)
    const onData = (chunk) => {
      output += chunk.toString()
      if (output.includes('Local:') || output.includes('localhost:')) {
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
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((r) => {
    const t = setTimeout(r, 2000)
    server.once('exit', () => {
      clearTimeout(t)
      r()
    })
  })
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name), fullPage: false })
  console.log('  wrote', name)
}

async function withPage(browser, viewport, css, fn) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: viewport.width <= 430,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    document.documentElement.dataset.coldLaunchPlayed = '1'
    document.documentElement.dataset.coldLaunchHandoff = 'done'
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (css) {
    await page.addInitScript((styles) => {
      window.__RG_WELCOME_SAFE__ = styles
    }, css)
    page.on('domcontentloaded', async () => {
      await page.addStyleTag({ content: css }).catch(() => undefined)
    })
  }
  try {
    await fn(page)
  } finally {
    await context.close()
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const usePreview = process.argv.includes('--preview')
  const server = usePreview
    ? await startServer(join(projectRoot, 'node_modules', '.bin', 'vite'), [
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ])
    : await startServer(join(projectRoot, 'node_modules', '.bin', 'vite'), [
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ])

  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions })
  try {
    await withPage(browser, { width: 393, height: 852 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: SAFE.island })
      await page.waitForSelector('[data-welcome-screen]')
      await shot(page, 'welcome-iphone-dynamic-island-393.png')
      await page.click('[data-welcome-cta]')
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(400)
      await shot(page, 'welcome-login-sheet-393.png')
      await page.locator('[role="dialog"] button[aria-label="Fermer"]').click()
      await page.waitForTimeout(350)
      await shot(page, 'welcome-after-dismiss-393.png')
    })

    await withPage(browser, { width: 320, height: 568 }, SAFE.se, async (page) => {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: SAFE.se })
      await page.waitForSelector('[data-welcome-screen]')
      await shot(page, 'welcome-iphone-se-320.png')
    })

    await withPage(browser, { width: 360, height: 800 }, SAFE.android, async (page) => {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: SAFE.android })
      await page.waitForSelector('[data-welcome-screen]')
      await shot(page, 'welcome-android-narrow-360.png')
    })

    await withPage(browser, { width: 844, height: 390 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: SAFE.island })
      await page.waitForSelector('[data-welcome-screen]')
      await shot(page, 'welcome-landscape-844x390.png')
    })

    await withPage(browser, { width: 393, height: 852 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/auth-welcome-sheet-fixture?error=credentials`, {
        waitUntil: 'networkidle',
      })
      await page.addStyleTag({ content: SAFE.island })
      await page.waitForSelector('[data-auth-error="1"]')
      await shot(page, 'welcome-bad-credentials-393.png')
    })

    await withPage(browser, { width: 393, height: 852 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/auth-welcome-sheet-fixture`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: SAFE.island })
      await page.waitForSelector('[role="dialog"]')
      await page.getByText('Mot de passe oublié ?').click()
      await page.waitForTimeout(250)
      await shot(page, 'welcome-forgot-password-393.png')
    })

    await withPage(browser, { width: 393, height: 852 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/legal/conditions`, { waitUntil: 'networkidle' })
      await shot(page, 'legal-conditions-393.png')
      await page.goto(`${origin}/legal/confidentialite`, { waitUntil: 'networkidle' })
      await shot(page, 'legal-privacy-393.png')
    })

    await withPage(browser, { width: 393, height: 852 }, SAFE.island, async (page) => {
      await page.goto(`${origin}/auth-welcome-logged-in-fixture?restoreMs=200`, {
        waitUntil: 'networkidle',
      })
      await page.addStyleTag({ content: SAFE.island })
      await page.waitForFunction(() => !document.querySelector('[data-session-restore]'), {
        timeout: 4000,
      })
      const welcome = await page.$('[data-welcome-screen]')
      if (welcome) throw new Error('logged-in fixture showed welcome')
      await shot(page, 'logged-in-skips-welcome-393.png')
    })

    const videoContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
    })
    const disconnectedPage = await videoContext.newPage()
    await disconnectedPage.emulateMedia({ reducedMotion: 'reduce' })
    await disconnectedPage.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await disconnectedPage.waitForSelector('[data-welcome-screen]', { timeout: 8000 })
    await disconnectedPage.waitForTimeout(400)
    await disconnectedPage.click('[data-welcome-cta]')
    await disconnectedPage.waitForSelector('[role="dialog"]')
    await disconnectedPage.waitForTimeout(800)
    const disconnectedVideo = await disconnectedPage.video()
    await disconnectedPage.close()
    const disconnectedPath = await disconnectedVideo?.path()
    await videoContext.close()
    if (disconnectedPath) {
      const { rename } = await import('node:fs/promises')
      await rename(disconnectedPath, join(outDir, 'disconnected-boot-open-sheet.webm'))
      console.log('  wrote disconnected-boot-open-sheet.webm')
    }

    const loggedContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
    })
    const loggedPage = await loggedContext.newPage()
    await loggedPage.emulateMedia({ reducedMotion: 'reduce' })
    await loggedPage.addInitScript(() => {
      document.documentElement.dataset.coldLaunchPlayed = '1'
      document.documentElement.dataset.coldLaunchHandoff = 'done'
    })
    await loggedPage.goto(`${origin}/auth-welcome-logged-in-fixture?restoreMs=700`, {
      waitUntil: 'domcontentloaded',
    })
    await loggedPage.waitForFunction(() => !document.querySelector('[data-session-restore]'), {
      timeout: 5000,
    })
    await loggedPage.waitForTimeout(900)
    const stillWelcome = await loggedPage.$('[data-welcome-screen]')
    if (stillWelcome) throw new Error('logged-in video showed welcome')
    const loggedVideo = await loggedPage.video()
    await loggedPage.close()
    const loggedPath = await loggedVideo?.path()
    await loggedContext.close()
    if (loggedPath) {
      const { rename } = await import('node:fs/promises')
      await rename(loggedPath, join(outDir, 'logged-in-skips-welcome.webm'))
      console.log('  wrote logged-in-skips-welcome.webm')
    }

    const report = [
      'Auth welcome proofs',
      `origin=${origin} mode=${usePreview ? 'preview' : 'dev'}`,
      '1 disconnected: welcome-iphone-dynamic-island-393.png',
      '2 already logged in: logged-in-skips-welcome-393.png + video',
      '3 expired session: decideAuthRestore unit + welcome path',
      '4 slow restore: AppBootScreen silent + fixture restoreMs',
      '5 offline local session: decideAuthRestore local-cache',
      '6 Se connecter: welcome-login-sheet-393.png + disconnected video',
      '7 dismiss sheet: welcome-after-dismiss-393.png',
      '8 bad credentials: welcome-bad-credentials-393.png',
      '9 service down: friendlyAuthError AUTH_SERVICE_UNAVAILABLE',
      '10 forgot password: welcome-forgot-password-393.png',
      '11 Dynamic Island: welcome-iphone-dynamic-island-393.png',
      '12 small iPhone: welcome-iphone-se-320.png',
      '13 narrow Android: welcome-android-narrow-360.png',
      '14 orientation/safe areas: welcome-landscape-844x390.png',
      '15 local prod build: run with --preview after npm run build',
      '16 full page refresh: goto / shows welcome when disconnected',
      '17 no green fringe: logo-cutout-black.png / white.png',
      '18 linux/cloudflare-style build: dist hashed assets + alpha logo',
    ].join('\n')
    await writeFile(join(outDir, 'report.txt'), `${report}\n`, 'utf8')
    console.log(`Captures written to ${outDir}`)
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
