/**
 * Génère les icônes web/PWA Ranked Gym à partir du master raster
 * `src/assets/brand/panther-calm-crowned.png` (PNG, non vectoriel).
 *
 * Les masters dans `src/assets/brand/` ne sont jamais modifiés.
 * Les rouges du logo principal sont normalisés à la génération vers la
 * palette produit (#B91C1C → #FF2B2B), fond #0C0C0E.
 *
 * Usage: npm run brand:assets
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

sharp.cache(false)
sharp.concurrency(1)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const BRAND_BG = { r: 0x0c, g: 0x0c, b: 0x0e, alpha: 1 }
/** Rouge produit principal (`--color-brand`). */
const BRAND_RED = '#FF2B2B'
/** Rouge profond (`--color-brand-deep`). */
const BRAND_RED_DEEP = { r: 0xb9, g: 0x1c, b: 0x1c }
const BRAND_RED_BRIGHT = { r: 0xff, g: 0x2b, b: 0x2b }

const MASTER_CALM = path.join(root, 'src/assets/brand/panther-calm-crowned.png')
const PUBLIC_DIR = path.join(root, 'public')
const NATIVE_DIR = path.join(root, 'assets')
/** Sources Capacitor Assets (`@capacitor/assets`) — 1024×1024. */
const NATIVE_EXPORT_SIZE = 1024
/** icon-only : panthère ~72–78 % du canvas. */
const ICON_ONLY_SCALE = 0.75
/** icon-foreground : sujet ~58–61 %, dans la safe zone 66/108. */
const ICON_FOREGROUND_SCALE = 0.6
/** Marque header compacte — fond transparent, cadrage serré (BrandMark compact uniquement). */
const HEADER_MARK_FILENAME = 'brand-header-mark.png'
/** Export raster header — affiché en CSS à 38×38 px. */
const HEADER_MARK_EXPORT_SIZE = 192
/** Tête ≈ 88–92 % du carré exporté (header 38 px). */
const HEADER_HEAD_FILL = 0.9
/** Contours silhouette — anthracite produit. */
const ANTHRACITE_DARK = { r: 0x24, g: 0x24, b: 0x29 }
const ANTHRACITE_MID = { r: 0x34, g: 0x34, b: 0x3c }

/** Options PNG fixes → sorties bit-identique entre deux runs. */
const PNG_OPTS = Object.freeze({
  compressionLevel: 9,
  adaptiveFiltering: false,
  palette: false,
  force: true,
})

/** Favicon SVG : couronne géométrique seule (pas de PNG embarqué). */
const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Ranked Gym">
  <rect width="32" height="32" rx="7" fill="#0C0C0E"/>
  <!-- Couronne 3 pointes, fidèle au logo panthère (centre plus haut) -->
  <path
    fill="${BRAND_RED}"
    d="M7 23V13.5l4 3.2L16 7l5 9.7 4-3.2V23H7z"
  />
</svg>
`

function clamp01(x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x
}

function lerpByte(a, b, t) {
  return Math.round(a + (b - a) * t)
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

/**
 * Pixel rouge du logo (couronne / yeux / nez), y compris anti-alias soft.
 * Ne capture pas les gris du visage (faible saturation).
 */
function isBrandRedCandidate(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b)
  if (v < 0.1) return false
  if (s < 0.28) return false
  const redHue = h <= 18 || h >= 342
  if (!redHue) return false
  // Rouge dominant (évite les teintes brunes/grises)
  return r >= g && r >= b && r - Math.max(g, b) >= 12
}

/**
 * Remappe un rouge source vers la rampe #B91C1C → #FF2B2B selon sa valeur,
 * en adoucissant les bords anti-aliasés (mélange avec le pixel d’origine).
 */
function normalizeRedPixel(r, g, b) {
  const { s, v } = rgbToHsv(r, g, b)
  // Valeur basse → rouge profond ; valeur haute → rouge principal
  const t = clamp01((v - 0.28) / 0.72)
  let nr = lerpByte(BRAND_RED_DEEP.r, BRAND_RED_BRIGHT.r, t)
  let ng = lerpByte(BRAND_RED_DEEP.g, BRAND_RED_BRIGHT.g, t)
  let nb = lerpByte(BRAND_RED_DEEP.b, BRAND_RED_BRIGHT.b, t)

  // Force du remap : saturation basse = bord AA → conserve un peu l’origine
  const strength = clamp01((s - 0.28) / 0.42)
  nr = lerpByte(r, nr, strength)
  ng = lerpByte(g, ng, strength)
  nb = lerpByte(b, nb, strength)
  return [nr, ng, nb]
}

/**
 * Fond #0C0C0E + normalisation des rouges produit.
 * Masters sur disque : jamais écrits.
 */
/**
 * Normalise les rouges du master ; optionnellement remplace le noir pur par le fond produit.
 */
async function loadProcessedMasterPixels({ opaqueProductBackground = true } = {}) {
  const { data, info } = await sharp(MASTER_CALM)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    // Fond noir pur → fond produit (ne touche pas aux gris du museau)
    if (opaqueProductBackground && r === 0 && g === 0 && b === 0) {
      data[i] = BRAND_BG.r
      data[i + 1] = BRAND_BG.g
      data[i + 2] = BRAND_BG.b
      data[i + 3] = 255
      continue
    }

    if (isBrandRedCandidate(r, g, b)) {
      const [nr, ng, nb] = normalizeRedPixel(r, g, b)
      data[i] = nr
      data[i + 1] = ng
      data[i + 2] = nb
      data[i + 3] = a
    }
  }

  return { data, info }
}

async function loadProcessedMasterBuffer() {
  const { data, info } = await loadProcessedMasterPixels({ opaqueProductBackground: true })
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toBuffer()
}

/**
 * Pixel de fond extérieur : sombre, neutre, connecté aux bords.
 * Les noirs/gris intérieurs de la panthère (non reliés au bord) restent opaques.
 */
function isExteriorBackgroundPixel(r, g, b) {
  if (isBrandRedCandidate(r, g, b)) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  // Très sombre, quasi neutre — le fond master + #0C0C0E après remap PWA.
  if (max > 24) return false
  if (delta > 10) return false
  return true
}

/**
 * Flood-fill depuis les bords : seuls les pixels « fond » connectés aux bords deviennent transparents.
 */
function removeEdgeConnectedBackground(data, width, height) {
  const total = width * height
  const exterior = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const tryEnqueue = (x, y) => {
    const idx = y * width + x
    if (exterior[idx]) return
    const o = idx * 4
    if (!isExteriorBackgroundPixel(data[o], data[o + 1], data[o + 2])) return
    exterior[idx] = 1
    queue[tail++] = idx
  }

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0)
    tryEnqueue(x, height - 1)
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y)
    tryEnqueue(width - 1, y)
  }

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % width
    const y = (idx - x) / width
    if (x > 0) tryEnqueue(x - 1, y)
    if (x < width - 1) tryEnqueue(x + 1, y)
    if (y > 0) tryEnqueue(x, y - 1)
    if (y < height - 1) tryEnqueue(x, y + 1)
  }

  for (let idx = 0; idx < total; idx++) {
    if (!exterior[idx]) continue
    data[idx * 4 + 3] = 0
  }
}

/** Cadrage header : tête ≈ HEADER_HEAD_FILL du carré, centré sur le sujet. */
function computeHeaderCropBox(data, width, height, fillRatio = HEADER_HEAD_FILL) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (data[o + 3] < 8) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) {
    return { left: 0, top: 0, width, height }
  }

  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const subjectSide = Math.max(bw, bh)
  const side = Math.min(
    width,
    height,
    Math.max(subjectSide, Math.round(subjectSide / fillRatio)),
  )
  const cx = (minX + maxX + 1) / 2
  const cy = (minY + maxY + 1) / 2
  let left = Math.round(cx - side / 2)
  let top = Math.round(cy - side / 2)
  if (left < 0) left = 0
  if (top < 0) top = 0
  if (left + side > width) left = width - side
  if (top + side > height) top = height - side
  return { left, top, width: side, height: side }
}

function isOpaquePixel(data, idx) {
  return data[idx * 4 + 3] >= 8
}

function hasTransparentNeighbor(data, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true
      if (!isOpaquePixel(data, ny * width + nx)) return true
    }
  }
  return false
}

/**
 * Distance au bord transparent (0 = silhouette extérieure).
 * Profondeur max 4 px — bande de contour à éclaircir.
 */
function computeSilhouetteDepth(data, width, height, maxDepth = 4) {
  const total = width * height
  const depth = new Int16Array(total).fill(-1)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!isOpaquePixel(data, idx)) continue
      if (hasTransparentNeighbor(data, width, height, x, y)) {
        depth[idx] = 0
        queue[tail++] = idx
      }
    }
  }

  while (head < tail) {
    const idx = queue[head++]
    if (depth[idx] >= maxDepth) continue
    const x = idx % width
    const y = (idx - x) / width
    const next = depth[idx] + 1
    if (x > 0) {
      const n = idx - 1
      if (depth[n] === -1 && isOpaquePixel(data, n)) {
        depth[n] = next
        queue[tail++] = n
      }
    }
    if (x < width - 1) {
      const n = idx + 1
      if (depth[n] === -1 && isOpaquePixel(data, n)) {
        depth[n] = next
        queue[tail++] = n
      }
    }
    if (y > 0) {
      const n = idx - width
      if (depth[n] === -1 && isOpaquePixel(data, n)) {
        depth[n] = next
        queue[tail++] = n
      }
    }
    if (y < height - 1) {
      const n = idx + width
      if (depth[n] === -1 && isOpaquePixel(data, n)) {
        depth[n] = next
        queue[tail++] = n
      }
    }
  }

  return depth
}

/** Éclaircit oreilles / joues / museau ; conserve le noir profond intérieur. */
function lightenHeaderContours(data, width, height) {
  const depth = computeSilhouetteDepth(data, width, height, 4)
  const total = width * height

  for (let idx = 0; idx < total; idx++) {
    if (!isOpaquePixel(data, idx)) continue
    const o = idx * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    if (isBrandRedCandidate(r, g, b)) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min
    if (delta > 18) continue

    const band = depth[idx]
    if (band === -1) {
      // Intérieur : noir profond conservé tel quel.
      continue
    }

    let target = ANTHRACITE_DARK
    let strength = 0.72
    if (band >= 2 || max > 28) {
      target = ANTHRACITE_MID
      strength = band >= 3 ? 0.55 : 0.68
    }
    if (max > 72) {
      strength *= 0.45
    }

    data[o] = lerpByte(r, target.r, strength)
    data[o + 1] = lerpByte(g, target.g, strength)
    data[o + 2] = lerpByte(b, target.b, strength)
  }
}

/** Supprime franges semi-transparentes sombres (pas de halo autour de la tête). */
function removeDarkFringe(data, width, height) {
  const total = width * height
  for (let idx = 0; idx < total; idx++) {
    const o = idx * 4
    const a = data[o + 3]
    if (a === 0 || a === 255) continue
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const max = Math.max(r, g, b)
    if (max < 56 && a < 210) {
      data[o + 3] = 0
      continue
    }
    if (a >= 200) {
      data[o + 3] = 255
    }
  }
}

async function writeHeaderMark(masterPixels) {
  const { data, info } = masterPixels
  removeEdgeConnectedBackground(data, info.width, info.height)
  lightenHeaderContours(data, info.width, info.height)
  removeDarkFringe(data, info.width, info.height)
  const crop = computeHeaderCropBox(data, info.width, info.height)
  const outPath = path.join(PUBLIC_DIR, HEADER_MARK_FILENAME)

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(crop)
    .resize(HEADER_MARK_EXPORT_SIZE, HEADER_MARK_EXPORT_SIZE, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png(PNG_OPTS)
    .toFile(outPath)

  const meta = await sharp(outPath).metadata()
  const stats = await sharp(outPath).stats()
  const alphaMax = stats.channels[3]?.max ?? 255
  const fillPct = await measureHeaderFill(outPath)
  console.log(
    `  ✓ ${path.relative(root, outPath)} (${meta.width}×${meta.height}, fill ~${fillPct}%, alpha max ${alphaMax})`,
  )
  return outPath
}

/** Mesure le % de remplissage du sujet dans le carré exporté (debug). */
async function measureHeaderFill(outPath) {
  const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 8) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return 0
  const side = Math.max(maxX - minX + 1, maxY - minY + 1)
  return Math.round((side / info.width) * 100)
}

function clonePixelBuffer({ data, info }) {
  return { data: Buffer.from(data), info }
}

/** icon-foreground.png — panthère transparente, centrée, safe zone Android. */
async function writeNativeForeground(masterPixels, outPath) {
  const { data, info } = clonePixelBuffer(masterPixels)
  removeEdgeConnectedBackground(data, info.width, info.height)
  lightenHeaderContours(data, info.width, info.height)
  removeDarkFringe(data, info.width, info.height)
  const crop = computeHeaderCropBox(data, info.width, info.height, 1)
  const subjectSize = Math.round(NATIVE_EXPORT_SIZE * ICON_FOREGROUND_SCALE)
  const offset = Math.round((NATIVE_EXPORT_SIZE - subjectSize) / 2)

  const subject = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(crop)
    .resize(subjectSize, subjectSize, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png(PNG_OPTS)
    .toBuffer()

  await sharp({
    create: {
      width: NATIVE_EXPORT_SIZE,
      height: NATIVE_EXPORT_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left: offset, top: offset }])
    .png(PNG_OPTS)
    .toFile(outPath)

  const fillPct = await measureHeaderFill(outPath)
  console.log(
    `  ✓ ${path.relative(root, outPath)} (${NATIVE_EXPORT_SIZE}×${NATIVE_EXPORT_SIZE}, fill ~${fillPct}%, transparent)`,
  )
}

/** Sources natives Capacitor : icon-only / icon-foreground / icon-background. */
async function writeNativeSources(masterBuffer, headerMasterPixels) {
  await mkdir(NATIVE_DIR, { recursive: true })

  const iconOnlyPath = path.join(NATIVE_DIR, 'icon-only.png')
  await writeSquareIcon(masterBuffer, NATIVE_EXPORT_SIZE, iconOnlyPath, {
    contentScale: ICON_ONLY_SCALE,
  })
  const iconOnlyOpaque = await sharp(iconOnlyPath).removeAlpha().png(PNG_OPTS).toBuffer()
  await writeFile(iconOnlyPath, iconOnlyOpaque)

  const iconBackgroundPath = path.join(NATIVE_DIR, 'icon-background.png')
  await sharp({
    create: {
      width: NATIVE_EXPORT_SIZE,
      height: NATIVE_EXPORT_SIZE,
      channels: 3,
      background: BRAND_BG,
    },
  })
    .png(PNG_OPTS)
    .toFile(iconBackgroundPath)
  console.log(
    `  ✓ ${path.relative(root, iconBackgroundPath)} (${NATIVE_EXPORT_SIZE}×${NATIVE_EXPORT_SIZE}, #0C0C0E opaque)`,
  )

  await writeNativeForeground(
    headerMasterPixels,
    path.join(NATIVE_DIR, 'icon-foreground.png'),
  )
}

async function writeSquareIcon(masterBuffer, size, outPath, { contentScale = 1 } = {}) {
  const inner = Math.max(1, Math.round(size * contentScale))
  const logo = await sharp(masterBuffer)
    .resize(inner, inner, {
      fit: 'contain',
      background: BRAND_BG,
      kernel: sharp.kernel.lanczos3,
    })
    .png(PNG_OPTS)
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png(PNG_OPTS)
    .toFile(outPath)

  const meta = await sharp(outPath).metadata()
  console.log(`  ✓ ${path.relative(root, outPath)} (${meta.width}×${meta.height})`)
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true })

  console.log(
    'Brand assets — master intact, rouges → #B91C1C…#FF2B2B, fond #0C0C0E',
  )
  const masterBuffer = await loadProcessedMasterBuffer()
  const headerMasterPixels = await loadProcessedMasterPixels({ opaqueProductBackground: false })

  await writeHeaderMark(headerMasterPixels)
  await writeNativeSources(masterBuffer, headerMasterPixels)

  await writeSquareIcon(masterBuffer, 180, path.join(PUBLIC_DIR, 'icon.png'), {
    contentScale: 0.92,
  })
  await writeSquareIcon(masterBuffer, 192, path.join(PUBLIC_DIR, 'pwa-192x192.png'), {
    contentScale: 0.92,
  })
  await writeSquareIcon(masterBuffer, 512, path.join(PUBLIC_DIR, 'pwa-512x512.png'), {
    contentScale: 0.92,
  })
  await writeSquareIcon(
    masterBuffer,
    512,
    path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'),
    { contentScale: 0.7 },
  )

  const faviconPath = path.join(PUBLIC_DIR, 'favicon.svg')
  await writeFile(faviconPath, FAVICON_SVG, 'utf8')
  console.log(`  ✓ ${path.relative(root, faviconPath)} (couronne SVG géométrique)`)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
