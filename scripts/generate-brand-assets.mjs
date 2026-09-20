/**
 * Génère les icônes web/PWA Ranked Gym à partir du master raster
 * `src/assets/brand/panther-calm-crowned.png` (PNG, non vectoriel)
 * et de la plaque d’icône `src/assets/brand/panther-icon-opaque.png`.
 *
 * Les masters dans `src/assets/brand/` ne sont jamais modifiés.
 * Les rouges du logo principal (header / splash) sont normalisés à la
 * génération vers la palette produit (#B91C1C → #FF2B2B), fond #0C0C0E.
 * Les icônes home-screen / PWA / native copient les pixels exacts de la
 * plaque panthère (bouche fermée, couronne rouge, glow).
 *
 * Usage: npm run brand:assets
 *        node scripts/generate-brand-assets.mjs --icons-only
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

sharp.cache(false)
sharp.concurrency(1)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const BRAND_BG = { r: 0x0c, g: 0x0c, b: 0x0e, alpha: 1 }
/** Rouge profond (`--color-brand-deep`). */
const BRAND_RED_DEEP = { r: 0xb9, g: 0x1c, b: 0x1c }
/** Rouge produit principal (`--color-brand`). */
const BRAND_RED_BRIGHT = { r: 0xff, g: 0x2b, b: 0x2b }

const MASTER_CALM = path.join(root, 'src/assets/brand/panther-calm-crowned.png')
/** Icône store/PWA — source propriétaire opaque (A5A15C62…), jamais de fond vert. */
const MASTER_ICON = path.join(root, 'src/assets/brand/panther-icon-opaque.png')
const PUBLIC_DIR = path.join(root, 'public')
const NATIVE_DIR = path.join(root, 'assets')
/** Sources Capacitor Assets (`@capacitor/assets`) — 1024×1024. */
const NATIVE_EXPORT_SIZE = 1024
/** Splash Capacitor — minimum 2732×2732, fond noir + panthère calme (D96BABC8). */
const SPLASH_EXPORT_SIZE = 2732
const SPLASH_LOGO_SCALE = 0.42
/** icon-only : plaque officielle en pixels exacts (pas de padding supplémentaire). */
const ICON_ONLY_SCALE = 1
/**
 * Adaptive foreground : plaque pleine.
 * L’inset XML Capacitor (16.7 %) mappe le PNG dans la safe zone Android 66/108.
 */
const ICON_FOREGROUND_SCALE = 1
/** Maskable PWA : sujet centré ~72 % pour que le crop circulaire n’entame pas couronne/oreilles. */
const MASKABLE_CONTENT_SCALE = 0.72
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

function neutralizeTransparentRgb(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
}

function despillRgb(r, g, b) {
  const limit = Math.max(r, b) * 1.05
  if (g > limit) return [r, Math.round(limit), b]
  return [r, g, b]
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
    const [nr, ng, nb] = despillRgb(data[i], data[i + 1], data[i + 2])
    data[i] = nr
    data[i + 1] = ng
    data[i + 2] = nb
    if (data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30 && data[i + 1] > 80 && a < 250) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

async function countVisibleGreen(filePath) {
  const { data } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 12) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (g > r + 35 && g > b + 35 && g > 90) n++
  }
  return n
}

async function assertNoVisibleGreen(filePath, label) {
  const n = await countVisibleGreen(filePath)
  if (n > 0) throw new Error(`Contrôle vert échoué — ${label}: ${n} pixel(s)`)
  console.log(`  ✓ contrôle vert OK — ${label}`)
}

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
  neutralizeTransparentRgb(data)
  const crop = computeHeaderCropBox(data, info.width, info.height)
  const outPath = path.join(PUBLIC_DIR, HEADER_MARK_FILENAME)

  const resized = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(crop)
    .resize(HEADER_MARK_EXPORT_SIZE, HEADER_MARK_EXPORT_SIZE, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  despillAfterResize(resized.data)
  neutralizeTransparentRgb(resized.data)

  await sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toFile(outPath)

  await assertNoVisibleGreen(outPath, path.relative(root, outPath))
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

/** Splash natif Capacitor : fond noir + panthère calme (D96BABC8). */
async function writeNativeSplash() {
  const { data, info } = await sharp(MASTER_CALM).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  neutralizeTransparentRgb(data)
  const logoSize = Math.round(SPLASH_EXPORT_SIZE * SPLASH_LOGO_SCALE)
  const resized = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  despillAfterResize(resized.data)
  neutralizeTransparentRgb(resized.data)
  const logoPng = await sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toBuffer()

  const splashPath = path.join(NATIVE_DIR, 'splash.png')
  const splashDarkPath = path.join(NATIVE_DIR, 'splash-dark.png')
  for (const outPath of [splashPath, splashDarkPath]) {
    await sharp({
      create: {
        width: SPLASH_EXPORT_SIZE,
        height: SPLASH_EXPORT_SIZE,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([{ input: logoPng, gravity: 'centre' }])
      .png(PNG_OPTS)
      .toFile(outPath)
    await assertNoVisibleGreen(outPath, path.relative(root, outPath))
    console.log(`  ✓ ${path.relative(root, outPath)} (${SPLASH_EXPORT_SIZE}×${SPLASH_EXPORT_SIZE}, noir + calme)`)
  }
}

/** Favicon raster depuis la plaque panthère (pixels exacts, redimensionnés). */
async function writeFaviconFromIcon(iconMasterBuffer) {
  const faviconPath = path.join(PUBLIC_DIR, 'favicon.png')
  await writeExactIcon(iconMasterBuffer, 64, faviconPath)
  await assertNoVisibleGreen(faviconPath, 'public/favicon.png')
  const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Ranked Gym">
  <rect width="64" height="64" rx="14" fill="#0C0C0E"/>
  <image href="/favicon.png" x="0" y="0" width="64" height="64"/>
</svg>
`
  await writeFile(path.join(PUBLIC_DIR, 'favicon.svg'), faviconSvg, 'utf8')
  console.log('  ✓ public/favicon.png + favicon.svg wrapper')
}

/** Sources natives Capacitor : icon-only / icon-foreground / icon-background. */
async function writeNativeSources(iconMasterBuffer) {
  await mkdir(NATIVE_DIR, { recursive: true })

  const iconOnlyPath = path.join(NATIVE_DIR, 'icon-only.png')
  if (ICON_ONLY_SCALE === 1) {
    await writeExactIcon(iconMasterBuffer, NATIVE_EXPORT_SIZE, iconOnlyPath)
  } else {
    await writeSquareIcon(iconMasterBuffer, NATIVE_EXPORT_SIZE, iconOnlyPath, {
      contentScale: ICON_ONLY_SCALE,
    })
  }
  const iconOnlyOpaque = await sharp(iconOnlyPath).removeAlpha().png(PNG_OPTS).toBuffer()
  await writeFile(iconOnlyPath, iconOnlyOpaque)
  await assertNoVisibleGreen(iconOnlyPath, 'assets/icon-only.png')

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

  const subjectSize = Math.round(NATIVE_EXPORT_SIZE * ICON_FOREGROUND_SCALE)
  const offset = Math.round((NATIVE_EXPORT_SIZE - subjectSize) / 2)
  const subject = await sharp(iconMasterBuffer)
    .resize(subjectSize, subjectSize, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .png(PNG_OPTS)
    .toBuffer()
  const fgPath = path.join(NATIVE_DIR, 'icon-foreground.png')
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
    .toFile(fgPath)
  await assertNoVisibleGreen(fgPath, 'assets/icon-foreground.png')
  console.log(`  ✓ ${path.relative(root, fgPath)} (adaptive foreground, scale ${ICON_FOREGROUND_SCALE})`)
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

/** Redimensionne la plaque sans padding produit supplémentaire (pixels exacts). */
async function writeExactIcon(masterBuffer, size, outPath) {
  const metaIn = await sharp(masterBuffer).metadata()
  if (metaIn.width === size && metaIn.height === size) {
    await writeFile(outPath, masterBuffer)
  } else {
    await sharp(masterBuffer)
      .resize(size, size, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
      .png(PNG_OPTS)
      .toFile(outPath)
  }
  const meta = await sharp(outPath).metadata()
  console.log(`  ✓ ${path.relative(root, outPath)} (${meta.width}×${meta.height}, exact)`)
}

async function copyIconMasters() {
  const brandDir = path.join(PUBLIC_DIR, 'brand')
  const resourcesDir = path.join(root, 'resources')
  await mkdir(brandDir, { recursive: true })
  await mkdir(resourcesDir, { recursive: true })
  const publicMaster = path.join(brandDir, 'app-icon-master.png')
  const resourcesIcon = path.join(resourcesDir, 'icon.png')
  await copyFile(MASTER_ICON, publicMaster)
  await copyFile(MASTER_ICON, resourcesIcon)
  console.log(`  ✓ ${path.relative(root, publicMaster)} (master copy, exact bytes)`)
  console.log(`  ✓ ${path.relative(root, resourcesIcon)} (Capacitor/cordova master)`)
}

async function generateAppIconsFromMaster() {
  const iconMasterBuffer = await readFile(MASTER_ICON)
  const meta = await sharp(iconMasterBuffer).metadata()
  if (!meta.width || meta.width !== meta.height) {
    throw new Error(`Master icône non carré : ${MASTER_ICON} (${meta.width}×${meta.height})`)
  }
  console.log(
    `App icons — exact pixels from ${path.relative(root, MASTER_ICON)} (${meta.width}×${meta.height}, bouche fermée)`,
  )

  await copyIconMasters()
  await writeNativeSources(iconMasterBuffer)

  await writeExactIcon(iconMasterBuffer, 180, path.join(PUBLIC_DIR, 'icon.png'))
  await writeExactIcon(iconMasterBuffer, 180, path.join(PUBLIC_DIR, 'apple-touch-icon.png'))
  await writeExactIcon(iconMasterBuffer, 192, path.join(PUBLIC_DIR, 'pwa-192x192.png'))
  await writeExactIcon(iconMasterBuffer, 512, path.join(PUBLIC_DIR, 'pwa-512x512.png'))
  await writeSquareIcon(
    iconMasterBuffer,
    512,
    path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'),
    { contentScale: MASKABLE_CONTENT_SCALE },
  )
  await writeFaviconFromIcon(iconMasterBuffer)

  for (const name of [
    'icon.png',
    'apple-touch-icon.png',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'favicon.png',
  ]) {
    await assertNoVisibleGreen(path.join(PUBLIC_DIR, name), `public/${name}`)
  }
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true })
  const iconsOnly = process.argv.includes('--icons-only')

  if (!iconsOnly) {
    console.log(
      'Brand assets — masters intactes, rouges → #B91C1C…#FF2B2B, fond #0C0C0E ; icônes PWA via panther-icon-opaque',
    )
    const headerMasterPixels = await loadProcessedMasterPixels({ opaqueProductBackground: false })
    await writeHeaderMark(headerMasterPixels)
    await writeNativeSplash()
  }

  await generateAppIconsFromMaster()

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
