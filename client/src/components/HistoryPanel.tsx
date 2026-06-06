import { useState, useCallback } from 'react'
import type { HistoryEntry } from '../types/image'

interface HistoryPanelProps {
  history: HistoryEntry[]
  loading: boolean
  onRefresh: () => void
  onClearAll: () => void
  onRestore: (entry: HistoryEntry) => void
}

function getImageSrc(entry: HistoryEntry, index = 0): string {
  const image = entry.images[index]
  if (!image) return ''
  if (image.b64_json) return `data:${image.mimeType};base64,${image.b64_json}`
  return image.url || ''
}

function HistoryThumbnail({ entry }: { entry: HistoryEntry }) {
  const [imageIndex, setImageIndex] = useState(0)
  const src = getImageSrc(entry, imageIndex)
  const showImage = Boolean(src)

  return (
    <div className="history-thumb">
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => {
            setImageIndex(index => index + 1)
          }}
        />
      ) : (
        <div className="history-thumb-empty" aria-hidden="true" />
      )}
    </div>
  )
}

export default function HistoryPanel({ history, loading, onRefresh, onClearAll, onRestore }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const toggleExpanded = useCallback(() => {
    setExpanded(v => !v)
  }, [])

  const formatDate = useCallback((dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }, [])

  const truncatePrompt = useCallback((prompt: string, maxLen = 72) => {
    if (prompt.length <= maxLen) return prompt
    return `${prompt.substring(0, maxLen)}...`
  }, [])

  return (
    <section className="surface-panel p-4">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="section-label">历史记录</h2>
          <p className="mt-1 text-xs text-ink-500">{history.length} 条记录，可恢复提示词和参数</p>
        </div>
        <span className="text-button">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-ink-200 pt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button onClick={onRefresh} disabled={loading} className="btn-secondary">
              {loading ? '刷新中...' : '刷新'}
            </button>
            {history.length > 0 && (
              <button onClick={onClearAll} className="btn-danger">
                清空全部
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center text-sm text-ink-500">
              暂无历史记录。
            </p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {history.map((entry) => {
                return (
                  <article key={entry.id} className="history-row">
                    <HistoryThumbnail entry={entry} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink-800">{truncatePrompt(entry.prompt)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-500">
                        <span>{formatDate(entry.createdAt)}</span>
                        <span>{entry.params.size}</span>
                        <span>{entry.params.resolution || 'N/A'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onRestore(entry)}
                      className="btn-secondary flex-shrink-0"
                      title="恢复这条记录"
                    >
                      恢复
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
