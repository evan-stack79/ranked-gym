/**
 * Détoure les logos propriétaires Ranked Gym (fonds verts) → PNG transparents.
 * Sources UUID : jamais modifiées. Copies préservées sous src/assets/brand/sources/.
 *
 * Mapping :
 * - D96BABC8… → panther-calm-crowned.png (principal / splash calme)
 * - 491568B1… → panther-launch-roaring.png (phase expressive — lancement uniquement)
 * - A5A15C62… → panther-icon-opaque.png (PWA / native / store)
 *
 * IMPORTANT : ne jamais écraser panther-roaring.png (Daily Streak / HEAD).
 *
 * Pipeline anti-halo :
 * 1) chroma key
 * 2) neutraliser RGB des pixels transparents (avant tout resize)
 * 3) despill après chaque resize
 * 4) contrôle automatisé des pixels verts visibles
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import sharp from 'sharp'

sharp.cache(false)
sharp.concurrency(1)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const brandDir = path.join(root, 'src/assets/brand')
const sourcesDir = path.join(brandDir, 'sources')

const CANDIDATE_ROOTS = [
  '/home/ubuntu/.cursor/projects/workspace/assets',
  '/home/ubuntu/.cursor/projects/workspace',
  '/home/ubuntu/.cursor',
  '/home/ubuntu/.cursor-server/data/User',
]

const IDS = {
  calm: 'D96BABC8-B830-4B67-AD61-57CBD4746DE0',
  roar: '491568B1-E3DB-4AAE-8557-F7382F14F911',
  icon: 'A5A15C62-BBD9-40B4-8FB8-D4C780F5497A',
}

const PNG_OPTS = Object.freeze({
  compressionLevel: 9,
  adaptiveFiltering: false,
  palette: false,
  force: true,
})

function findSource(id) {
  for (const dir of CANDIDATE_ROOTS) {
    if (!existsSync(dir)) continue
    const exact = [
      path.join(dir, `${id}.jpeg`),
      path.join(dir, `${id}.jpg`),
      path.join(dir, `${id}.png`),
    ]
    for (const p of exact) {
      if (existsSync(p)) return p
    }
  }
  const confirmed = [
    `/home/ubuntu/.cursor/projects/workspace/assets/${id}-8de4613a-7813-4549-bc94-8f70de5c58f9.jpg`,
    `/home/ubuntu/.cursor/projects/workspace/assets/${id}-a56bd39f-5028-493a-9b08-abb518b1da67.jpg`,
    `/home/ubuntu/.cursor/projects/workspace/assets/${id}-84eeab67-ef1c-45b8-ab0b-65d657d93e64.jpg`,
  ]
  for (const p of confirmed) {
    if (existsSync(p)) return p
  }
  for (const dir of CANDIDATE_ROOTS) {
    if (!existsSync(dir)) continue
    try {
      for (const name of readdirSync(dir)) {
        if (name.includes(id)) return path.join(dir, name)
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

function rgbToHsv(r, g, b) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

/** Score 0..1 : pixel fond vert (écran) — jamais le vert des yeux (saturation + hue). */
function greenScreenScore(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b)
  const greenHue = h >= 70 && h <= 160
  if (!greenHue) return 0
  if (g < 80) return 0
  if (g <= r + 20 || g <= b + 20) return 0
  const dominance = (g - Math.max(r, b)) / 255
  if (dominance < 0.12 && s < 0.35) return 0
  let score = 0
  score += Math.min(1, dominance * 2.2) * 0.55
  score += Math.min(1, s) * 0.25
  score += Math.min(1, Math.max(0, (v - 0.25) / 0.75)) * 0.2
  if (g > 180 && dominance > 0.35) score = Math.max(score, 0.92)
  if (g > 220 && dominance > 0.5) score = 1
  return Math.min(1, score)
}

/** Déspill : retire la teinte verte résiduelle sur les bords. */
function despill(r, g, b) {
  const limit = Math.max(r, b) * 1.05
  if (g > limit) {
    const ng = Math.round(limit)
    return [r, ng, b]
  }
  return [r, g, b]
}

/** Obligatoire avant resize : RGB neutre sur alpha=0 (évite halos verts au downscale). */
function neutralizeTransparentRgb(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
}

/** Déspill + purge franges vertes après chaque resize. */
function despillBuffer(data) {
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
    const [nr, ng, nb] = despill(r, g, b)
    data[i] = nr
    data[i + 1] = ng
    data[i + 2] = nb
    if (g > r + 30 && g > b + 30 && g > 80 && a < 250) {
      data[i + 3] = 0
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
}

/**
 * Contrôle automatisé : pixels visibles (a≥12) avec teinte vert écran.
 * Tolérance 0 — le vert n’entre jamais dans l’identité.
 */
export function countVisibleGreenPixels(data, { alphaMin = 12, scoreMin = 0.35 } = {}) {
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaMin) continue
    if (greenScreenScore(data[i], data[i + 1], data[i + 2]) >= scoreMin) count++
  }
  return count
}

async function assertNoVisibleGreen(filePath, label) {
  const { data } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = countVisibleGreenPixels(data)
  if (n > 0) {
    throw new Error(`Contrôle vert échoué — ${label}: ${n} pixel(s) vert(s) visible(s)`)
  }
  console.log(`  ✓ contrôle vert OK — ${label} (0 pixel)`)
}

async function chromaKeyToRgba(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const score = greenScreenScore(r, g, b)
    if (score >= 0.72) {
      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
      out[i + 3] = 0
      continue
    }
    if (score >= 0.18) {
      const alpha = Math.round(255 * (1 - (score - 0.18) / (0.72 - 0.18)))
      const [nr, ng, nb] = despill(r, g, b)
      out[i] = nr
      out[i + 1] = ng
      out[i + 2] = nb
      out[i + 3] = Math.min(out[i + 3], alpha)
      continue
    }
    const [nr, ng, nb] = despill(r, g, b)
    out[i] = nr
    out[i + 1] = ng
    out[i + 2] = nb
  }

  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3]
    if (a === 0) {
      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
      continue
    }
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const greenish = g > r + 35 && g > b + 35 && g > 90
    if (greenish && a < 180) {
      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
      out[i + 3] = 0
      continue
    }
    if (greenScreenScore(r, g, b) > 0.28 && a < 220) {
      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
      out[i + 3] = 0
    }
  }

  neutralizeTransparentRgb(out)
  return { data: out, info }
}

function subjectBounds(data, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 12) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width, height }
  const pad = Math.round(Math.max(width, height) * 0.04)
  const left = Math.max(0, minX - pad)
  const top = Math.max(0, minY - pad)
  const right = Math.min(width, maxX + 1 + pad)
  const bottom = Math.min(height, maxY + 1 + pad)
  const side = Math.max(right - left, bottom - top)
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  let L = Math.round(cx - side / 2)
  let T = Math.round(cy - side / 2)
  if (L < 0) L = 0
  if (T < 0) T = 0
  if (L + side > width) L = width - side
  if (T + side > height) T = height - side
  return { left: L, top: T, width: side, height: side }
}

async function writeTransparentMaster(inputPath, outPath, size = 1024) {
  const { data, info } = await chromaKeyToRgba(inputPath)
  neutralizeTransparentRgb(data)
  const crop = subjectBounds(data, info.width, info.height)

  const cropped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(crop)
    .raw()
    .toBuffer({ resolveWithObject: true })

  neutralizeTransparentRgb(cropped.data)

  const resized = await sharp(cropped.data, {
    raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 },
  })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  despillBuffer(resized.data)
  neutralizeTransparentRgb(resized.data)

  await sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toFile(outPath)

  await assertNoVisibleGreen(outPath, path.relative(root, outPath))
  const stats = await sharp(outPath).stats()
  const meta = await sharp(outPath).metadata()
  console.log(
    `  ✓ ${path.relative(root, outPath)} ${meta.width}×${meta.height} alphaMax=${stats.channels[3]?.max ?? 0}`,
  )
}

/** Icône opaque sombre : fond noir produit, sujet centré, pas de vert. */
async function writeOpaqueIcon(inputPath, outPath, size = 1024) {
  const BRAND_BG = { r: 0x0c, g: 0x0c, b: 0x0e, alpha: 1 }
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r <= 8 && g <= 8 && b <= 8) {
      data[i] = BRAND_BG.r
      data[i + 1] = BRAND_BG.g
      data[i + 2] = BRAND_BG.b
      data[i + 3] = 255
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png(PNG_OPTS)
    .toFile(outPath)
  await assertNoVisibleGreen(outPath, path.relative(root, outPath))
  const meta = await sharp(outPath).metadata()
  console.log(`  ✓ ${path.relative(root, outPath)} ${meta.width}×${meta.height} opaque`)
}

async function writePublicSplash(masterPath, outPath) {
  const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  neutralizeTransparentRgb(data)
  const resized = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  despillBuffer(resized.data)
  neutralizeTransparentRgb(resized.data)
  await sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toFile(outPath)
  await assertNoVisibleGreen(outPath, path.relative(root, outPath))
}

async function main() {
  await mkdir(sourcesDir, { recursive: true })

  const calmSrc = findSource(IDS.calm)
  const roarSrc = findSource(IDS.roar)
  const iconSrc = findSource(IDS.icon)

  if (!calmSrc || !roarSrc || !iconSrc) {
    console.error('Sources manquantes:', { calmSrc, roarSrc, iconSrc })
    process.exit(1)
  }

  console.log('Sources résolues:')
  console.log('  calm =', calmSrc)
  console.log('  roar =', roarSrc)
  console.log('  icon =', iconSrc)

  const calmCopy = path.join(sourcesDir, `${IDS.calm}.jpg`)
  const roarCopy = path.join(sourcesDir, `${IDS.roar}.jpg`)
  const iconCopy = path.join(sourcesDir, `${IDS.icon}.jpg`)
  await copyFile(calmSrc, calmCopy)
  await copyFile(roarSrc, roarCopy)
  await copyFile(iconSrc, iconCopy)
  await writeFile(
    path.join(sourcesDir, 'MANIFEST.json'),
    JSON.stringify(
      {
        calm: { id: IDS.calm, source: calmSrc, copy: path.relative(root, calmCopy) },
        roar: { id: IDS.roar, source: roarSrc, copy: path.relative(root, roarCopy) },
        icon: { id: IDS.icon, source: iconSrc, copy: path.relative(root, iconCopy) },
        note: 'Copies des sources propriétaires. Ne pas modifier. Vert = détourage uniquement.',
      },
      null,
      2,
    ),
  )

  await writeTransparentMaster(calmCopy, path.join(brandDir, 'panther-calm-crowned.png'), 1024)
  // Dérivée propriétaire rugissante — chemin dédié au lancement uniquement.
  await writeTransparentMaster(roarCopy, path.join(brandDir, 'panther-launch-roaring.png'), 1024)
  await writeOpaqueIcon(iconCopy, path.join(brandDir, 'panther-icon-opaque.png'), 1024)

  const publicDir = path.join(root, 'public')
  await writePublicSplash(
    path.join(brandDir, 'panther-calm-crowned.png'),
    path.join(publicDir, 'brand-splash-calm.png'),
  )
  await writePublicSplash(
    path.join(brandDir, 'panther-launch-roaring.png'),
    path.join(publicDir, 'brand-splash-roar.png'),
  )
  console.log('  ✓ public/brand-splash-calm.png + brand-splash-roar.png (depuis launch roar)')
  console.log('  ✓ panther-roaring.png laissé intact (Daily Streak)')

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
