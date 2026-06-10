import { useCallback, useState } from 'react'
import type { ConversationTurn, GeneratedImage } from '../types/image'

interface PendingTurn {
  prompt: string
  createdAt: string
  continueFromLastImage: boolean
}

interface ConversationThreadProps {
  turns: ConversationTurn[]
  pendingTurn: PendingTurn | null
}

function imageSrc(image: GeneratedImage): string {
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

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function ConversationThread({ turns, pendingTurn }: ConversationThreadProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleDownload = useCallback((image: GeneratedImage) => {
    const src = imageSrc(image)
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

  return (
    <div className="conversation-thread">
      {turns.length === 0 && !pendingTurn && (
        <div className="conversation-empty">
          <h3>开始一段生成对话</h3>
          <p>每次提交的提示词和返回图片都会按轮次显示在这里。</p>
        </div>
      )}

      {turns.map((turn, index) => (
        <article key={turn.id} className="conversation-turn">
          <div className="message-row is-user">
            <div className="message-bubble">
              <div className="message-meta">
                <span>第 {index + 1} 轮提示词</span>
                <span>{formatTime(turn.createdAt)}</span>
              </div>
              <p>{turn.prompt}</p>
            </div>
          </div>
          <div className="message-row is-assistant">
            <div className="message-bubble">
              <div className="message-meta">
                <span>生成结果</span>
                <span>{turn.model || turn.params.model}</span>
              </div>
              <div className={`thread-image-grid ${turn.images.length === 1 ? 'single' : ''}`}>
                {turn.images.map((image, imageIndex) => {
                  const src = imageSrc(image)
                  const hasBase64 = Boolean(image.b64_json)

                  return (
                    <div key={`${turn.id}-${image.id}`} className="thread-image">
                      <div className="thread-image-media">
                        {src ? (
                          <img src={src} alt={`第 ${index + 1} 轮生成图 ${imageIndex + 1}`} />
                        ) : (
                          <div className="history-thumb-empty" aria-hidden="true" />
                        )}
                      </div>
                      <div className="thread-image-actions">
                        <div className="thread-image-meta">
                          <span>#{imageIndex + 1} · {image.id}</span>
                          <small>{hasBase64 ? '已缓存到本地' : '远程图片 URL'}</small>
                        </div>
                        <div className="thread-image-buttons">
                          {hasBase64 && (
                            <button type="button" onClick={() => handleCopyBase64(image)} className="btn-secondary">
                              {copiedId === image.id ? '已复制' : '复制 Base64'}
                            </button>
                          )}
                          <button type="button" onClick={() => handleDownload(image)} className="btn-secondary">
                            下载
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </article>
      ))}

      {pendingTurn && (
        <article className="conversation-turn">
          <div className="message-row is-user">
            <div className="message-bubble is-pending">
              <div className="message-meta">
                <span>{pendingTurn.continueFromLastImage ? '调整提示词' : '提示词'}</span>
                <span>{formatTime(pendingTurn.createdAt)}</span>
              </div>
              <p>{pendingTurn.prompt}</p>
            </div>
          </div>
          <div className="message-row is-assistant">
            <div className="message-bubble is-pending">
              <div className="message-meta">
                <span>生成中</span>
                <span>等待上游任务</span>
              </div>
              <div className="thread-image-grid single">
                <div className="thread-image is-generating" aria-label="生成中">
                  <div className="generation-shimmer" aria-hidden="true" />
                  <div className="inline-loader" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  )
}
