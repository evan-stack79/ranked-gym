/**
 * Assets écran d’accueil (déconnecté) :
 * - logo calme officiel (panther-calm-crowned / D96BABC8) — overlay alpha, jamais redessiné
 * - texture textile noire mate SANS logo
 * - preuves cutout noir + blanc
 *
 * Usage : node scripts/generate-auth-welcome-assets.mjs
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, statSync } from 'node:fs'
import sharp from 'sharp'

sharp.cache(false)
sharp.concurrency(1)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const MASTER_CALM = path.join(root, 'src/assets/brand/panther-calm-crowned.png')
const SOURCE_CALM = path.join(
  root,
  'src/assets/brand/sources/D96BABC8-B830-4B67-AD61-57CBD4746DE0.jpg',
)
const PUBLIC_DIR = path.join(root, 'public')
const PROOF_DIR = path.join(root, 'scripts/screenshots/auth-welcome')

const PNG_OPTS = Object.freeze({
  compressionLevel: 9,
  adaptiveFiltering: false,
  palette: false,
  force: true,
})

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function countVisibleGreen(data) {
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 12) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (g > r + 35 && g > b + 35 && g > 90) n += 1
  }
  return n
}

async function inspectAlpha(filePath, label) {
  const img = sharp(filePath)
  const meta = await img.metadata()
  assert(meta.hasAlpha, `${label}: alpha manquant`)
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparent = 0
  let partial = 0
  let opaque = 0
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]
    if (a === 0) transparent += 1
    else if (a === 255) opaque += 1
    else partial += 1
  }
  const total = info.width * info.height
  const green = countVisibleGreen(data)
  const corners = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ].map(([x, y]) => {
    const o = (y * info.width + x) * 4
    return data[o + 3]
  })
  console.log(
    `  ${label}: ${info.width}×${info.height} t=${((transparent / total) * 100).toFixed(1)}% partial=${partial} opaque=${opaque} green=${green}`,
  )
  assert(corners.every((a) => a === 0), `${label}: coins non transparents`)
  assert(transparent / total > 0.3, `${label}: trop peu de pixels transparents (plaque opaque ?)`)
  assert(green === 0, `${label}: ${green} pixel(s) verts visibles (frange)`)
  return { data, info, transparent, green }
}

function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Texture jersey technique mate — aucune silhouette, aucun équipement. */
function buildFabric(width, height) {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n1 = hash2(x, y)
      const n2 = hash2(x + 17, y + 41)
      const n3 = hash2(Math.floor(x / 3), Math.floor(y / 2))
      const knitY = y % 7 === 0 ? 9 : y % 7 === 1 ? 4 : 0
      const knitX = x % 5 === 0 ? 6 : 0
      const twill = (x + y * 2) % 11 === 0 ? 7 : 0
      const falloff = (1 - y / height) * 11
      const grain = n1 * 10 + n2 * 6 + n3 * 5
      const v = 10 + knitY + knitX + twill + falloff + grain
      const tone = Math.max(8, Math.min(46, Math.round(v)))
      const o = (y * width + x) * 3
      data[o] = tone
      data[o + 1] = Math.max(8, tone - 1)
      data[o + 2] = Math.max(7, tone - 2)
    }
  }
  return data
}

async function writeFabric() {
  const width = 780
  const height = 920
  const raw = buildFabric(width, height)
  const base = sharp(raw, { raw: { width, height, channels: 3 } })
  const webpPath = path.join(PUBLIC_DIR, 'auth-welcome-fabric.webp')
  const avifPath = path.join(PUBLIC_DIR, 'auth-welcome-fabric.avif')
  await base.clone().webp({ quality: 78, effort: 5 }).toFile(webpPath)
  await base.clone().avif({ quality: 55, effort: 5 }).toFile(avifPath)
  const webpBytes = statSync(webpPath).size
  const avifBytes = statSync(avifPath).size
  const webpMeta = await sharp(webpPath).metadata()
  console.log(`  fabric webp ${webpBytes}B ${webpMeta.width}×${webpMeta.height} / avif ${avifBytes}B`)
  assert(webpBytes < 220_000, 'texture webp trop lourde')
  assert(avifBytes < 220_000, 'texture avif trop lourde')
  assert(webpBytes > 8_000, 'texture webp trop compressée (détail textile perdu)')
}

function neutralizeTransparentRgb(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
}

function despillAfterResize(data) {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      continue
    }
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const limit = Math.max(r, b) * 1.05
    if (g > limit) data[i + 1] = Math.round(limit)
    if (data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30 && data[i + 1] > 80 && a < 250) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

async function processedLogoPng(masterPath, size) {
  const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  neutralizeTransparentRgb(data)
  const resized = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  despillAfterResize(resized.data)
  neutralizeTransparentRgb(resized.data)
  return sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toBuffer()
}

async function writeLogo(masterPath) {
  const pngBuf = await processedLogoPng(masterPath, 400)
  const pngPath = path.join(PUBLIC_DIR, 'auth-welcome-logo.png')
  const webpPath = path.join(PUBLIC_DIR, 'auth-welcome-logo.webp')
  await sharp(pngBuf).png(PNG_OPTS).toFile(pngPath)
  await sharp(pngBuf).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(webpPath)
  await inspectAlpha(pngPath, 'public/auth-welcome-logo.png')
  await inspectAlpha(webpPath, 'public/auth-welcome-logo.webp')
}

async function writeProofs(masterPath) {
  await mkdir(PROOF_DIR, { recursive: true })
  const logo = await processedLogoPng(masterPath, 640)

  const canvas = 800
  for (const [name, bg] of [
    ['logo-cutout-black.png', { r: 0, g: 0, b: 0, alpha: 1 }],
    ['logo-cutout-white.png', { r: 255, g: 255, b: 255, alpha: 1 }],
  ]) {
    const out = path.join(PROOF_DIR, name)
    await sharp({
      create: { width: canvas, height: canvas, channels: 4, background: bg },
    })
      .composite([{ input: logo, gravity: 'centre' }])
      .png(PNG_OPTS)
      .toFile(out)
    console.log(`  proof ${path.relative(root, out)}`)
  }
}

async function main() {
  assert(existsSync(MASTER_CALM), `master calme introuvable: ${MASTER_CALM}`)
  assert(existsSync(SOURCE_CALM), `source D96 introuvable: ${SOURCE_CALM}`)
  await mkdir(PUBLIC_DIR, { recursive: true })
  await mkdir(PROOF_DIR, { recursive: true })

  console.log('Auth welcome assets — logo calme D96 overlay, texture sans logo')
  await inspectAlpha(MASTER_CALM, 'src/assets/brand/panther-calm-crowned.png')
  const srcMeta = await sharp(SOURCE_CALM).metadata()
  console.log(`  source D96 JPEG ${srcMeta.width}×${srcMeta.height} (fond vert, non intégré)`)

  await writeLogo(MASTER_CALM)
  await writeFabric()
  await writeProofs(MASTER_CALM)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
