import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { Apple } from 'lucide-react'

interface OffProductImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string | null
  alt: string
  /** Taille visuelle (px) pour le fallback. */
  size?: number
  /** Force l’icône neutre (tests offline). */
  forceFallback?: boolean
}

/**
 * Photo OFF chargée à la demande — jamais bloquante.
 * Offline / erreur → icône neutre ; l’ajout au journal reste possible.
 */
export function OffProductImage({
  src,
  alt,
  size = 72,
  forceFallback = false,
  className = '',
  ...rest
}: OffProductImageProps) {
  const [failed, setFailed] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  useEffect(() => {
    setFailed(false)
  }, [src])

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

  const showImage = Boolean(src) && !failed && online && !forceFallback

  return (
    <div
      className={`relative flex items-center justify-center overflow-visible ${className}`}
      style={{ width: size, height: size }}
      data-off-image={showImage ? 'ready' : 'fallback'}
    >
      {showImage ? (
        <img
          {...rest}
          src={src!}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="pointer-events-none h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-2xl bg-[#2C2C2E] text-[#8E8E93]"
          aria-hidden
        >
          <Apple className="h-[42%] w-[42%]" strokeWidth={1.75} />
        </span>
      )}
    </div>
  )
}
