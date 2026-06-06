import { useState, useCallback } from 'react'

interface ApiKeyCardProps {
  apiKey: string
  rememberApiKey: boolean
  modelsLoading: boolean
  modelsSource: 'local' | 'online'
  onApiKeyChange: (key: string) => void
  onRememberApiKeyChange: (remember: boolean) => void
  onValidateApiKey: () => void
}

export default function ApiKeyCard({
  apiKey,
  rememberApiKey,
  modelsLoading,
  modelsSource,
  onApiKeyChange,
  onRememberApiKeyChange,
  onValidateApiKey
}: ApiKeyCardProps) {
  const [visible, setVisible] = useState(false)

  const toggleVisibility = useCallback(() => {
    setVisible(v => !v)
  }, [])

  return (
    <section className="surface-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-label">API Key</h2>
          <p className="mt-1 text-xs text-ink-500">
            默认只保存在当前页面；勾选后会写入浏览器 localStorage。
          </p>
        </div>
        <span className={apiKey.trim() ? 'key-state is-ready' : 'key-state'}>{apiKey.trim() ? '已填写' : '必填'}</span>
      </div>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="sk-..."
          className="input-field pr-20 text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-2 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
          aria-label={visible ? '隐藏 API Key' : '显示 API Key'}
        >
          {visible ? '隐藏' : '显示'}
        </button>
      </div>
      <label className="toggle-row mt-3">
        <input
          type="checkbox"
          checked={rememberApiKey}
          onChange={(e) => onRememberApiKeyChange(e.target.checked)}
        />
        <span>保存在本地浏览器</span>
      </label>
      <button
        type="button"
        onClick={onValidateApiKey}
        disabled={!apiKey.trim() || modelsLoading}
        className="btn-secondary mt-3 w-full"
      >
        {modelsLoading ? '正在验证并更新模型...' : '验证 Key 并在线更新模型'}
      </button>
      <p className="mt-2 text-xs text-ink-500">
        当前模型来源：{modelsSource === 'online' ? '在线模型列表' : '本地兼容列表'}
      </p>
    </section>
  )
}
