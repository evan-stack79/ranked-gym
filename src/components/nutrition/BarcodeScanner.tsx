import { useEffect, useRef, useState } from 'react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
  type Html5QrcodeResult,
} from 'html5-qrcode'
import { Camera, Loader2, X } from 'lucide-react'
import { fetchOpenFoodFacts, type OpenFoodFactsProduct } from '../../services/alimentsService'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onProduct: (product: OpenFoodFactsProduct) => void
}

/** Larger scan area + higher-res camera so barcodes can be read a bit farther away. */
function buildScanConfig(): Html5QrcodeCameraScanConfig {
  return {
    fps: 12,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const width = Math.floor(Math.min(viewfinderWidth * 0.92, viewfinderWidth - 16))
      const height = Math.floor(Math.min(viewfinderHeight * 0.55, 240))
      return { width: Math.max(180, width), height: Math.max(100, height) }
    },
    aspectRatio: 1.777778,
    disableFlip: false,
    videoConstraints: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  }
}

export function BarcodeScanner({ open, onClose, onProduct }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)
  const handledRef = useRef(false)
  const containerId = 'ranked-gym-barcode-reader'

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setLookingUp(false)

    const scanner = new Html5Qrcode(containerId, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    })
    scannerRef.current = scanner
    const config = buildScanConfig()

    const onScan = async (decoded: string, _result: Html5QrcodeResult) => {
      if (handledRef.current) return
      handledRef.current = true
      setLookingUp(true)

      try {
        await scanner.stop()
      } catch {
        // already stopped
      }

      try {
        const product = await fetchOpenFoodFacts(decoded)
        onProduct(product)
        onClose()
      } catch (err) {
        setLookingUp(false)
        handledRef.current = false
        setError(err instanceof Error ? err.message : 'Scan impossible.')
        try {
          await scanner.start(
            { facingMode: 'environment' },
            config,
            (text, result) => {
              void onScan(text, result)
            },
            () => undefined,
          )
        } catch {
          setError('Impossible de relancer la caméra.')
        }
      }
    }

    void scanner
      .start(
        { facingMode: 'environment' },
        config,
        (text, result) => {
          void onScan(text, result)
        },
        () => undefined,
      )
      .catch(() => {
        setError('Autorise l’accès à la caméra pour scanner un code-barres.')
      })

    return () => {
      const current = scannerRef.current
      scannerRef.current = null
      if (current?.isScanning) {
        void current.stop().catch(() => undefined)
      }
      try {
        current?.clear()
      } catch {
        // ignore
      }
    }
  }, [open, onClose, onProduct])

  // Bring the camera into the viewport as soon as the panel mounts.
  useEffect(() => {
    if (!open) return
    const scroll = () => {
      cameraRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const t1 = window.setTimeout(scroll, 40)
    const t2 = window.setTimeout(scroll, 180)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="relative z-20 overflow-hidden rounded-3xl border border-[#30D158]/35 bg-[#161618] shadow-[0_0_40px_rgb(48_209_88_/_0.15)]"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#30D158]" />
          <div>
            <p className="text-[16px] font-semibold text-white">Scanner Open Food Facts</p>
            <p className="text-[12px] text-[#8E8E93]">
              Tiens le code un peu plus loin — pas besoin de coller l’écran
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#8E8E93]"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={cameraRef} className="px-4 pb-4">
        <div
          id={containerId}
          className="overflow-hidden rounded-2xl border border-white/10 bg-black [&_video]:min-h-[280px] [&_video]:w-full [&_video]:object-cover"
        />
        {lookingUp && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-[#8E8E93]">
            <Loader2 className="h-4 w-4 animate-spin text-[#30D158]" />
            Recherche Open Food Facts…
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
