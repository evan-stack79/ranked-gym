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

  ctx.fillStyle = '#C7C7CC'
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('RANKED GYM // UPPER', left, 140)

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
  return new File([blob], `ranked-gym-pump-check-${Date.now()}.jpg`, {
    type: 'image/jpeg',
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

export async function shareVictoryCard(
  blob: Blob,
  title: string,
): Promise<'shared' | 'saved'> {
  const file = toVictoryFile(blob)

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: 'Pump Check — Ranked Gym',
        })
        return 'shared'
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  downloadBlob(blob, file.name)
  return 'saved'
}

/** @deprecated */
export async function shareOrSaveVictoryCard(
  blob: Blob,
  title: string,
): Promise<'shared' | 'saved'> {
  return shareVictoryCard(blob, title)
}
