#!/usr/bin/env node
/**
 * Rend la pub vidéo marketing/pub-video/ad.html image par image (1080×1920, 30 i/s)
 * puis encode en MP4 H.264 avec piste audio muette (exigée par certaines régies).
 * Prérequis : node scripts/capture-pub-video.mjs, ffmpeg dans le PATH.
 * Usage : node scripts/render-pub-video.mjs [30|15 ...]   (défaut : 30 15)
 *         node scripts/render-pub-video.mjs stills 30 3.4 14.5 24.5
 */
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const scriptsDir = fileURLToPath(new URL('.', import.meta.url))
const videoDir = join(scriptsDir, '..', 'marketing', 'pub-video')
const outDir = join(videoDir, 'out')
const fps = 30

if (!existsSync(join(videoDir, 'assets', 'clips', 'clip-home'))) {
  console.error('Ressources absentes : lance d’abord node scripts/capture-pub-video.mjs')
  process.exit(1)
}

const chromiumLaunchOptions = existsSync('/usr/local/bin/google-chrome')
  ? { executablePath: '/usr/local/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] }
  : { args: ['--no-sandbox', '--allow-file-access-from-files'] }

async function openAd(browser, cut) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`${pathToFileURL(join(videoDir, 'ad.html')).href}?cut=${cut}`, { waitUntil: 'load' })
  await page.evaluate(() => window.preloadAll())
  return page
}

const args = process.argv.slice(2)
await mkdir(outDir, { recursive: true })
const browser = await chromium.launch(chromiumLaunchOptions)
try {
  if (args[0] === 'stills') {
    const [, cut = '30', ...times] = args
    const page = await openAd(browser, cut)
    for (const t of times) {
      await page.evaluate((tt) => window.renderAt(tt), Number(t))
      const path = join(outDir, `still-${cut}s-t${t}.jpg`)
      await page.screenshot({ path, type: 'jpeg', quality: 88 })
      console.log(path)
    }
  } else {
    for (const cut of args.length ? args : ['30', '15']) {
      const page = await openAd(browser, cut)
      const duration = await page.evaluate(() => window.AD_DURATION)
      const framesDir = join(outDir, `frames-${cut}`)
      await rm(framesDir, { recursive: true, force: true })
      await mkdir(framesDir, { recursive: true })
      const total = Math.round(duration * fps)
      for (let f = 0; f < total; f++) {
        await page.evaluate((tt) => window.renderAt(tt), f / fps)
        await page.screenshot({ path: join(framesDir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 })
        if (f % 150 === 0) console.log(`${cut}s : image ${f}/${total}`)
      }
      await page.close()
      const mp4 = join(outDir, `ranked-gym-pub-${cut}s-9x16.mp4`)
      execFileSync('ffmpeg', [
        '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(framesDir, 'f%05d.jpg'),
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
        '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', mp4,
      ])
      await rm(framesDir, { recursive: true, force: true })
      console.log(mp4)
    }
  }
} finally {
  await browser.close()
}
