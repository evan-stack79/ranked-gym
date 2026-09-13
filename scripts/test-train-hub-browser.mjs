#!/usr/bin/env node
/**
 * Tests navigateur Train Hub V2 — assertions effectives (Escape, focus, reduced-motion, overflow, nav).
 * Horloge figée via le harness (indépendante de la date réelle).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptsDir, '..')
const captureConfig = join(scriptsDir, 'train-hub-capture', 'vite.config.ts')
const port = 4176
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

async function openScenario(context, scenario, width = 375) {
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height: 812 })
  await page.goto(`http://127.0.0.1:${port}/?scenario=${scenario}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-harness-ready]')
  const fixed = await page.getAttribute('[data-harness-ready]', 'data-fixed-now')
  if (!fixed?.startsWith('2026-09-04')) {
    throw new Error(`Harness date not fixed: ${fixed}`)
  }
  return page
}

const storedTraining = page => page.evaluate(() => JSON.parse(localStorage.getItem('ranked-gym:training')))

async function chooseActivity(page, label) {
  await page.getByRole('button', { name: 'Choisir une activité', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: label }).click()
}

async function chooseCatalogSport(page, name) {
  await chooseActivity(page, 'Autre sport')
  await page.getByPlaceholder('Ex. tennis, musculation, trail…').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(name, 'i') }).first().click()
}

async function auditAgendaControls(page, width, scope, failures) {
  const controls = page.locator(`${scope} [data-agenda-control]`)
  const count = await controls.count()
  if (count === 0) {
    failures.push(`agenda ${width}px ${scope}: aucun contrôle auditable`)
    return
  }

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index)
    const label = await control.evaluate((element) =>
      (element.getAttribute('aria-label') || element.textContent || element.getAttribute('data-agenda-control') || '?')
        .trim()
        .slice(0, 50),
    )
    const box = await control.boundingBox()
    if (!box || box.width < 43.5 || box.height < 43.5) {
      failures.push(
        `agenda touch ${width}px ${label}: ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'absent'}`,
      )
      continue
    }

    const keyboardReady = await control.evaluate((element) =>
      element instanceof HTMLElement && element.tabIndex >= 0 && !element.hasAttribute('disabled'),
    )
    if (!keyboardReady) failures.push(`agenda clavier ${width}px ${label}: non focusable`)

    await control.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const focus = await control.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        active: document.activeElement === element,
        focusVisible: element.matches(':focus-visible'),
        ring: style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px'),
      }
    })
    if (!focus.active || !focus.focusVisible || !focus.ring) {
      failures.push(`agenda focus ${width}px ${label}: ${JSON.stringify(focus)}`)
    }
  }
}

async function main() {
  const server = await startServer()
  let browser
  const failures = []
  try {
    browser = await chromium.launch(chromiumLaunchOptions)
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    })
    // Les composants et leurs callbacks locaux sont réels. Aucune requête métier externe.
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
    })

    // Reprendre : clic réel, égalité du brouillon, remount via BottomNav.
    for (const width of [320, 375, 390]) {
      const page = await openScenario(context, 'resume', width)
      const before = (await storedTraining(page)).routines.find(r => r.id === 'push').exercises
      await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      await page.waitForTimeout(1000)
      assert.deepEqual((await storedTraining(page)).routines.find(r => r.id === 'push').exercises, before,
        'Reprendre ne doit pas remplacer le brouillon par la séance historique')
      assert.equal(await page.getByPlaceholder('Exercice (ex. Développé couché)').first().inputValue(), 'Développé couché')
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
      assert.deepEqual((await storedTraining(page)).routines.find(r => r.id === 'push').exercises, before)
      await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Accueil', exact: true }).click()
      await page.locator('[data-other-tab]').waitFor()
      assert.equal(await page.locator('.arena-glow').first().evaluate(el => getComputedStyle(el.parentElement).display), 'block',
        'Les effets des autres onglets doivent être restaurés')
      await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Train', exact: true }).click()
      await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
      await page.waitForTimeout(1000)
      assert.deepEqual((await storedTraining(page)).routines.find(r => r.id === 'push').exercises, before)
      await page.close()
    }

    // Démarrer et routine invalide : destination réellement ouverte.
    {
      const page = await openScenario(context, 'strength')
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      assert.equal(await page.getByPlaceholder('Nom', { exact: true }).inputValue(), 'Push')
      assert.deepEqual((await storedTraining(page)).activeWorkoutDraft?.routineId, 'push')
      await page.getByRole('button', { name: /Terminer la séance/ }).click()
      await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return state.activeWorkoutDraft === null && state.workoutNotes.length > 0
      })
      await page.close()
      const invalid = await openScenario(context, 'invalid')
      await invalid.getByRole('button', { name: 'Ouvrir Train', exact: true }).click()
      await invalid.locator('#workout-notebook').waitFor()
      assert.equal((await storedTraining(invalid)).workoutNotes.length, 0)
      assert.equal((await storedTraining(invalid)).activeWorkoutDraft, null)
      await invalid.close()
    }

    // Agenda : une création UI persiste sport et famille, sans réécrire les anciens créneaux.
    {
      const page = await openScenario(context, 'empty')
      await page.getByRole('button', { name: 'Programmes', exact: true }).first().click()
      await page.getByRole('button', { name: 'Créneau', exact: true }).click()
      await page.getByLabel('Nom de la séance').fill('Course planifiée')
      await page.getByLabel('Sport').selectOption('course-a-pied')
      await page.getByRole('button', { name: 'Enregistrer + activer rappel', exact: true }).click()
      await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return state.schedule.some(item => item.title === 'Course planifiée')
      })
      const planned = (await storedTraining(page)).schedule.find(item => item.title === 'Course planifiée')
      assert.equal(planned.sportId, 'course-a-pied')
      assert.equal(planned.sessionKind, 'endurance')
      await page.close()
    }

    // Agenda : toutes les commandes signalées font au moins 44×44 px, restent
    // accessibles au clavier et exposent un focus visible, sans overflow mobile.
    for (const width of [320, 375, 390]) {
      const page = await openScenario(context, 'course', width)
      await page.getByRole('button', { name: 'Programmes', exact: true }).first().click()
      await auditAgendaControls(page, width, '[data-agenda-root]', failures)
      await page.getByRole('button', { name: 'Créneau', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await auditAgendaControls(page, width, '[role="dialog"]', failures)
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (overflow) failures.push(`agenda overflow ${width}px`)
      await page.getByRole('button', { name: 'Fermer', exact: true }).last().click()
      await page.close()
    }

    // L'édition historique ne doit écrire aucun marqueur dans la routine.
    {
      const page = await openScenario(context, 'resume')
      const before = (await storedTraining(page)).routines.find(r => r.id === 'push').exercises
      await page.getByRole('region', { name: 'Dernières séances' }).getByRole('button', { name: /^Push/ }).click()
      await page.getByRole('button', { name: 'Modifier cette séance' }).click()
      await page.getByText('Mode Édition', { exact: true }).waitFor()
      await page.waitForTimeout(1000)
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
      assert.deepEqual((await storedTraining(page)).routines.find(r => r.id === 'push').exercises, before)
      await page.getByRole('button', { name: 'Annuler l’édition' }).click()
      await page.waitForTimeout(1000)
      assert.deepEqual((await storedTraining(page)).routines.find(r => r.id === 'push').exercises, before)
      await page.close()
    }

    // Créneau course typé : démarrage direct vers le formulaire existant.
    {
      const page = await openScenario(context, 'course')
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      await page.getByRole('button', { name: 'Enregistrer la sortie' }).click()
      const notes = (await storedTraining(page)).workoutNotes
      assert(notes.some(n => n.sportId === 'course-a-pied' && n.sessionKind === 'endurance' && n.details?.distanceKm === 5))
      await page.close()
    }

    // Quatre parcours : saisie et enregistrement via les callbacks existants.
    for (const [sessionType, scenario] of [['training', 'football-training'], ['match', 'football-match']]) {
      const page = await openScenario(context, scenario)
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      if (sessionType === 'match') await page.getByRole('dialog').getByRole('button', { name: 'Match', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Valider', exact: true }).click()
      const [note] = (await storedTraining(page)).workoutNotes
      assert.equal(note.sportId, 'football')
      assert.equal(note.sessionKind, 'team')
      assert.equal(note.details.sessionType, sessionType)
      await page.close()
    }
    {
      const page = await openScenario(context, 'other')
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Valider', exact: true }).click()
      const [note] = (await storedTraining(page)).workoutNotes
      assert.equal(note.sportId, 'yoga')
      assert.equal(note.sessionKind, 'generic')
      await page.close()
    }
    for (const [name, sportId, kind] of [
      ['Yoga', 'yoga', 'generic'], ['Tennis', 'tennis', 'generic'],
      ['Natation', 'natation', 'generic'], ['Escalade', 'escalade', 'generic'],
      ['Boxe', 'boxe', 'generic'], ['Basketball', 'basketball', 'team'],
      ['Vélo', 'velo', 'endurance'],
    ]) {
      const page = await openScenario(context, 'empty')
      await chooseCatalogSport(page, name)
      if (kind === 'endurance') await page.getByRole('button', { name: 'Enregistrer la sortie' }).click()
      else await page.getByRole('dialog').getByRole('button', { name: 'Valider', exact: true }).click()
      const [note] = (await storedTraining(page)).workoutNotes
      assert.equal(note.sportId, sportId)
      assert.equal(note.sessionKind, kind)
      assert(note.durationMin > 0)
      await page.close()
    }

    // Chaînage des sheets : un seul dialogue, Tab / Shift+Tab, Escape et retour au déclencheur.
    {
      const page = await openScenario(context, 'empty')
      await chooseActivity(page, 'Autre sport')
      assert.equal(await page.getByRole('dialog').count(), 1)
      for (const key of ['Tab', 'Shift+Tab']) {
        for (let i = 0; i < 90; i++) {
          await page.keyboard.press(key)
          assert(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)), key)
        }
      }
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0)
      assert(await page.getByRole('button', { name: 'Choisir une activité', exact: true }).evaluate(el => el === document.activeElement))
      await page.close()
    }

    // CTA labels (horloge figée)
    {
      const page = await openScenario(context, 'strength')
      if (!(await page.getByRole('button', { name: 'Démarrer' }).count())) {
        failures.push('strength: missing Démarrer')
      }
      await page.close()
    }
    {
      const page = await openScenario(context, 'resume')
      if (!(await page.getByRole('button', { name: 'Reprendre' }).count())) {
        failures.push('resume: missing Reprendre')
      }
      await page.close()
    }
    {
      const page = await openScenario(context, 'invalid')
      if (!(await page.getByRole('button', { name: 'Ouvrir Train' }).count())) {
        failures.push('invalid: missing Ouvrir Train')
      }
      if (await page.getByRole('button', { name: 'Démarrer' }).count()) {
        failures.push('invalid: must not show Démarrer')
      }
      await page.close()
    }
    {
      const page = await openScenario(context, 'empty')
      const choose = page.getByRole('button', { name: 'Choisir une activité' })
      if (!(await choose.count())) failures.push('empty: missing Choisir')

      const trigger = choose.first()
      await trigger.focus()
      await trigger.click()
      await page.waitForSelector('[role="dialog"]')

      // Focus initial dans la sheet
      const focusInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')
        return Boolean(dialog && dialog.contains(document.activeElement))
      })
      if (!focusInside) failures.push('sheet: initial focus not inside dialog')

      // Focus confiné (Tab ne sort pas)
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab')
      }
      const stillInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')
        return Boolean(dialog && dialog.contains(document.activeElement))
      })
      if (!stillInside) failures.push('sheet: focus escaped dialog on Tab')

      // Escape ferme réellement
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, {
        timeout: 3000,
      }).catch(() => {
        failures.push('sheet: Escape did not close dialog')
      })

      // Focus restauré sur le déclencheur
      const restored = await page.evaluate(() => {
        const el = document.activeElement
        return el instanceof HTMLElement && /choisir une activité/i.test(el.getAttribute('aria-label') || el.textContent || '')
      })
      if (!restored) failures.push('sheet: focus not restored after close')

      await page.close()
    }

    // reduced-motion : transitions sheet/hub quasi nulles
    {
      const page = await openScenario(context, 'empty')
      await page.getByRole('button', { name: 'Choisir une activité' }).click()
      await page.waitForSelector('[role="dialog"]')
      const motion = await page.evaluate(() => {
        const panel = document.querySelector('.ios-sheet-panel')
        if (!panel) return { ok: false, reason: 'no panel' }
        const style = getComputedStyle(panel)
        const dur = style.transitionDuration || ''
        const anim = style.animationName || 'none'
        const almostInstant = dur.split(',').every((d) => {
          const ms = parseFloat(d) * (d.includes('ms') ? 1 : 1000)
          return !Number.isFinite(ms) || ms <= 1
        })
        return { ok: almostInstant && anim === 'none', dur, anim }
      })
      if (!motion.ok) {
        failures.push(`reduced-motion: sheet still animating (${motion.dur}/${motion.anim})`)
      }
      await page.close()
    }

    // Bottom nav accessible (hors modal)
    {
      const page = await openScenario(context, 'strength')
      const nav = page.locator('[data-bottom-nav-host]')
      if (!(await nav.count())) failures.push('missing bottom nav host')
      const tab = page.getByRole('button', { name: /Train|Entraînement|Home|Accueil/i }).first()
      const box = (await tab.count())
        ? await tab.boundingBox()
        : await nav.boundingBox()
      if (!box || box.height < 40) failures.push('bottom nav not interactively sized')
      // Nav remains reachable while hub (no modal) is open
      if (await page.locator('[role="dialog"]').count()) {
        failures.push('unexpected dialog open on hub')
      }
      await page.close()
    }

    // Overflow interne/document et halos sur toutes les largeurs requises.
    for (const width of [320, 375, 390]) {
    for (const scenario of ['strength', 'course', 'football-training', 'football-match', 'other', 'empty', 'resume']) {
      const page = await openScenario(context, scenario, width)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (overflow) failures.push(`${scenario} ${width}: horizontal overflow`)
      const filters = page.getByRole('tablist', { name: 'Filtrer par sport' })
      assert(await filters.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
      assert.equal(await page.locator('.arena-glow').first().evaluate(el => getComputedStyle(el.parentElement).display), 'none')
      await page.close()
    }
    }

    // aria-current sur le jour courant
    {
      const page = await openScenario(context, 'strength')
      const current = page.locator('[aria-current="date"]')
      if (!(await current.count())) failures.push('week strip: missing aria-current=date')
      const label = await current.first().getAttribute('aria-label')
      if (!label || label.length < 10) failures.push('week strip: accessible date label too short')
      await page.close()
    }

    // Minuteur de repos : hydratation depuis activeWorkoutDraft + pause chronomètre
    {
      const page = await openScenario(context, 'rest-timer')
      await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      await page.waitForSelector('#ranked-rest-timer-bar')
      const rest = (await storedTraining(page)).activeWorkoutDraft?.restTimer
      assert.equal(rest?.totalSec, 90)
      assert.equal(rest?.target.exerciseName, 'Développé couché')
      const clock = page.locator('[data-session-clock]')
      assert.ok(await clock.count(), 'chronomètre séance absent')
      await page.getByRole('button', { name: 'Mettre la séance en pause' }).click()
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return s.activeWorkoutDraft?.paused === true
      })
      const pausedAt = (await storedTraining(page)).activeWorkoutDraft?.elapsedActiveMs
      await page.waitForTimeout(1200)
      assert.equal(
        (await storedTraining(page)).activeWorkoutDraft?.elapsedActiveMs,
        pausedAt,
        'pause doit figer le chronomètre',
      )
      // Pause repos
      await page.getByRole('button', { name: 'Mettre le repos en pause' }).click()
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return s.activeWorkoutDraft?.restTimer?.paused === true
      })
      await page.close()
    }

    // Repos depuis validation réelle d’une série + reload conservant le stockage
    {
      const page = await openScenario(context, 'strength', 390)
      await page.addInitScript(() => {
        window.__rgRestLogs = 0
        window.addEventListener('ranked-gym:rest-logged', () => {
          window.__rgRestLogs = (window.__rgRestLogs || 0) + 1
        })
      })
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      await page.getByRole('button', { name: 'Valider', exact: true }).first().click()
      await page.waitForSelector('#ranked-rest-timer-bar')
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return s.activeWorkoutDraft?.restTimer?.totalSec === 90
      })
      const beforeReload = (await storedTraining(page)).activeWorkoutDraft?.restTimer
      assert.equal(beforeReload?.target.exerciseName, 'Développé couché')
      assert.equal(beforeReload?.paused, false)

      // Reload conservant le stockage
      await page.goto(`http://127.0.0.1:${port}/?scenario=strength&keepStorage=1`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-harness-ready]')
      await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      await page.waitForSelector('#ranked-rest-timer-bar')
      const afterReload = (await storedTraining(page)).activeWorkoutDraft?.restTimer
      assert.ok(afterReload, 'restTimer doit survivre au reload')
      assert.equal(afterReload.totalSec, 90)
      assert.ok(afterReload.remainingSec > 0)

      // Pause / reprise repos
      await page.getByRole('button', { name: 'Mettre le repos en pause' }).click()
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return s.activeWorkoutDraft?.restTimer?.paused === true
      })
      await page.getByRole('button', { name: 'Reprendre le repos' }).click()
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return s.activeWorkoutDraft?.restTimer?.paused === false
      })

      // Expiration : endsAt passé + reload keepStorage (listener via init script)
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        s.activeWorkoutDraft.restTimer.endsAt = Date.now() - 2000
        s.activeWorkoutDraft.restTimer.remainingSec = 0
        s.activeWorkoutDraft.restTimer.paused = false
        localStorage.setItem('ranked-gym:training', JSON.stringify(s))
      })
      await page.goto(`http://127.0.0.1:${port}/?scenario=strength&keepStorage=1`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('[data-harness-ready]')
      // État final observable + snapshot nettoyé + journalisation unique
      await page.waitForFunction(() => {
        const bar = document.querySelector('#ranked-rest-timer-bar')
        const s = JSON.parse(localStorage.getItem('ranked-gym:training'))
        return (
          s.activeWorkoutDraft?.restTimer == null &&
          Boolean(bar && /Repos OK/i.test(bar.textContent || ''))
        )
      })
      const logs = await page.evaluate(() => window.__rgRestLogs || 0)
      assert.equal(logs, 1, `journalisation unique attendue, got ${logs}`)
      await page.getByRole('button', { name: 'OK', exact: true }).click()
      await page.waitForFunction(() => {
        const bar = document.querySelector('#ranked-rest-timer-bar')
        return !bar || !/Repos OK/i.test(bar.textContent || '')
      })
      await page.close()
    }

    // Zones tactiles ≥ 44×44 px (parcours Train visible) à 320 / 375 / 390
    for (const width of [320, 375, 390]) {
      const page = await openScenario(context, 'strength', width)
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      await page.locator('#workout-notebook').waitFor()
      await page.getByRole('button', { name: 'Valider', exact: true }).first().click()
      await page.waitForSelector('#ranked-rest-timer-bar')
      const undersized = await page.evaluate(() => {
        const root = document.querySelector('[data-harness-ready]') || document.body
        const nodes = [...root.querySelectorAll('button, [role="button"], a')]
        const bad = []
        for (const el of nodes) {
          const style = getComputedStyle(el)
          if (style.display === 'none' || style.visibility === 'hidden') continue
          if (Number(style.opacity) === 0) continue
          const r = el.getBoundingClientRect()
          if (r.width < 1 || r.height < 1) continue
          // Boutons pleine largeur : hauteur ≥ 44 ; icônes : 44×44
          if (r.height < 44 - 0.5 || (r.width < 44 - 0.5 && r.width < r.height * 0.9)) {
            const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)
            bad.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
          }
        }
        return bad
      })
      if (undersized.length) {
        failures.push(
          `touch ${width}px: ${undersized.map((b) => `${b.label || '?'} ${b.w}x${b.h}`).join('; ')}`,
        )
      }
      // reduced-motion : transitions SVG minuteur neutres
      const svgMotion = await page.evaluate(() => {
        const circle = document.querySelector('#ranked-rest-timer-bar circle:nth-of-type(2)')
        if (!circle) return { ok: false, reason: 'no circle' }
        const tr = getComputedStyle(circle).transitionDuration || ''
        const almostInstant = tr.split(',').every((d) => {
          const ms = parseFloat(d) * (d.includes('ms') ? 1 : 1000)
          return !Number.isFinite(ms) || ms <= 1
        })
        return { ok: almostInstant, tr }
      })
      if (!svgMotion.ok) {
        failures.push(`reduced-motion rest SVG ${width}: ${svgMotion.tr}`)
      }
      await page.close()
    }

    // Pas de 0 kg / NaN / énergie fictive sur parcours non musculaires
    for (const scenario of ['course', 'football-training', 'other']) {
      const page = await openScenario(context, scenario)
      const bodyText = await page.locator('[data-harness-ready]').innerText()
      if (/\b0\s*kg\b/i.test(bodyText)) failures.push(`${scenario}: affiche 0 kg`)
      if (/\bNaN\b/.test(bodyText)) failures.push(`${scenario}: affiche NaN`)
      if (/\bundefined\b/i.test(bodyText)) failures.push(`${scenario}: affiche undefined`)
      await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
      if (scenario === 'football-training') {
        // sheet type déjà entraînement via créneau
      }
      await page.waitForTimeout(400)
      const after = await page.locator('body').innerText()
      if (/\b0\s*kg\b/i.test(after)) failures.push(`${scenario} after: affiche 0 kg`)
      if (/\bNaN\b/.test(after)) failures.push(`${scenario} after: NaN`)
      await page.close()
    }

    if (failures.length) {
      console.error('FAIL\n' + failures.join('\n'))
      process.exitCode = 1
    } else {
      console.log('OK Train : planning typé force/course/football/autre, brouillon actif explicite, reprise identique après remount, routine invalide protégée, édition isolée, catalogue, clavier, reduced-motion, halos, overflow, rest Valider+reload, touch Train + Agenda 44px/focus 320/375/390.')
    }
  } finally {
    if (browser) await browser.close()
    await stopServer(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
