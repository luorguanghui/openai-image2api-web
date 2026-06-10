import { useState, useCallback, useEffect, useMemo } from 'react'
import AdminPanel from './components/AdminPanel'
import AccountPanel from './components/AccountPanel'
import ConversationThread from './components/ConversationThread'
import ImageForm from './components/ImageForm'
import HistoryPanel from './components/HistoryPanel'
import ErrorAlert from './components/ErrorAlert'
import LoginView from './components/LoginView'
import {
  createAdminUser,
  clearHistory,
  fetchAdminUsers,
  fetchBalance,
  fetchHistory,
  fetchMe,
  fetchModels,
  generateImage,
  login,
  logout,
  setAuthToken,
  updateAdminSettings,
  updateAdminUser,
  updateMyApiKey,
  updateMyPassword,
  uploadReferenceImages,
} from './api/imageApi'
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AppSettings,
  BalanceResponse,
  ConversationTurn,
  GenerateImageParams,
  GeneratedImage,
  HistoryEntry,
  ModelInfo,
  PublicUser,
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
  supportedSizes: ['auto', '1:1', '3:2', '2:3', '3:4', '4:3', '16:9', '9:16'],
  supportedResolutions: ['1k', '2k', '4k'],
  supportedQualities: ['auto'],
  supportedOutputFormats: ['png'],
  supportsImageUrls: true,
  supportsBase64ImageUrls: true,
  supportsMask: false,
  requestMode: 'async',
}

const AUTH_TOKEN_STORAGE_KEY = 'image2api.authToken'

const DEFAULT_SETTINGS: AppSettings = {
  hasGlobalApiKey: false,
  userApiKeysEnabled: true,
}

function sortTurns(turns: ConversationTurn[]): ConversationTurn[] {
  return [...turns].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function turnsForConversation(history: HistoryEntry[], conversationId: string): ConversationTurn[] {
  return sortTurns(history.find(entry => entry.conversationId === conversationId)?.turns || [])
}

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [params, setParams] = useState<Omit<GenerateImageParams, 'apiKey'>>(DEFAULT_PARAMS)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyScope, setHistoryScope] = useState<'own' | 'all'>('own')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([])
  const [pendingTurn, setPendingTurn] = useState<{
    prompt: string
    createdAt: string
    continueFromLastImage: boolean
  } | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsSource, setModelsSource] = useState<'local' | 'online'>('local')
  const [onlineModelCount, setOnlineModelCount] = useState<number | undefined>()
  const [modelsLoading, setModelsLoading] = useState(false)
  const [adminUsers, setAdminUsers] = useState<PublicUser[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  const currentModel = models.find(model => model.id === params.model)

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const res = await fetchModels()
      if (res.success && res.models.length > 0) {
        setModels(res.models)
        setModelsSource(res.source || 'local')
        setOnlineModelCount(res.onlineModelCount)
      }
    } catch {
      setModels([MODEL_FALLBACK])
      setModelsSource('local')
      setOnlineModelCount(undefined)
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async (
    scope: 'own' | 'all' = historyScope,
    activeConversationId = conversationId
  ) => {
    setHistoryLoading(true)
    try {
      const res = await fetchHistory(scope)
      if (res.success) {
        setHistory(res.history)
        if (activeConversationId) {
          setConversationTurns(turnsForConversation(res.history, activeConversationId))
        }
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [conversationId, historyScope])

  const loadAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true)
    try {
      const res = await fetchAdminUsers()
      if (res.success) {
        setAdminUsers(res.users)
      }
    } finally {
      setAdminUsersLoading(false)
    }
  }, [])

  const refreshMe = useCallback(async () => {
    const me = await fetchMe()
    if (me.success) {
      setUser(me.user)
      setSettings(me.settings)
    }
  }, [])

  const initializeWorkspace = useCallback(async (scope: 'own' | 'all' = 'own') => {
    await Promise.all([
      loadModels(),
      loadHistory(scope, null),
    ])
  }, [loadHistory, loadModels])

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
    if (!token) {
      setBooting(false)
      return
    }

    setAuthToken(token)
    fetchMe()
      .then(async (me) => {
        if (me.success) {
          setUser(me.user)
          setSettings(me.settings)
          await initializeWorkspace('own')
          if (me.user.role === 'admin') {
            await loadAdminUsers()
          }
        }
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
        setAuthToken('')
      })
      .finally(() => setBooting(false))
  }, [initializeWorkspace, loadAdminUsers])

  const handleLogin = useCallback(async (username: string, password: string) => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await login(username, password)
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.token)
      setAuthToken(res.token)
      setUser(res.user)
      setSettings(res.settings)
      setHistoryScope('own')
      await initializeWorkspace('own')
      if (res.user.role === 'admin') {
        await loadAdminUsers()
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登录失败。')
    } finally {
      setLoginLoading(false)
    }
  }, [initializeWorkspace, loadAdminUsers])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // 本地退出不依赖服务端响应。
    }
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setAuthToken('')
    setUser(null)
    setSettings(DEFAULT_SETTINGS)
    setImages([])
    setHistory([])
    setConversationId(null)
    setConversationTurns([])
    setError(null)
  }, [])

  const handleSaveMyApiKey = useCallback(async (apiKey: string) => {
    const res = await updateMyApiKey(apiKey)
    if (res.success) {
      setUser(res.user)
      await refreshMe()
      await loadModels()
    }
  }, [loadModels, refreshMe])

  const handleUpdateMyPassword = useCallback(async (input: { currentPassword: string; newPassword: string }) => {
    await updateMyPassword(input)
  }, [])

  const handleRefreshBalance = useCallback(async (): Promise<BalanceResponse> => {
    return fetchBalance()
  }, [])

  const handleSaveAdminSettings = useCallback(async (input: { globalApiKey?: string; userApiKeysEnabled?: boolean }) => {
    const res = await updateAdminSettings(input)
    if (res.success) {
      setSettings(prev => ({ ...prev, ...res.settings }))
      await refreshMe()
      await loadModels()
    }
  }, [loadModels, refreshMe])

  const handleCreateAdminUser = useCallback(async (input: AdminCreateUserInput) => {
    await createAdminUser(input)
    await loadAdminUsers()
  }, [loadAdminUsers])

  const handleUpdateAdminUser = useCallback(async (id: string, input: AdminUpdateUserInput) => {
    await updateAdminUser(id, input)
    await loadAdminUsers()
  }, [loadAdminUsers])

  const handleHistoryScopeChange = useCallback(async (scope: 'own' | 'all') => {
    setHistoryScope(scope)
    await loadHistory(scope, conversationId)
  }, [conversationId, loadHistory])

  const handleUploadReferenceImages = useCallback(async (files: File[]) => {
    return uploadReferenceImages(files)
  }, [])

  const handleParamsChange = useCallback((partial: Partial<Omit<GenerateImageParams, 'apiKey'>>) => {
    setParams(prev => ({ ...prev, ...partial }))
  }, [])

  const activeHistory = useMemo(() => history, [history])

  const handleGenerate = useCallback(async () => {
    if (!user) {
      setError('请先登录。')
      return
    }
    if (!settings.effectiveKeySource) {
      setError('请先配置 API Key：管理员可设置全局 Key，或启用用户 Key 后由用户填写。')
      return
    }
    if (!params.prompt.trim()) {
      setError('请先写一段图像提示词。')
      return
    }

    const continueFromLastImage = Boolean(
      conversationId &&
      conversationTurns.length > 0 &&
      images.length > 0 &&
      currentModel?.supportsImageUrls
    )

    setError(null)
    setLoading(true)
    setPendingTurn({
      prompt: params.prompt.trim(),
      createdAt: new Date().toISOString(),
      continueFromLastImage,
    })

    try {
      const response = await generateImage({
        ...params,
        prompt: params.prompt.trim(),
        conversationId: conversationId || undefined,
        continueFromLastImage,
      })

      if (response.success) {
        const turn: ConversationTurn = {
          id: response.images[0]?.id || `turn-${Date.now()}`,
          prompt: response.params.prompt,
          params: response.params,
          images: response.images,
          createdAt: response.createdAt,
          model: response.params.model,
        }
        setImages(response.images)
        setConversationId(response.conversationId)
        setConversationTurns(prev => (
          conversationId === response.conversationId || !conversationId
            ? sortTurns([...prev, turn])
            : [turn]
        ))
        setParams(prev => ({ ...prev, prompt: '' }))
        if (params.saveHistory) {
          await loadHistory(historyScope, response.conversationId)
        }
      } else {
        setError('生成完成，但返回了未识别的响应。')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '发生意外错误，请稍后重试。'
      setError(message)
    } finally {
      setPendingTurn(null)
      setLoading(false)
    }
  }, [
    conversationId,
    conversationTurns.length,
    currentModel?.supportsImageUrls,
    historyScope,
    images.length,
    loadHistory,
    params,
    settings.effectiveKeySource,
    user,
  ])

  const handleClearHistory = useCallback(async () => {
    try {
      await clearHistory(historyScope)
      setHistory([])
      setConversationTurns([])
      setConversationId(null)
      setImages([])
    } catch (err) {
      const message = err instanceof Error ? err.message : '清空历史记录失败。'
      setError(message)
    }
  }, [historyScope])

  const handleRestore = useCallback((entry: HistoryEntry) => {
    const sortedTurns = sortTurns(entry.turns)
    const latestTurn = sortedTurns[sortedTurns.length - 1]
    const restoreParams = latestTurn?.params || entry.params
    const restoreImages = latestTurn?.images || entry.images
    const model = models.find(m => m.id === restoreParams.model)
    setParams({
      model: restoreParams.model || DEFAULT_PARAMS.model,
      prompt: '',
      size: restoreParams.size || DEFAULT_PARAMS.size,
      resolution: restoreParams.resolution || DEFAULT_PARAMS.resolution,
      quality: restoreParams.quality || DEFAULT_PARAMS.quality,
      output_format: restoreParams.output_format || DEFAULT_PARAMS.output_format,
      background: restoreParams.background || DEFAULT_PARAMS.background,
      moderation: restoreParams.moderation || DEFAULT_PARAMS.moderation,
      output_compression: restoreParams.output_compression,
      n: Math.min(restoreParams.n || DEFAULT_PARAMS.n, model?.maxN || 4),
      image_urls: restoreParams.image_urls,
      mask_url: restoreParams.mask_url,
      saveHistory: DEFAULT_PARAMS.saveHistory,
      conversationId: entry.conversationId,
    })
    setConversationId(entry.conversationId)
    setConversationTurns(sortedTurns)
    setImages(restoreImages)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [models])

  const handleNewConversation = useCallback(() => {
    const defaultModel = models.find(model => model.id === DEFAULT_PARAMS.model) || models[0]
    const nextParams = { ...DEFAULT_PARAMS, saveHistory: params.saveHistory }

    if (defaultModel) {
      nextParams.model = defaultModel.id
      nextParams.size = defaultModel.supportedSizes.includes(DEFAULT_PARAMS.size)
        ? DEFAULT_PARAMS.size
        : defaultModel.supportedSizes[0] || DEFAULT_PARAMS.size
      nextParams.resolution = defaultModel.supportedResolutions.includes(DEFAULT_PARAMS.resolution)
        ? DEFAULT_PARAMS.resolution
        : defaultModel.supportedResolutions[0] || ''
      nextParams.quality = defaultModel.supportedQualities.includes(DEFAULT_PARAMS.quality)
        ? DEFAULT_PARAMS.quality
        : (defaultModel.supportedQualities[0] as typeof DEFAULT_PARAMS.quality) || DEFAULT_PARAMS.quality
      nextParams.output_format = defaultModel.supportedOutputFormats?.includes(DEFAULT_PARAMS.output_format)
        ? DEFAULT_PARAMS.output_format
        : (defaultModel.supportedOutputFormats?.[0] as typeof DEFAULT_PARAMS.output_format) || DEFAULT_PARAMS.output_format
      nextParams.n = Math.min(DEFAULT_PARAMS.n, defaultModel.maxN)
    }

    setParams(nextParams)
    setImages([])
    setConversationId(null)
    setConversationTurns([])
    setPendingTurn(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [models, params.saveHistory])

  if (booting) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="task-orbit mx-auto" aria-hidden="true"><span /><span /><span /></div>
          <p className="mt-5 text-center text-sm text-ink-500">正在恢复登录状态...</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <LoginView loading={loginLoading} error={loginError} onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen app-shell text-ink-900">
      <header className="border-b border-ink-200/80 bg-paper/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="brand-mark" aria-hidden="true" />
              <h1 className="text-lg font-semibold tracking-tight text-ink-950">Image2API Console</h1>
            </div>
            <p className="mt-1 text-xs text-ink-500">带登录权限和对话记录隔离的图像生成工作台</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="status-pill">{settings.effectiveKeySource ? 'Key 已就绪' : 'Key 未配置'}</span>
            <span className="status-pill">{historyScope === 'all' ? '管理员视图' : '个人视图'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <AccountPanel
            user={user}
            settings={settings}
            onSaveApiKey={handleSaveMyApiKey}
            onUpdatePassword={handleUpdateMyPassword}
            onRefreshBalance={handleRefreshBalance}
            onLogout={handleLogout}
          />
          {user.role === 'admin' && (
            <AdminPanel
              settings={settings}
              users={adminUsers}
              loading={adminUsersLoading}
              onSaveSettings={handleSaveAdminSettings}
              onCreateUser={handleCreateAdminUser}
              onUpdateUser={handleUpdateAdminUser}
              onRefreshUsers={loadAdminUsers}
            />
          )}
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
          {user.role === 'admin' && (
            <section className="surface-panel p-4">
              <h2 className="section-label">历史范围</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleHistoryScopeChange('own')}
                  className={historyScope === 'own' ? 'btn-primary compact' : 'btn-secondary'}
                >
                  我的
                </button>
                <button
                  type="button"
                  onClick={() => handleHistoryScopeChange('all')}
                  className={historyScope === 'all' ? 'btn-primary compact' : 'btn-secondary'}
                >
                  全部
                </button>
              </div>
            </section>
          )}
          <HistoryPanel
            history={activeHistory}
            loading={historyLoading}
            onRefresh={() => loadHistory(historyScope, conversationId)}
            onClearAll={handleClearHistory}
            onRestore={handleRestore}
          />
        </aside>

        <section className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="surface-panel p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-ink-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Conversation</p>
                <h2 className="mt-1 text-xl font-semibold text-ink-950">生成对话</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleNewConversation}
                  disabled={loading}
                  className="btn-secondary"
                >
                  新建对话
                </button>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="metric-box">
                    <span>{conversationTurns.length}</span>
                    <small>轮次</small>
                  </div>
                  <div className="metric-box">
                    <span>{params.size}</span>
                    <small>比例</small>
                  </div>
                  <div className="metric-box">
                    <span>{params.resolution || 'N/A'}</span>
                    <small>分辨率</small>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4">
                <ErrorAlert message={error} onDismiss={() => setError(null)} />
              </div>
            )}

            <ConversationThread turns={conversationTurns} pendingTurn={pendingTurn} />
          </div>
        </section>
      </main>
    </div>
  )
}
