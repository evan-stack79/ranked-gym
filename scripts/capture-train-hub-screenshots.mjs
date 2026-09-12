#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = join(scriptsDir, 'screenshots', 'train-hub')
const captureConfig = join(scriptsDir, 'train-hub-capture', 'vite.config.ts')
const port = 4175
const widths = [320, 375, 390]
const viewportHeight = 812
const scenarios = [
  'strength',
  'course',
  'football-training',
  'football-match',
  'other',
  'invalid',
  'empty',
  'resume',
  'rest-timer',
]

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

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startServer()
  let browser
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 375, height: viewportHeight },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })

    for (const scenario of scenarios) {
      for (const width of widths) {
        const page = await context.newPage()
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.setViewportSize({ width, height: viewportHeight })
        await page.goto(`http://127.0.0.1:${port}/?scenario=${scenario}`, {
          waitUntil: 'networkidle',
        })
        await page.waitForSelector('[data-harness-ready]')
        await page.waitForSelector('h1')

        const fixed = await page.getAttribute('[data-harness-ready]', 'data-fixed-now')
        if (!fixed?.startsWith('2026-09-04')) {
          throw new Error(`Date not fixed for ${scenario}`)
        }

        if (scenario === 'empty') {
          const choose = page.getByRole('button', { name: 'Choisir une activité' })
          await choose.click()
          await page.waitForSelector('[role="dialog"]')
          await page.keyboard.press('Escape')
          await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
        }

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          return doc.scrollWidth > doc.clientWidth + 1
        })
        if (overflow) throw new Error(`Horizontal overflow at ${scenario} ${width}px`)
        const halosHidden = await page.locator('.arena-glow').first()
          .evaluate(el => getComputedStyle(el.parentElement).display === 'none')
        if (!halosHidden) throw new Error('Train still displays inherited halos')

        await page.screenshot({
          path: join(outDir, `${scenario}-${width}px.png`),
          fullPage: true,
        })

        // Preuves après clic, avec les vrais formulaires de TrainingView.
        // Les créneaux typés ouvrent directement leur formulaire existant.
        if (scenario === 'resume' || scenario === 'strength' || scenario === 'rest-timer') {
          await page.getByRole('button', { name: scenario === 'strength' ? 'Démarrer' : 'Reprendre', exact: true }).click()
          await page.locator('#workout-notebook').waitFor()
          if (scenario === 'rest-timer') {
            await page.waitForSelector('#ranked-rest-timer-bar')
          }
        } else if (scenario === 'course') {
          await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
          await page.getByRole('button', { name: 'Enregistrer la sortie' }).waitFor()
        } else if (scenario.startsWith('football')) {
          await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
          if (scenario === 'football-match') await page.getByRole('dialog').getByRole('button', { name: 'Match', exact: true }).click()
        } else if (scenario === 'other') {
          await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
        }
        if (!['empty', 'invalid'].includes(scenario)) {
          const afterOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
          if (afterOverflow) throw new Error(`After-click overflow at ${scenario} ${width}px`)
          await page.screenshot({
            path: join(outDir, `${scenario}-after-click-${width}px.png`),
            fullPage: !(await page.getByRole('dialog').count()),
          })
        }
        await page.close()
      }
    }

    await writeFile(
      join(outDir, 'README.txt'),
      [
        'Train Hub V2 captures',
        `Scenarios: ${scenarios.join(', ')}`,
        `Widths: ${widths.join(', ')}`,
        'Fixed harness date: 2026-09-04T15:00:00',
        'Reduced motion enabled; BottomNav present via AppLayout. Halos hidden on Train only.',
        '24 hub captures + 18 after-click captures; real TrainingView, local guest callbacks.',
        'Typed planning: strength, course, football and yoga open their existing Train flow directly.',
        '',
      ].join('\n'),
    )
    console.log(`Captures written to ${outDir}`)
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
