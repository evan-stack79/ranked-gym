#!/usr/bin/env node
/**
 * Preuves qualité overlay (directeur technique) — UNE seule séance DÉVELOPPÉ COUCHÉ.
 * - Capture 390 à 01:30
 * - Vidéo temps réel charge→reps→Effort 8→01:30 (décompte 2 s+)
 * - Vidéo même séance : +15 s (label 1 min 45), lock/retour, refresh (endsAt continue), Reprendre
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, renameSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptsDir, '..')
const outDir = '/opt/cursor/artifacts'
const captureConfig = join(scriptsDir, 'workout-immersive-capture', 'vite.config.ts')
const port = 4197
const BASE = `http://127.0.0.1:${port}/?autoValidate=1&clear=1`

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
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 25_000)
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

/** Saisie visible caractère par caractère (temps réel). */
async function typeSlow(page, aria, value) {
  const input = page.locator(`input[aria-label="${aria}"]`)
  await input.click()
  await page.waitForTimeout(200)
  await input.fill('')
  await page.waitForTimeout(150)
  await input.pressSequentially(String(value), { delay: 180 })
  await page.waitForTimeout(250)
}

function toMp4(webm, mp4) {
  spawnSync(
    'ffmpeg',
    ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
    { stdio: 'ignore' },
  )
}

function takeWebm(dir, dest) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.webm'))
  if (!files.length) throw new Error(`No webm in ${dir}`)
  renameSync(join(dir, files[0]), dest)
  return dest
}

async function assertName(page) {
  const name = await page.locator('[data-exercise-name]').getAttribute('data-exercise-name')
  const h1 = await page.locator('[data-immersive-session] h1').innerText()
  if (name !== 'DÉVELOPPÉ COUCHÉ' || !h1.includes('DÉVELOPPÉ COUCHÉ')) {
    throw new Error(`Expected DÉVELOPPÉ COUCHÉ, got name=${name} h1=${h1}`)
  }
}

/** Série 1 validée 80·6·8 + série 2 active — preuve anti-perte après Reprendre. */
async function assertValidatedSetIntact(page) {
  const snap = await page.evaluate(() => {
    const raw = sessionStorage.getItem('ranked-gym:capture-session-v1')
    const sets = raw ? JSON.parse(raw).exercises?.[0]?.sets : null
    const rows = [...document.querySelectorAll('[data-set-row]')].map((r) =>
      r.getAttribute('data-set-row'),
    )
    const body = document.querySelector('[data-immersive-session]')?.textContent ?? ''
    return { sets, rows, has810: body.includes('8/10'), hasRpe: body.includes('RPE') }
  })
  const s0 = snap.sets?.[0]
  if (!s0 || s0.weightKg !== 80 || s0.reps !== 6 || s0.rpe !== 8 || s0.done !== true) {
    throw new Error(`Série 1 lost after Reprendre: ${JSON.stringify(s0)}`)
  }
  if (snap.rows[0] !== 'done' || snap.rows[1] !== 'active') {
    throw new Error(`Expected done/active rows, got ${JSON.stringify(snap.rows)}`)
  }
  if (!snap.has810) throw new Error('Missing 8/10 after Reprendre')
  if (snap.hasRpe) throw new Error('RPE leaked into UI')
  return snap
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const log = []
  const server = await startServer()
  const browser = await chromium.launch(chromiumLaunchOptions)

  try {
    // ——— Capture 01:30 (horloge figée uniquement pour la photo) ———
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      await page.clock.install({ time: new Date('2026-09-24T12:00:00.000Z') })
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-harness-ready]')
      await assertName(page)
      await typeSlow(page, 'Série 1 poids', '80')
      await typeSlow(page, 'Série 1 reps', '6')
      if ((await page.locator('[data-recovery-timer]').count()) !== 0) {
        throw new Error('Timer appeared before Effort')
      }
      await typeSlow(page, 'Série 1 effort facultatif', '8')
      await page.waitForSelector('[data-recovery-remaining]')
      const clock = await page.locator('[data-recovery-remaining]').innerText()
      if (clock !== '01:30') throw new Error(`Expected 01:30 got ${clock}`)
      const label = await page.locator('[data-recovery-label]').innerText()
      if (label !== 'Récupération · 1 min 30') throw new Error(`label ${label}`)
      const body = await page.locator('[data-immersive-session]').innerText()
      if (/Série \d+ terminée/.test(body)) throw new Error('bandeau still present')
      const shot = join(outDir, 'recovery-overlay-01-30-mobile-390.png')
      await page.screenshot({ path: shot, fullPage: false })
      log.push(`capture=${shot}`)
      log.push(`clock=${clock}`)
      await context.close()
    }

    // ——— Vidéo temps réel flux (8–15 s) ———
    {
      const tmp = join(outDir, 'flow-realtime-tmp')
      rmSync(tmp, { recursive: true, force: true })
      await mkdir(tmp, { recursive: true })
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: tmp, size: { width: 390, height: 844 } },
      })
      const page = await context.newPage()
      // Pas de clock.install — temps réel
      // effortHoldMs=500 : délai harness-only — chiffre « 8 » visible avant overlay
      await page.goto(
        `http://127.0.0.1:${port}/?autoValidate=1&clear=1&effortHoldMs=500`,
        { waitUntil: 'networkidle' },
      )
      await page.waitForSelector('[data-harness-ready]')
      await assertName(page)
      await page.waitForTimeout(500)
      await typeSlow(page, 'Série 1 poids', '80')
      await page.waitForTimeout(400)
      await typeSlow(page, 'Série 1 reps', '6')
      await page.waitForTimeout(400)
      if ((await page.locator('[data-recovery-timer]').count()) !== 0) {
        throw new Error('Early validate before Effort in realtime video')
      }
      await typeSlow(page, 'Série 1 effort facultatif', '8')
      // Frame(s) avec « 8 » / 8/10 avant l’overlay (hold harness)
      await page.waitForTimeout(350)
      const effortVisible = await page.evaluate(() => {
        const body = document.querySelector('[data-immersive-session]')?.textContent ?? ''
        const input = document.querySelector(
          'input[aria-label="Série 1 effort facultatif"]',
        )
        return body.includes('8/10') || input?.value === '8' || body.includes('8')
      })
      if (!effortVisible) throw new Error('Effort 8 not visible before overlay')
      log.push('effort_8_visible_before_overlay=1')
      await page.waitForSelector('[data-recovery-remaining]')
      const t0 = await page.locator('[data-recovery-remaining]').innerText()
      if (t0 !== '01:30' && t0 !== '01:29') {
        // Allow 1s tick if typing was slow
        if (t0 !== '01:28') throw new Error(`Expected ~01:30 got ${t0}`)
      }
      // Laisser décompter 2+ secondes visibles
      await page.waitForTimeout(2500)
      const t1 = await page.locator('[data-recovery-remaining]').innerText()
      log.push(`flow_start=${t0} flow_after_2s=${t1}`)
      await context.close()
      const webm = takeWebm(tmp, join(outDir, 'charge-reps-effort-realtime.webm'))
      const mp4 = join(outDir, 'charge_reps_effort_realtime.mp4')
      toMp4(webm, mp4)
      log.push(`flow_video=${mp4}`)
    }

    // ——— Même séance : +15s, lock, refresh endsAt, Reprendre ———
    {
      const tmp = join(outDir, 'same-session-actions-tmp')
      rmSync(tmp, { recursive: true, force: true })
      await mkdir(tmp, { recursive: true })
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: tmp, size: { width: 390, height: 844 } },
      })
      const page = await context.newPage()
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-harness-ready]')
      await assertName(page)
      await typeSlow(page, 'Série 1 poids', '80')
      await typeSlow(page, 'Série 1 reps', '6')
      await typeSlow(page, 'Série 1 effort facultatif', '8')
      await page.waitForSelector('[data-recovery-remaining]')
      await page.waitForTimeout(400)

      // +15 s — ne doit PAS écraser la séance persistée (bug clear=1 re-render)
      await page.locator('[data-recovery-add-15]').click()
      await page.waitForTimeout(400)
      const afterPlus = await page.locator('[data-recovery-remaining]').innerText()
      const labelPlus = await page.locator('[data-recovery-label]').innerText()
      // ~01:45 (allow 01:44 if a second ticked)
      if (!/^01:4[4-5]$/.test(afterPlus)) throw new Error(`+15 clock ${afterPlus}`)
      if (labelPlus !== 'Récupération · 1 min 45') {
        throw new Error(`+15 label expected 1 min 45 got ${labelPlus}`)
      }
      const afterPlusSets = await page.evaluate(() => {
        const raw = sessionStorage.getItem('ranked-gym:capture-session-v1')
        return raw ? JSON.parse(raw).exercises?.[0]?.sets?.[0] : null
      })
      if (
        !afterPlusSets ||
        afterPlusSets.rpe !== 8 ||
        afterPlusSets.done !== true ||
        afterPlusSets.weightKg !== 80
      ) {
        throw new Error(`+15 wiped session storage: ${JSON.stringify(afterPlusSets)}`)
      }
      await page.screenshot({
        path: join(outDir, 'recovery-label-plus15-390.png'),
        fullPage: false,
      })
      log.push(`plus15_clock=${afterPlus} plus15_label=${labelPlus}`)

      const beforeLock = await page.locator('[data-recovery-remaining]').innerText()
      // Verrouillage / arrière-plan : visibility hidden puis retour + attendre ~3 s
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForTimeout(3000)
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForTimeout(500)
      const afterLock = await page.locator('[data-recovery-remaining]').innerText()
      await assertName(page)
      log.push(`lock_before=${beforeLock} lock_after=${afterLock}`)
      // endsAt : le temps a continué (~3 s de moins)
      const toSec = (mmss) => {
        const [m, s] = mmss.split(':').map(Number)
        return m * 60 + s
      }
      if (toSec(afterLock) > toSec(beforeLock)) {
        throw new Error('Timer went backwards after lock')
      }
      if (toSec(beforeLock) - toSec(afterLock) < 2) {
        throw new Error(`Expected ~3s elapsed after lock, ${beforeLock}→${afterLock}`)
      }
      await page.screenshot({
        path: join(outDir, 'recovery-after-lock-return-390.png'),
        fullPage: false,
      })

      // Actualisation MÊME séance (pas clear=1) — endsAt continue
      const beforeRefresh = await page.locator('[data-recovery-remaining]').innerText()
      const setsBefore = await page.locator('[data-set-row]').count()
      await page.goto(`http://127.0.0.1:${port}/?autoValidate=1`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-harness-ready]')
      await page.waitForSelector('[data-recovery-timer]', { timeout: 8000 })
      await assertName(page)
      const afterRefresh = await page.locator('[data-recovery-remaining]').innerText()
      const setsAfter = await page.locator('[data-set-row]').count()
      const h1 = await page.locator('[data-immersive-session] h1').innerText()
      if (!h1.includes('DÉVELOPPÉ COUCHÉ')) throw new Error(`refresh title ${h1}`)
      if (setsAfter !== setsBefore) {
        throw new Error(`sets changed ${setsBefore}→${setsAfter}`)
      }
      // Continuité endsAt : pas de reset à 01:30
      if (afterRefresh === '01:30') {
        throw new Error('Timer reset to 01:30 on refresh — endsAt not restored')
      }
      if (Math.abs(toSec(afterRefresh) - toSec(beforeRefresh)) > 5) {
        throw new Error(`refresh jump ${beforeRefresh}→${afterRefresh}`)
      }
      await page.screenshot({
        path: join(outDir, 'recovery-after-refresh-same-session-390.png'),
        fullPage: false,
      })
      log.push(
        `refresh_before=${beforeRefresh} refresh_after=${afterRefresh} sets=${setsAfter}`,
      )

      // Reprendre — série 1 intacte, série 2 active
      await page.locator('[data-recovery-resume]').click()
      await page.waitForTimeout(500)
      if ((await page.locator('[data-recovery-timer]').count()) !== 0) {
        throw new Error('Reprendre failed')
      }
      await assertName(page)
      const intact = await assertValidatedSetIntact(page)
      log.push(`reprendre=ok set1=${JSON.stringify(intact.sets[0])} rows=${intact.rows.join(',')}`)
      await page.screenshot({
        path: join(outDir, 'after-reprendre-set1-intact-390.png'),
        fullPage: false,
      })
      // Laisse la frame finale visible sur la série 1 cochée
      await page.waitForTimeout(1200)

      await context.close()
      const webm = takeWebm(tmp, join(outDir, 'same-session-plus15-lock-refresh-reprendre.webm'))
      const mp4 = join(outDir, 'same_session_plus15_lock_refresh_reprendre.mp4')
      toMp4(webm, mp4)
      log.push(`actions_video=${mp4}`)
    }

    const report = join(outDir, 'recovery-qa-fix-evidence.log')
    await writeFile(report, log.join('\n') + '\n')
    console.log(log.join('\n'))
    console.log(`Wrote ${report}`)
  } finally {
    await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
