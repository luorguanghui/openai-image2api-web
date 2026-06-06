import { useState, useCallback, useEffect } from 'react'
import ApiKeyCard from './components/ApiKeyCard'
import ImageForm from './components/ImageForm'
import ImageResult from './components/ImageResult'
import HistoryPanel from './components/HistoryPanel'
import ErrorAlert from './components/ErrorAlert'
import { generateImage, fetchHistory, clearHistory, fetchModels, uploadReferenceImages } from './api/imageApi'
import type {
  GenerateImageParams,
  GeneratedImage,
  HistoryEntry,
  ModelInfo,
} from './types/image'

const DEFAULT_PARAMS: Omit<GenerateImageParams, 'apiKey'> = {
  model: 'gpt-image-2',
  prompt: '',
  size: '1:1',
  resolution: '1k',
  quality: 'auto',
  output_format: 'png',
  background: 'auto',
  moderation: 'auto',
  output_compression: undefined,
  n: 1,
  image_urls: undefined,
  mask_url: undefined,
  saveHistory: true,
}

const MODEL_FALLBACK: ModelInfo = {
  id: 'gpt-image-2',
  name: 'GPT-Image-2 (APIMart)',
  description: 'APIMart gpt-image-2 async image generation model.',
  maxN: 1,
  maxReferenceImages: 16,
  supportedSizes: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21'],
  supportedResolutions: ['1k', '2k', '4k'],
  supportedQualities: ['auto'],
  supportedOutputFormats: ['png'],
  supportsImageUrls: true,
  supportsBase64ImageUrls: true,
  supportsMask: false,
  requestMode: 'async',
}

const API_KEY_STORAGE_KEY = 'image2api.apiKey'
const REMEMBER_API_KEY_STORAGE_KEY = 'image2api.rememberApiKey'

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [rememberApiKey, setRememberApiKey] = useState(false)
  const [params, setParams] = useState<Omit<GenerateImageParams, 'apiKey'>>(DEFAULT_PARAMS)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsSource, setModelsSource] = useState<'local' | 'online'>('local')
  const [onlineModelCount, setOnlineModelCount] = useState<number | undefined>()
  const [modelsLoading, setModelsLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedRemember = localStorage.getItem(REMEMBER_API_KEY_STORAGE_KEY) === 'true'
    const storedKey = storedRemember ? localStorage.getItem(API_KEY_STORAGE_KEY) || '' : ''
    setRememberApiKey(storedRemember)
    if (storedKey) {
      setApiKey(storedKey)
      loadModels(storedKey)
    } else {
      loadModels()
    }
    loadHistory()
  }, [])

  useEffect(() => {
    localStorage.setItem(REMEMBER_API_KEY_STORAGE_KEY, String(rememberApiKey))
    if (rememberApiKey && apiKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim())
    }
    if (!rememberApiKey) {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  }, [rememberApiKey, apiKey])

  const currentModel = models.find(model => model.id === params.model)

  const loadModels = useCallback(async (apiKeyForOnline?: string) => {
    setModelsLoading(true)
    try {
      const res = await fetchModels(apiKeyForOnline)
      if (res.success && res.models.length > 0) {
        setModels(res.models)
        setModelsSource(res.source || 'local')
        setOnlineModelCount(res.onlineModelCount)
        if (!res.models.find(m => m.id === DEFAULT_PARAMS.model)) {
          const first = res.models[0]
          setParams(prev => ({
            ...prev,
            model: first.id,
            size: first.supportedSizes[0] || 'auto',
            resolution: first.supportedResolutions[0] || '',
            n: Math.min(prev.n, first.maxN),
          }))
        }
      }
    } catch {
      setModels([MODEL_FALLBACK])
      setModelsSource('local')
      setOnlineModelCount(undefined)
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const handleRefreshModels = useCallback(async () => {
    await loadModels(apiKey)
  }, [apiKey, loadModels])

  const handleUploadReferenceImages = useCallback(async (files: File[]) => {
    if (!apiKey.trim()) {
      throw new Error('请先填写 API Key，再上传参考图。')
    }
    return uploadReferenceImages(files, apiKey.trim())
  }, [apiKey])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetchHistory()
      if (res.success) {
        setHistory(res.history)
      }
    } catch {
      // History is optional; generation should not depend on it.
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const handleParamsChange = useCallback((partial: Partial<Omit<GenerateImageParams, 'apiKey'>>) => {
    setParams(prev => ({ ...prev, ...partial }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('请输入 APIMart API Key。')
      return
    }
    if (!params.prompt.trim()) {
      setError('请先写一段图像提示词。')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await generateImage({
        apiKey: apiKey.trim(),
        ...params,
      })

      if (response.success) {
        setImages(response.images)
        if (params.saveHistory) {
          loadHistory()
        }
      } else {
        setError('生成完成，但返回了未识别的响应。')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '发生意外错误，请稍后重试。'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [apiKey, params, loadHistory])

  const handleClearHistory = useCallback(async () => {
    try {
      await clearHistory()
      setHistory([])
    } catch (err) {
      const message = err instanceof Error ? err.message : '清空历史记录失败。'
      setError(message)
    }
  }, [])

  const handleRestore = useCallback((entry: HistoryEntry) => {
    const model = models.find(m => m.id === entry.params.model)
    setParams({
      model: entry.params.model || DEFAULT_PARAMS.model,
      prompt: entry.prompt,
      size: entry.params.size || DEFAULT_PARAMS.size,
      resolution: entry.params.resolution || DEFAULT_PARAMS.resolution,
      quality: entry.params.quality || DEFAULT_PARAMS.quality,
      output_format: entry.params.output_format || DEFAULT_PARAMS.output_format,
      background: entry.params.background || DEFAULT_PARAMS.background,
      moderation: entry.params.moderation || DEFAULT_PARAMS.moderation,
      output_compression: entry.params.output_compression,
      n: Math.min(entry.params.n || DEFAULT_PARAMS.n, model?.maxN || 4),
      image_urls: entry.params.image_urls,
      mask_url: entry.params.mask_url,
      saveHistory: entry.params.saveHistory ?? DEFAULT_PARAMS.saveHistory,
    })
    setImages(entry.images)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [models])

  const handleCopyParams = useCallback(async () => {
    const exportData = {
      model: params.model,
      prompt: params.prompt,
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
      output_format: params.output_format,
      background: params.background,
      moderation: params.moderation,
      output_compression: params.output_compression,
      n: params.n,
      image_urls: params.image_urls,
      mask_url: params.mask_url,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = JSON.stringify(exportData, null, 2)
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }, [params])

  const handleDismissError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <div className="min-h-screen app-shell text-ink-900">
      <header className="border-b border-ink-200/80 bg-paper/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="brand-mark" aria-hidden="true" />
              <h1 className="text-lg font-semibold tracking-tight text-ink-950">Image2API Console</h1>
            </div>
            <p className="mt-1 text-xs text-ink-500">GPT-Image-2 官方渠道图像生成工作台</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="status-pill">异步任务轮询</span>
            <span className="status-pill">最高 4K</span>
            <span className="status-pill">最多 4 张</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <ApiKeyCard
            apiKey={apiKey}
            rememberApiKey={rememberApiKey}
            modelsLoading={modelsLoading}
            modelsSource={modelsSource}
            onApiKeyChange={setApiKey}
            onRememberApiKeyChange={setRememberApiKey}
            onValidateApiKey={handleRefreshModels}
          />
          <ImageForm
            params={params}
            models={models}
            modelsLoading={modelsLoading}
            modelsSource={modelsSource}
            onlineModelCount={onlineModelCount}
            onParamsChange={handleParamsChange}
            onUploadReferenceImages={handleUploadReferenceImages}
            onSubmit={handleGenerate}
            loading={loading}
          />
          <HistoryPanel
            history={history}
            loading={historyLoading}
            onRefresh={loadHistory}
            onClearAll={handleClearHistory}
            onRestore={handleRestore}
          />
        </aside>

        <section className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="surface-panel p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-ink-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Result Preview</p>
                <h2 className="mt-1 text-xl font-semibold text-ink-950">生成结果</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="metric-box">
                  <span>{params.resolution || 'N/A'}</span>
                  <small>分辨率</small>
                </div>
                <div className="metric-box">
                  <span>{params.size}</span>
                  <small>比例</small>
                </div>
                <div className="metric-box">
                  <span>{params.n}</span>
                  <small>张数</small>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4">
                <ErrorAlert message={error} onDismiss={handleDismissError} />
              </div>
            )}

            {loading && (
              <div className="result-empty min-h-[520px]">
                <div className="task-orbit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <h3>任务已提交，正在等待出图</h3>
                <p>
                  APIMart 官方渠道会先返回 task_id，再轮询任务状态。首次查询通常等待 10-20 秒，
                  4K + high 可能超过 120 秒。
                </p>
              </div>
            )}

            {!loading && images.length > 0 && (
              <div className="mt-4">
                <ImageResult images={images} onCopyParams={handleCopyParams} />
              </div>
            )}

            {!loading && images.length === 0 && !error && (
              <div className="result-empty min-h-[520px]">
                <div className="empty-frame" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                </div>
                <h3>结果会显示在这里</h3>
                <p>
                  填入 API Key，写好提示词，然后选择比例、分辨率和输出格式。
                  当前模型：{currentModel?.name || '加载中'}。
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
