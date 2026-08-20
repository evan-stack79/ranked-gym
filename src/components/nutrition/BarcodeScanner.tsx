import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, type Html5QrcodeResult } from 'html5-qrcode'
import { Camera, Loader2, X } from 'lucide-react'
import { fetchOpenFoodFacts, type OpenFoodFactsProduct } from '../../services/alimentsService'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onProduct: (product: OpenFoodFactsProduct) => void
}

export function BarcodeScanner({ open, onClose, onProduct }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const containerId = 'ranked-gym-barcode-reader'

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setLookingUp(false)

    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

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
            { fps: 8, qrbox: { width: 260, height: 140 } },
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
        { fps: 8, qrbox: { width: 260, height: 140 } },
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-label="Fermer le scanner"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-[28px] border border-white/10 bg-[#161618] sm:mx-4 sm:rounded-[28px]"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#30D158]" />
            <div>
              <p className="text-[16px] font-semibold text-white">Scanner Open Food Facts</p>
              <p className="text-[12px] text-[#8E8E93]">Cadre le code-barres du produit</p>
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

        <div className="px-4 pb-4">
          <div
            id={containerId}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black"
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
    </div>
  )
}
