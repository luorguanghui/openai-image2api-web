import { useState, useCallback } from 'react'
import type { GeneratedImage } from '../types/image'

interface ImageResultProps {
  images: GeneratedImage[]
  onCopyParams: () => void
}

function getImageSrc(image: GeneratedImage): string {
  if (image.b64_json) {
    return `data:${image.mimeType};base64,${image.b64_json}`
  }
  return image.url || ''
}

function getExtension(image: GeneratedImage): string {
  if (image.mimeType.includes('jpeg') || image.mimeType.includes('jpg')) return 'jpeg'
  if (image.mimeType.includes('webp')) return 'webp'
  return 'png'
}

export default function ImageResult({ images, onCopyParams }: ImageResultProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [paramsCopied, setParamsCopied] = useState(false)

  const handleDownload = useCallback((image: GeneratedImage) => {
    const src = getImageSrc(image)
    if (!src) return

    const link = document.createElement('a')
    link.href = src
    link.download = `generated-${image.id}.${getExtension(image)}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const handleCopyBase64 = useCallback(async (image: GeneratedImage) => {
    if (!image.b64_json) return
    try {
      await navigator.clipboard.writeText(image.b64_json)
      setCopiedId(image.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Clipboard permissions can be unavailable in some browsers.
    }
  }, [])

  const handleCopyParams = useCallback(async () => {
    try {
      await onCopyParams()
      setParamsCopied(true)
      setTimeout(() => setParamsCopied(false), 2000)
    } catch {
      // Copy fallback is handled by the parent.
    }
  }, [onCopyParams])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">Completed</p>
          <h3 className="text-lg font-semibold text-ink-950">{images.length} 张图片已生成</h3>
        </div>
        <button onClick={handleCopyParams} className="btn-secondary self-start sm:self-auto">
          {paramsCopied ? '参数已复制' : '复制参数 JSON'}
        </button>
      </div>

      <div className={`grid gap-4 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
        {images.map((image, index) => {
          const src = getImageSrc(image)
          const hasBase64 = Boolean(image.b64_json)

          return (
            <article key={image.id} className="image-tile">
              <div className="image-frame">
                {src ? (
                  <img
                    src={src}
                    alt={`生成图片 ${index + 1}`}
                    className="max-h-[720px] w-full object-contain"
                  />
                ) : (
                  <div className="flex min-h-80 items-center justify-center text-sm text-ink-500">
                    图片地址为空
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">#{index + 1} · {image.id}</p>
                  <p className="text-xs text-ink-500">{hasBase64 ? '已缓存到本地' : '远程图片 URL'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasBase64 && (
                    <button onClick={() => handleCopyBase64(image)} className="btn-secondary">
                      {copiedId === image.id ? '已复制' : '复制 Base64'}
                    </button>
                  )}
                  <button onClick={() => handleDownload(image)} className="btn-secondary">
                    下载
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
