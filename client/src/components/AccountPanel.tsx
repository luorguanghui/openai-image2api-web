import { useState, useCallback } from 'react'
import type { AppSettings, BalanceResponse, PublicUser } from '../types/image'

interface AccountPanelProps {
  user: PublicUser
  settings: AppSettings
  onSaveApiKey: (apiKey: string) => Promise<void>
  onUpdatePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>
  onRefreshBalance: () => Promise<BalanceResponse>
  onLogout: () => void
}

const KEY_SOURCE_LABELS = {
  user: '我的 API Key',
  admin: '管理员全局 Key',
  env: '服务器环境变量',
} as const

export default function AccountPanel({
  user,
  settings,
  onSaveApiKey,
  onUpdatePassword,
  onRefreshBalance,
  onLogout,
}: AccountPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      await onSaveApiKey(apiKey)
      setApiKey('')
      setMessage('已保存个人 API Key。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }, [apiKey, onSaveApiKey])

  const handleBalance = useCallback(async () => {
    setChecking(true)
    setMessage(null)
    try {
      const nextBalance = await onRefreshBalance()
      setBalance(nextBalance)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '余额查询失败。')
    } finally {
      setChecking(false)
    }
  }, [onRefreshBalance])

  const handleUpdatePassword = useCallback(async () => {
    setPasswordMessage(null)
    if (newPassword !== confirmPassword) {
      setPasswordMessage('两次输入的新密码不一致。')
      return
    }

    setSavingPassword(true)
    try {
      await onUpdatePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('密码已更新。')
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : '修改密码失败。')
    } finally {
      setSavingPassword(false)
    }
  }, [confirmPassword, currentPassword, newPassword, onUpdatePassword])

  const keySource = settings.effectiveKeySource
    ? KEY_SOURCE_LABELS[settings.effectiveKeySource]
    : '未配置'

  return (
    <section className="surface-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-label">账户</h2>
          <p className="mt-1 text-xs text-ink-500">{user.username} · {user.role === 'admin' ? '管理员' : '用户'}</p>
        </div>
        <button type="button" onClick={onLogout} className="btn-secondary">退出</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="metric-box">
          <span>{keySource}</span>
          <small>当前密钥来源</small>
        </div>
        <div className="metric-box">
          <span>{user.hasApiKey ? '已填写' : '未填写'}</span>
          <small>个人 Key</small>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="user-api-key" className="label-text">我的 API Key</label>
          <input
            id="user-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={settings.userApiKeysEnabled ? 'sk-...' : '管理员已关闭用户 Key'}
            className="input-field text-sm"
            disabled={!settings.userApiKeysEnabled}
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !settings.userApiKeysEnabled}
            className="btn-secondary flex-1"
          >
            {saving ? '保存中...' : '保存个人 Key'}
          </button>
          <button
            type="button"
            onClick={handleBalance}
            disabled={checking}
            className="btn-secondary flex-1"
          >
            {checking ? '查询中...' : '查询余额'}
          </button>
        </div>
        {balance && (
          <div className="rounded-lg border border-ink-200 bg-white/60 px-3 py-2 text-xs text-ink-700">
            <p>来源：{KEY_SOURCE_LABELS[balance.source]}</p>
            <p>
              {balance.balance.unlimited_quota
                ? '无限额度'
                : `剩余 ${balance.balance.remain_balance ?? '-'}，已用 ${balance.balance.used_balance ?? '-'}`}
            </p>
          </div>
        )}
        {message && <p className="text-xs text-ink-500">{message}</p>}

        <div className="rounded-lg border border-ink-200 bg-white/45">
          <button
            type="button"
            onClick={() => setPasswordOpen(value => !value)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
          >
            <span className="text-xs font-bold text-ink-800">修改密码</span>
            <span className="text-button">{passwordOpen ? '收起' : '展开'}</span>
          </button>

          {passwordOpen && (
            <div className="space-y-2 border-t border-ink-200 px-3 py-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="当前密码"
                className="input-field text-sm"
                autoComplete="current-password"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="新密码"
                className="input-field text-sm"
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="确认新密码"
                className="input-field text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="btn-secondary w-full"
              >
                {savingPassword ? '更新中...' : '更新密码'}
              </button>
              {passwordMessage && <p className="text-xs text-ink-500">{passwordMessage}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
