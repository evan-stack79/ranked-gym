import type { VictorySessionStats } from '../types/victory'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1920

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Impossible de charger la photo'))
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / img.width, height / img.height)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const x = (width - drawW) / 2
  const y = (height - drawH) / 2
  ctx.drawImage(img, x, y, drawW, drawH)
}

/** Vignette haut/bas — remplace l'ancienne bordure rouge. */
function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const top = ctx.createLinearGradient(0, 0, 0, height * 0.42)
  top.addColorStop(0, 'rgba(0, 0, 0, 0.72)')
  top.addColorStop(0.55, 'rgba(0, 0, 0, 0.12)')
  top.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, width, height * 0.42)

  const bottom = ctx.createLinearGradient(0, height * 0.55, 0, height)
  bottom.addColorStop(0, 'rgba(0, 0, 0, 0)')
  bottom.addColorStop(0.35, 'rgba(0, 0, 0, 0.1)')
  bottom.addColorStop(1, 'rgba(0, 0, 0, 0.78)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, height * 0.55, width, height * 0.45)
}

/** Stats brutalistes left-aligned — miroir UI (hors boutons). */
function drawStats(ctx: CanvasRenderingContext2D, stats: VictorySessionStats) {
  const left = 64
  ctx.textAlign = 'left'

  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillStyle = '#FF2B2B'
  ctx.fillText('RANKED', left, 140)
  const rankedW = ctx.measureText('RANKED').width
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(' GYM', left + rankedW, 140)
  const gymW = ctx.measureText(' GYM').width
  ctx.fillStyle = '#C7C7CC'
  ctx.fillText(' // UPPER', left + rankedW + gymW, 140)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '900 92px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('SÉANCE', left, 250)
  ctx.fillText('VALIDÉE', left, 340)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText(stats.title.toUpperCase(), left, 400)

  const baseY = CARD_HEIGHT - 420

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('VOLUME', left, baseY)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '900 110px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  const vol = Math.round(stats.volumeKg).toLocaleString('fr-FR')
  ctx.fillText(vol, left, baseY + 110)

  const volWidth = ctx.measureText(vol).width
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '700 36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('KG', left + volWidth + 16, baseY + 100)

  const timeX = left + 520
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('TEMPS', timeX, baseY)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '900 72px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  const timeLabel =
    stats.durationMin < 60
      ? `${stats.durationMin} MIN`
      : (() => {
          const h = Math.floor(stats.durationMin / 60)
          const m = stats.durationMin % 60
          return m > 0 ? `${h}H ${m}M` : `${h}H`
        })()
  ctx.fillText(timeLabel, timeX, baseY + 100)

  if (stats.prCount > 0) {
    const label = stats.prCount === 1 ? '1 PR BATTU' : `${stats.prCount} PR BATTUS`
    ctx.fillStyle = '#FF453A'
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    ctx.fillText(label, left, baseY + 190)

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    const tw = ctx.measureText(label).width
    ctx.strokeRect(left - 12, baseY + 150, tw + 24, 54)
  }
}

/**
 * Export de la zone « ViewShot » uniquement :
 * photo + overlay stats (pas les boutons d'action).
 */
export async function exportVictoryCard(
  photoSrc: string,
  stats: VictorySessionStats,
): Promise<Blob> {
  const img = await loadImage(photoSrc)
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')

  drawCover(ctx, img, CARD_WIDTH, CARD_HEIGHT)
  drawVignette(ctx, CARD_WIDTH, CARD_HEIGHT)
  drawStats(ctx, stats)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Export image échoué'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

function toVictoryFile(blob: Blob): File {
  const jpeg =
    blob.type === 'image/jpeg' ? blob : new Blob([blob], { type: 'image/jpeg' })
  return new File([jpeg], `ranked-gym-pump-check-${Date.now()}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function saveVictoryCardToGallery(blob: Blob): Promise<void> {
  const file = toVictoryFile(blob)
  downloadBlob(blob, file.name)
}

/**
 * Partage iOS-friendly : File JPEG typé (image/jpeg) + partage fichiers seuls.
 * Sur iOS Safari, title/text avec files masque souvent l’aperçu image
 * (icône fichier générique). On force donc files-only + MIME/UTI JPEG.
 */
export async function shareVictoryCard(
  blob: Blob,
  _title: string,
): Promise<'shared' | 'saved'> {
  // Force MIME image/jpeg même si le blob source est ambigu
  const jpegBlob =
    blob.type === 'image/jpeg'
      ? blob
      : new Blob([blob], { type: 'image/jpeg' })

  const fileName = `ranked-gym-pump-check-${Date.now()}.jpg`
  const file = new File([jpegBlob], fileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  // Capacitor Share natif (UTI public.jpeg) si dispo dans le WebView iOS
  try {
    const cap = (
      window as Window & {
        Capacitor?: {
          isNativePlatform?: () => boolean
          Plugins?: {
            Share?: {
              share: (opts: {
                title?: string
                text?: string
                url?: string
                dialogTitle?: string
              }) => Promise<void>
            }
            Filesystem?: {
              writeFile: (opts: {
                path: string
                data: string
                directory: string
                recursive?: boolean
              }) => Promise<{ uri: string }>
              Directory?: { Cache: string }
            }
          }
        }
      }
    ).Capacitor

    if (cap?.isNativePlatform?.() && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
      const base64 = await blobToBase64(jpegBlob)
      const cacheDir = cap.Plugins.Filesystem.Directory?.Cache ?? 'CACHE'
      const written = await cap.Plugins.Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: cacheDir,
        recursive: true,
      })
      await cap.Plugins.Share.share({
        title: 'Partager ton Pump Check',
        url: written.uri,
        dialogTitle: 'Partager ton Pump Check',
      })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // fallback Web Share ci-dessous
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const payload: ShareData = { files: [file] }
      if (!navigator.canShare || navigator.canShare(payload)) {
        // Intentionnellement sans title/text : aperçu JPEG iOS
        await navigator.share(payload)
        return 'shared'
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  downloadBlob(jpegBlob, fileName)
  return 'saved'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('base64 failed'))
    reader.readAsDataURL(blob)
  })
}

/** @deprecated */
export async function shareOrSaveVictoryCard(
  blob: Blob,
  title: string,
): Promise<'shared' | 'saved'> {
  return shareVictoryCard(blob, title)
}
