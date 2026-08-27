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
async function loadProcessedMasterBuffer() {
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
    if (r === 0 && g === 0 && b === 0) {
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

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png(PNG_OPTS)
    .toBuffer()
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
