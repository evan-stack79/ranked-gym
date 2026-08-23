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

function drawArenaOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(0, 0, width, height)

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(255, 43, 43, 0.35)')
  gradient.addColorStop(0.5, 'rgba(255, 43, 43, 0.08)')
  gradient.addColorStop(1, 'rgba(255, 43, 43, 0.28)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#FF2B2B'
  ctx.lineWidth = 12
  ctx.strokeRect(24, 24, width - 48, height - 48)

  ctx.strokeStyle = 'rgba(255, 105, 97, 0.55)'
  ctx.lineWidth = 4
  ctx.strokeRect(48, 48, width - 96, height - 96)
}

function drawStats(ctx: CanvasRenderingContext2D, stats: VictorySessionStats, width: number) {
  const centerX = width / 2

  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('SÉANCE VALIDÉE', centerX, 220)

  ctx.fillStyle = '#FF6961'
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText(stats.title.toUpperCase(), centerX, 290)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText(`${stats.volumeKg.toLocaleString('fr-FR')} kg`, centerX, heightCenter(stats) - 40)

  ctx.fillStyle = '#AEAEB2'
  ctx.font = '600 42px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('VOLUME TOTAL', centerX, heightCenter(stats) + 20)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 88px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText(`${stats.durationMin} min`, centerX, heightCenter(stats) + 160)

  ctx.fillStyle = '#FF2B2B'
  ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  const prLabel =
    stats.prCount === 0
      ? '0 PR'
      : stats.prCount === 1
        ? '1 PR BATTU'
        : `${stats.prCount} PR BATTUS`
  ctx.fillText(prLabel, centerX, CARD_HEIGHT - 280)

  ctx.fillStyle = '#8E8E93'
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
  ctx.fillText('RANKED GYM · PUMP CHECK', centerX, CARD_HEIGHT - 180)
}

function heightCenter(_stats: VictorySessionStats): number {
  return CARD_HEIGHT * 0.52
}

/** Capture photo + overlay en une image JPEG (équivalent view-shot). */
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
  drawArenaOverlay(ctx, CARD_WIDTH, CARD_HEIGHT)
  drawStats(ctx, stats, CARD_WIDTH)

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

/** Partage natif ou téléchargement de la carte Pump Check. */
export async function shareOrSaveVictoryCard(blob: Blob, title: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], `ranked-gym-pump-check-${Date.now()}.jpg`, {
    type: 'image/jpeg',
  })

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

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
