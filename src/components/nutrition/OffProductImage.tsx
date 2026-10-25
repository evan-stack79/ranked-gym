import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { Apple } from 'lucide-react'
import { resolveCachedImageUrl } from '../../services/foodOfflineCache'

interface OffProductImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string | null
  alt: string
  /** Taille visuelle (px) pour le fallback. */
  size?: number
  /** Force l’icône neutre (tests). */
  forceFallback?: boolean
  barcode?: string
  productName?: string
}

/**
 * Photo produit — URL de notre stockage, ou data URL du cache offline.
 * Offline : affiche les octets locaux s’ils existent ; sinon icône neutre.
 */
export function OffProductImage({
  src,
  alt,
  size = 72,
  forceFallback = false,
  barcode,
  productName,
  className = '',
  ...rest
}: OffProductImageProps) {
  const [failed, setFailed] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (src?.startsWith('data:image/')) return src
    if (barcode && productName) {
      return resolveCachedImageUrl({ barcode, nom: productName, imageUrl: src ?? undefined })
    }
    return src ?? undefined
  })

  useEffect(() => {
    setFailed(false)
    if (src?.startsWith('data:image/')) {
      setResolvedSrc(src)
      return
    }
    if (barcode && productName) {
      const cached = resolveCachedImageUrl({
        barcode,
        nom: productName,
        imageUrl: src ?? undefined,
      })
      setResolvedSrc(cached ?? src ?? undefined)
      return
    }
    setResolvedSrc(src ?? undefined)
  }, [src, barcode, productName])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const hasLocalBytes = Boolean(resolvedSrc?.startsWith('data:image/'))
  const showImage =
    Boolean(resolvedSrc) && !failed && !forceFallback && (online || hasLocalBytes)

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl ${className}`}
      style={{ width: size, height: size }}
      data-off-image={showImage ? 'ready' : 'fallback'}
    >
      {showImage ? (
        <img
          {...rest}
          src={resolvedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="pointer-events-none h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-2xl bg-[#25282A] text-[#ACB4BA]"
          aria-hidden
        >
          <Apple className="h-[42%] w-[42%]" strokeWidth={1.75} />
        </span>
      )}
    </div>
  )
}
