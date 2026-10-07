#!/usr/bin/env node
/**
 * Diagnose sticky brand-header blur on iPhone-sized WebKit (390×844 @3x).
 * Captures header + zoomed crop, dumps computed styles, edge sharpness.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { webkit } from 'playwright'
import sharp from 'sharp'

const projectRoot = new URL('..', import.meta.url).pathname
const outDir = '/opt/cursor/artifacts/brand-header-blur'
const port = 4191
const width = 390
const height = 844
const dpr = 3

async function startAppServer(portNum) {
  const vite = join(projectRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(vite, ['--port', String(portNum), '--strictPort', '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_ENABLE_CONVEX_PRIMARY: 'false', VITE_ENABLE_CONVEX_AUTH: 'false' },
  })
  await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite timeout\n${output}`)), 60_000)
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

async function meanAbsLaplacian(pngPath) {
  const { data, info } = await sharp(pngPath).greyscale().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  let sum = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const c = data[i]
      const lap = Math.abs(4 * c - data[i - 1] - data[i + 1] - data[i - w] - data[i + w])
      sum += lap
      n++
    }
  }
  return n ? sum / n : 0
}

async function meanLuminance(pngPath) {
  const { data } = await sharp(pngPath).greyscale().raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  for (const v of data) sum += v
  return data.length ? sum / data.length : 0
}

async function captureVariant(page, label) {
  const fullPath = join(outDir, `${label}_full.png`)
  const headerPath = join(outDir, `${label}_header.png`)
  const zoomPath = join(outDir, `${label}_zoom.png`)
  const wordPath = join(outDir, `${label}_wordmark_crop.png`)
  const titlePath = join(outDir, `${label}_nutrition_title_crop.png`)
  const markPath = join(outDir, `${label}_mark_crop.png`)

  await page.screenshot({ path: fullPath, fullPage: false })

  const header = page.locator('[data-app-brand-header="1"]')
  await header.screenshot({ path: headerPath })

  const box = await header.boundingBox()
  if (box) {
    await page.screenshot({
      path: zoomPath,
      clip: {
        x: Math.max(0, box.x + box.width / 2 - 90),
        y: Math.max(0, box.y),
        width: 180,
        height: Math.min(box.height + 8, 80),
      },
    })
  }

  const word = page.locator('[data-brand-wordmark="compact"]')
  const mark = page.locator('[data-brand-mark-image="compact"], [data-brand-mark-svg="compact"]')
  const title = page.getByRole('heading', { name: 'Nutrition' }).first()

  if (await word.count()) await word.screenshot({ path: wordPath })
  if (await mark.count()) await mark.screenshot({ path: markPath })
  if (await title.count()) await title.screenshot({ path: titlePath })

  const styles = await page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null
      const cs = getComputedStyle(el)
      return {
        tag: el.tagName,
        className: el.className,
        opacity: cs.opacity,
        filter: cs.filter,
        transform: cs.transform,
        backdropFilter: cs.backdropFilter,
        webkitBackdropFilter: cs.webkitBackdropFilter,
        mixBlendMode: cs.mixBlendMode,
        willChange: cs.willChange,
        position: cs.position,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        imageRendering: cs.imageRendering,
        width: cs.width,
        height: cs.height,
      }
    }
    const headerEl = document.querySelector('[data-app-brand-header="1"]')
    const markEl =
      document.querySelector('[data-brand-mark-svg="compact"]') ||
      document.querySelector('[data-brand-mark-image="compact"]')
    const wordEl = document.querySelector('[data-brand-wordmark="compact"]')
    const target = document.querySelector('[data-cold-launch-target="compact"]')
    const brand = document.querySelector('[data-brand-mark="compact"]')
    const titleEl =
      document.querySelector('h1') ||
      [...document.querySelectorAll('h1,h2,p,div')].find((n) => n.textContent?.trim() === 'Nutrition')
    const ancestors = []
    let cur = wordEl
    while (cur && ancestors.length < 8) {
      ancestors.push({
        tag: cur.tagName,
        id: cur.id,
        className: typeof cur.className === 'string' ? cur.className : '',
        attrs: {
          'data-app-brand-header': cur.getAttribute('data-app-brand-header'),
          'data-cold-launch-target': cur.getAttribute('data-cold-launch-target'),
          'data-brand-mark': cur.getAttribute('data-brand-mark'),
        },
        ...pick(cur),
      })
      cur = cur.parentElement
    }
    const root = document.documentElement
    return {
      rootFlags: { ...root.dataset },
      header: pick(headerEl),
      target: pick(target),
      brand: pick(brand),
      mark: pick(markEl),
      word: pick(wordEl),
      title: pick(titleEl),
      ancestors,
      markNatural:
        markEl && 'naturalWidth' in markEl
          ? { naturalWidth: markEl.naturalWidth, naturalHeight: markEl.naturalHeight, currentSrc: markEl.currentSrc }
          : null,
    }
  })

  const metrics = {
    headerSharpness: await meanAbsLaplacian(headerPath),
    wordSharpness: await meanAbsLaplacian(wordPath).catch(() => null),
    titleSharpness: await meanAbsLaplacian(titlePath).catch(() => null),
    markSharpness: await meanAbsLaplacian(markPath).catch(() => null),
    wordLuma: await meanLuminance(wordPath).catch(() => null),
    titleLuma: await meanLuminance(titlePath).catch(() => null),
  }

  return { label, fullPath, headerPath, zoomPath, wordPath, titlePath, markPath, styles, metrics }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await startAppServer(port)
  let browser
  try {
    browser = await webkit.launch()
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    // WebKit + CSP upgrade-insecure-requests breaks http://127.0.0.1 module loads.
    await page.route('**/*', async (route) => {
      const request = route.request()
      if (request.resourceType() === 'document' || request.url().includes('index.html')) {
        const response = await route.fetch()
        let body = await response.text()
        body = body.replace(/upgrade-insecure-requests;?/gi, '')
        await route.fulfill({
          status: response.status(),
          headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' },
          body,
        })
        return
      }
      await route.continue()
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const apply = () => {
        const root = document.documentElement
        if (!root) return
        root.dataset.coldLaunchPlayed = '1'
        root.dataset.coldLaunchHandoff = 'done'
        root.style.setProperty('--app-safe-area-top', '47px')
        root.style.setProperty('--app-safe-area-bottom', '34px')
      }
      apply()
      document.addEventListener('DOMContentLoaded', apply)
    })

    await page.goto(`http://127.0.0.1:${port}/nutrition-fixture`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForSelector('[data-app-brand-header="1"]', { timeout: 30_000 })
    await page.waitForSelector('[data-brand-wordmark="compact"]', { timeout: 15_000 })
    await page.waitForTimeout(500)

    const baseline = await captureVariant(page, 'before')

    // Control: inject glass-bar (backdrop-filter) onto sticky header — known iOS WebKit trap
    await page.evaluate(() => {
      const header = document.querySelector('[data-app-brand-header="1"]')
      if (!header) return
      header.classList.add('glass-bar')
      header.style.backgroundColor = 'rgb(12 12 14 / 0.78)'
    })
    await page.waitForTimeout(300)
    const withGlass = await captureVariant(page, 'control_glass_bar')

    // Control: force opacity compositing on brand target (cold-launch leftover pattern)
    await page.evaluate(() => {
      const header = document.querySelector('[data-app-brand-header="1"]')
      if (header) {
        header.classList.remove('glass-bar')
        header.style.backgroundColor = ''
      }
      const target = document.querySelector('[data-cold-launch-target="compact"]')
      if (target) {
        target.style.opacity = '0.99'
        target.style.willChange = 'opacity'
      }
    })
    await page.waitForTimeout(300)
    const withOpacity = await captureVariant(page, 'control_opacity_ancestor')

    const report = {
      viewport: { width, height, dpr },
      baseline,
      withGlass: { metrics: withGlass.metrics, styles: withGlass.styles },
      withOpacity: { metrics: withOpacity.metrics, styles: withOpacity.styles },
    }
    await writeFile(join(outDir, 'diagnosis.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({
      ok: true,
      outDir,
      baselineMetrics: baseline.metrics,
      glassMetrics: withGlass.metrics,
      opacityMetrics: withOpacity.metrics,
      baselineHeader: baseline.styles.header,
      baselineWord: baseline.styles.word,
      baselineMark: baseline.styles.mark,
      markNatural: baseline.styles.markNatural,
      rootFlags: baseline.styles.rootFlags,
    }, null, 2))
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
