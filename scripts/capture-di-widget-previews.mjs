/**
 * Capture each DI widget mockup to /opt/cursor/artifacts/di-*.png
 * Linux agent has no iOS Simulator — HTML previews match the SwiftUI maquette.
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = '/opt/cursor/artifacts'
const chrome = process.env.CHROME_PATH || 'google-chrome'
const css = extractCss(await readFile(join(__dirname, 'di-widget-previews.html'), 'utf8'))

const shots = {
  'rest-compact': `<div class="compact shot-root"><div class="ring" style="--p:0.72;--ring-color:var(--red)"></div><div class="chrono-red">1:12</div></div>`,
  'rest-minimal': `<div class="minimal shot-root"><div class="ring" style="--p:0.72;--ring-color:var(--red)"></div></div>`,
  'rest-expanded': `<div class="expanded border-red shot-root"><div class="expanded-rest-grid"><div class="btn-circle btn-pause">❚❚</div><div class="col"><div class="label-gray">Série 2 sur 4 ensuite</div><div class="chrono-white chrono-xl">1:12</div><div class="label-gray">Repos · Squat</div></div><div class="btn-circle btn-stop">✕</div></div><div style="display:flex;justify-content:center;margin-top:12px"><button class="btn-pill">+15 s</button></div></div>`,
  'rest-lock': `<div class="lock border-red shot-root"><div class="col"><div class="label-gray">Série 2 sur 4 ensuite</div><div class="chrono-white chrono-xl">1:12</div><div class="label-gray">Repos · Squat</div><div class="row" style="margin-top:8px;gap:16px"><div class="btn-circle btn-pause">❚❚</div><button class="btn-pill">+15 s</button><div class="btn-circle btn-stop">✕</div></div></div></div>`,
  'session-compact': `<div class="compact shot-root"><div class="s-red">S2/4</div><div style="color:#fff;font-weight:700;font-variant-numeric:tabular-nums;font-size:14px">32:10</div></div>`,
  'session-minimal': `<div class="minimal shot-root"><div class="s-red">S2</div></div>`,
  'session-expanded': `<div class="expanded shot-root"><div class="row between" style="margin-bottom:8px"><div class="bars"><i class="on"></i><i></i><i></i><i></i></div><div class="label-gray">32:10</div></div><div class="chrono-white" style="font-size:28px;font-weight:700">80 kg × 8</div><div class="bars" style="margin:10px 0"><i class="on"></i><i></i><i></i><i></i></div><div style="display:flex;justify-content:flex-end"><button class="btn-validate">Valider</button></div></div>`,
  'session-lock': `<div class="lock shot-root"><div class="row between"><span></span><span class="label-gray">32:10</span></div><div class="chrono-white" style="font-size:28px;font-weight:700;margin:6px 0">80 kg × 8</div><div class="bars" style="margin-bottom:10px"><i class="on"></i><i></i><i></i><i></i></div><div style="display:flex;justify-content:flex-end"><button class="btn-validate">Valider</button></div></div>`,
  'steps-compact': `<div class="compact shot-root"><div class="ring" style="--p:0.45;--ring-color:var(--green)"></div><div class="green" style="font-variant-numeric:tabular-nums">3600</div></div>`,
  'steps-minimal': `<div class="minimal shot-root"><div class="ring" style="--p:0.45;--ring-color:var(--green)"></div></div>`,
  'steps-expanded': `<div class="expanded shot-root"><div class="row" style="gap:14px"><div class="ring lg" style="--p:0.45;--ring-color:var(--green)"></div><div><div class="green" style="font-size:22px">45 %</div><div class="label-gray">Objectif : 8000</div><div style="font-size:12px">Encore 4400 pas</div></div></div></div>`,
  'steps-lock': `<div class="lock shot-root"><div class="row between"><div class="row" style="gap:14px"><div class="ring lg" style="--p:0.45;--ring-color:var(--green)"></div><div><div class="green" style="font-size:22px">45 %</div><div class="label-gray">Objectif : 8000</div><div style="font-size:12px">Encore 4400 pas</div></div></div><div class="green" style="font-size:28px;font-weight:800">3600</div></div></div>`,
  'record-compact': `<div class="compact shot-root"><span class="pr">PR</span><span class="orange">+5 kg</span></div>`,
  'record-minimal': `<div class="minimal shot-root"><span class="pr">PR</span></div>`,
  'record-expanded': `<div class="expanded border-orange shot-root"><div class="row" style="gap:8px;margin-bottom:8px"><span class="pr">PR</span><span class="orange">+5 kg</span></div><div style="font-size:22px;font-weight:700">Squat 120 kg</div></div>`,
  'record-lock': `<div class="lock border-orange shot-root"><div class="row" style="gap:8px;margin-bottom:8px"><span class="pr">PR</span><span class="orange">+5 kg</span></div><div style="font-size:22px;font-weight:700">Squat 120 kg</div></div>`,
  'rank-compact': `<div class="compact shot-root"><div class="diamond"></div><span class="gold">Or</span></div>`,
  'rank-minimal': `<div class="minimal shot-root"><div class="diamond"></div></div>`,
  'rank-expanded': `<div class="expanded border-gold shot-root"><div class="row" style="gap:10px"><div class="diamond" style="width:22px;height:22px"></div><div><div class="gold" style="font-size:18px">Nouveau rang !</div><div style="font-size:12px">Or</div></div></div></div>`,
  'rank-lock': `<div class="lock border-gold shot-root"><div class="row" style="gap:10px"><div class="diamond" style="width:22px;height:22px"></div><div><div class="gold" style="font-size:18px">Nouveau rang !</div><div style="font-size:12px">Or</div></div></div></div>`,
}

await mkdir(outDir, { recursive: true })

function extractCss(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/)
  return m?.[1] ?? ''
}

async function screenshot(id, body) {
  const out = join(outDir, `di-${id}.png`)
  const tmp = join('/tmp', `di-shot-${id}.html`)
  const userData = `/tmp/chrome-di-${id}-${Date.now()}`
  await mkdir(userData, { recursive: true })
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
.shot-root{transform:scale(1.25);transform-origin:center center}
</style></head><body>${body}</body></html>`
  await writeFile(tmp, page)
  try { await writeFile(out, '') } catch { /* reset */ }

  const p = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--user-data-dir=${userData}`,
    `--screenshot=${out}`,
    '--window-size=800,500',
    `file://${tmp}`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const st = await stat(out)
      if (st.size > 1000) {
        p.kill('SIGKILL')
        console.log('wrote', out, st.size)
        return
      }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 150))
  }
  p.kill('SIGKILL')
  throw new Error(`timeout waiting for ${out}`)
}

for (const [id, body] of Object.entries(shots)) {
  await screenshot(id, body)
}
console.log('done', Object.keys(shots).length)
