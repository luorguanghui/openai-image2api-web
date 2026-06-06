import { useState, useCallback, useEffect } from 'react'
import type { GenerateImageParams, ImageQuality, OutputFormat, BackgroundMode, ModelInfo } from '../types/image'

interface ImageFormProps {
  params: Omit<GenerateImageParams, 'apiKey'>
  models: ModelInfo[]
  modelsLoading: boolean
  modelsSource: 'local' | 'online'
  onlineModelCount?: number
  onParamsChange: (params: Partial<Omit<GenerateImageParams, 'apiKey'>>) => void
  onUploadReferenceImages: (files: File[]) => Promise<string[]>
  onSubmit: () => void
  loading: boolean
}

const SIZE_LABELS: Record<string, string> = {
  auto: '自动',
  '1:1': '1:1 正方形',
  '3:2': '3:2 横构图',
  '2:3': '2:3 竖构图',
  '4:3': '4:3 横构图',
  '3:4': '3:4 竖构图',
  '5:4': '5:4 横构图',
  '4:5': '4:5 竖版帖子',
  '16:9': '16:9 宽屏',
  '9:16': '9:16 手机全屏',
  '2:1': '2:1 Banner',
  '1:2': '1:2 竖版',
  '3:1': '3:1 超宽 Banner',
  '1:3': '1:3 长海报',
  '21:9': '21:9 电影宽屏',
  '9:21': '9:21 超长竖版',
  '1024x1024': '1024 x 1024',
  '1536x1024': '1536 x 1024',
  '1024x1536': '1024 x 1536',
}

const RESOLUTION_HINTS: Record<string, string> = {
  '1k': '日常、省额度',
  '2k': '海报、高清',
  '4k': '壁纸、精细输出',
}

const QUALITY_HINTS: Record<ImageQuality, string> = {
  auto: '自动，通常偏省时',
  low: '最快',
  medium: '平衡',
  high: '最高精度，耗时最长',
}

export default function ImageForm({
  params,
  models,
  modelsLoading,
  modelsSource,
  onlineModelCount,
  onParamsChange,
  onUploadReferenceImages,
  onSubmit,
  loading
}: ImageFormProps) {
  const [showReferences, setShowReferences] = useState(Boolean(params.image_urls?.length))
  const [imageUrlsInput, setImageUrlsInput] = useState(params.image_urls?.join('\n') || '')
  const [uploadingReferences, setUploadingReferences] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const currentModel = models.find(m => m.id === params.model)
  const supportsResolution = Boolean(currentModel?.supportedResolutions.length)
  const supportsImageUrls = currentModel?.supportsImageUrls ?? false
  const supportsMask = currentModel?.supportsMask ?? false
  const maxN = currentModel?.maxN ?? 4
  const transparentUnsupported = params.model === 'gpt-image-2-official'

  useEffect(() => {
    setImageUrlsInput(params.image_urls?.join('\n') || '')
  }, [params.image_urls])

  useEffect(() => {
    if (transparentUnsupported && params.background === 'transparent') {
      onParamsChange({ background: 'auto' })
    }
  }, [transparentUnsupported, params.background, onParamsChange])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }, [onSubmit])

  const handleClear = useCallback(() => {
    onParamsChange({ prompt: '' })
  }, [onParamsChange])

  const handleModelChange = useCallback((modelId: string) => {
    const model = models.find(m => m.id === modelId)
    if (!model) return

    const updates: Partial<Omit<GenerateImageParams, 'apiKey'>> = { model: modelId }

    if (!model.supportedSizes.includes(params.size)) {
      updates.size = model.supportedSizes[0] || 'auto'
    }

    if (model.supportedResolutions.length === 0) {
      updates.resolution = ''
    } else if (!model.supportedResolutions.includes(params.resolution)) {
      updates.resolution = model.supportedResolutions[0]
    }

    if (params.n > model.maxN) {
      updates.n = model.maxN
    }

    if (!model.supportsImageUrls) {
      updates.image_urls = undefined
      updates.mask_url = undefined
      setImageUrlsInput('')
      setShowReferences(false)
    }

    if (modelId === 'gpt-image-2-official' && params.background === 'transparent') {
      updates.background = 'auto'
    }

    onParamsChange(updates)
  }, [models, params, onParamsChange])

  const handleImageUrlsChange = useCallback((value: string) => {
    setImageUrlsInput(value)
    const urls = value.split('\n').map(s => s.trim()).filter(Boolean)
    onParamsChange({
      image_urls: urls.length > 0 ? urls : undefined,
      mask_url: urls.length > 0 ? params.mask_url : undefined,
    })
  }, [onParamsChange, params.mask_url])

  const appendReferenceUrls = useCallback((urls: string[]) => {
    const existing = imageUrlsInput.split('\n').map(s => s.trim()).filter(Boolean)
    const nextUrls = [...existing, ...urls].slice(0, 16)
    const nextValue = nextUrls.join('\n')
    setImageUrlsInput(nextValue)
    onParamsChange({ image_urls: nextUrls.length > 0 ? nextUrls : undefined })
  }, [imageUrlsInput, onParamsChange])

  const handleReferenceUpload = useCallback(async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []).slice(0, 16)
    if (selectedFiles.length === 0) return

    setUploadingReferences(true)
    setUploadError(null)
    try {
      const urls = await onUploadReferenceImages(selectedFiles)
      appendReferenceUrls(urls)
      setShowReferences(true)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '参考图上传失败。')
    } finally {
      setUploadingReferences(false)
    }
  }, [appendReferenceUrls, onUploadReferenceImages])

  const handleOutputFormatChange = useCallback((format: OutputFormat) => {
    onParamsChange({
      output_format: format,
      output_compression: format === 'png' ? undefined : params.output_compression,
    })
  }, [onParamsChange, params.output_compression])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="surface-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <label htmlFor="prompt" className="section-label">提示词</label>
            <p className="mt-1 text-xs text-ink-500">建议写清主体、场景、风格、镜头和用途。</p>
          </div>
          {params.prompt && (
            <button type="button" onClick={handleClear} className="text-button">
              清空
            </button>
          )}
        </div>
        <textarea
          id="prompt"
          value={params.prompt}
          onChange={(e) => onParamsChange({ prompt: e.target.value })}
          placeholder="例如：一张用于官网首屏的 16:9 产品视觉图，清晨自然光，真实摄影风格，主体清晰，背景干净..."
          className="input-field min-h-36 resize-none text-[15px] leading-7"
          required
        />
      </section>

      <section className="surface-panel p-4">
        <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="section-label">模型与输出</h2>
            <p className="mt-1 text-xs text-ink-500">参数按 APIMart 官方 GPT-Image-2 文档整理。</p>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={params.saveHistory}
              onChange={(e) => onParamsChange({ saveHistory: e.target.checked })}
            />
            <span>保存历史</span>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="model" className="label-text">模型</label>
            <select
              id="model"
              value={params.model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="select-field"
              disabled={modelsLoading}
            >
              {modelsLoading ? (
                <option value="">加载中...</option>
              ) : (
                models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))
              )}
            </select>
            {currentModel && (
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{currentModel.description}</p>
            )}
            <p className="mt-1 text-xs text-ink-500">
              {modelsSource === 'online'
                ? `在线列表已读取${onlineModelCount ? ` ${onlineModelCount} 个模型` : ''}，当前只显示图像生成兼容模型。`
                : '当前使用本地兼容模型列表；填写 API Key 后可在线刷新。'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="size" className="label-text">画面比例</label>
              <select
                id="size"
                value={params.size}
                onChange={(e) => onParamsChange({ size: e.target.value })}
                className="select-field"
              >
                {(currentModel?.supportedSizes || ['auto', '1:1']).map(s => (
                  <option key={s} value={s}>{SIZE_LABELS[s] || s}</option>
                ))}
              </select>
            </div>

            {supportsResolution && (
              <div>
                <label htmlFor="resolution" className="label-text">分辨率</label>
                <select
                  id="resolution"
                  value={params.resolution}
                  onChange={(e) => onParamsChange({ resolution: e.target.value })}
                  className="select-field"
                >
                  {(currentModel?.supportedResolutions || []).map(r => (
                    <option key={r} value={r}>{r.toUpperCase()} - {RESOLUTION_HINTS[r] || ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="quality" className="label-text">质量</label>
              <select
                id="quality"
                value={params.quality}
                onChange={(e) => onParamsChange({ quality: e.target.value as ImageQuality })}
                className="select-field"
              >
                {(['auto', 'low', 'medium', 'high'] as ImageQuality[]).map(q => (
                  <option key={q} value={q}>{q} - {QUALITY_HINTS[q]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="n" className="label-text">生成张数</label>
              <input
                id="n"
                type="number"
                min={1}
                max={maxN}
                value={params.n}
                onChange={(e) => onParamsChange({ n: Math.max(1, Math.min(maxN, Number(e.target.value) || 1)) })}
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink-500">当前模型最多 {maxN} 张。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="section-label">格式与安全</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="output_format" className="label-text">输出格式</label>
            <select
              id="output_format"
              value={params.output_format}
              onChange={(e) => handleOutputFormatChange(e.target.value as OutputFormat)}
              className="select-field"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>

          <div>
            <label htmlFor="background" className="label-text">背景</label>
            <select
              id="background"
              value={params.background}
              onChange={(e) => onParamsChange({ background: e.target.value as BackgroundMode })}
              className="select-field"
            >
              <option value="auto">自动</option>
              <option value="opaque">不透明</option>
              <option value="transparent" disabled={transparentUnsupported}>透明</option>
            </select>
            {transparentUnsupported && (
              <p className="mt-1 text-xs text-amber-700">GPT-Image-2 官方渠道不支持透明背景，会按 auto 处理。</p>
            )}
          </div>

          <div>
            <label htmlFor="moderation" className="label-text">审核强度</label>
            <select
              id="moderation"
              value={params.moderation}
              onChange={(e) => onParamsChange({ moderation: e.target.value })}
              className="select-field"
            >
              <option value="auto">auto - 默认</option>
              <option value="low">low - 更宽松</option>
            </select>
          </div>

          {(params.output_format === 'jpeg' || params.output_format === 'webp') && (
            <div>
              <label htmlFor="output_compression" className="label-text">压缩强度</label>
              <input
                id="output_compression"
                type="number"
                min={0}
                max={100}
                value={params.output_compression ?? ''}
                onChange={(e) => onParamsChange({
                  output_compression: e.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(e.target.value) || 0))
                })}
                placeholder="0-100"
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink-500">仅对 JPEG / WebP 有效。</p>
            </div>
          )}
        </div>
      </section>

      {supportsImageUrls && (
        <section className="surface-panel p-4">
          <button
            type="button"
            onClick={() => setShowReferences(v => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="section-label">参考图与局部重绘</h2>
              <p className="mt-1 text-xs text-ink-500">最多 16 张公网图片 URL，mask 需搭配参考图。</p>
            </div>
            <span className="text-button">{showReferences ? '收起' : '展开'}</span>
          </button>

          {showReferences && (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="image_urls" className="label-text">参考图 URL</label>
                <label className="upload-dropzone mb-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) => handleReferenceUpload(e.target.files)}
                  />
                  <span>{uploadingReferences ? '上传中...' : '点击上传参考图'}</span>
                  <small>上传到 APIMart 后生成公网 URL，72 小时有效</small>
                </label>
                {uploadError && (
                  <p className="mb-2 text-xs text-red-800">{uploadError}</p>
                )}
                {params.image_urls && params.image_urls.length > 0 && (
                  <div className="reference-preview-grid mb-3">
                    {params.image_urls.slice(0, 8).map((url, index) => (
                      <div key={`${url}-${index}`} className="reference-preview">
                        <img src={url} alt={`参考图 ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  id="image_urls"
                  value={imageUrlsInput}
                  onChange={(e) => handleImageUrlsChange(e.target.value)}
                  placeholder="https://example.com/image-a.png&#10;https://example.com/image-b.png"
                  className="input-field min-h-24 resize-none text-sm"
                />
              </div>
              {supportsMask && imageUrlsInput.trim().length > 0 && (
                <div>
                  <label htmlFor="mask_url" className="label-text">遮罩图 URL</label>
                  <input
                    id="mask_url"
                    type="url"
                    value={params.mask_url || ''}
                    onChange={(e) => onParamsChange({ mask_url: e.target.value || undefined })}
                    placeholder="https://example.com/mask.png"
                    className="input-field text-sm"
                  />
                  <p className="mt-1 text-xs text-ink-500">遮罩图需要 Alpha 通道，尺寸需与首张参考图一致。</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <button
        type="submit"
        disabled={loading || !params.prompt.trim()}
        className="btn-primary"
      >
        {loading ? '生成中...' : '提交生成任务'}
      </button>
    </form>
  )
}
