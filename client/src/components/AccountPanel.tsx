import { useState, useCallback } from 'react'
import {
  ChevronDown,
  KeyRound,
  LockKeyhole,
  LogOut,
  Save,
  UserRound,
  WalletCards,
} from 'lucide-react'
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
    <section className="surface-panel account-panel">
      <div className="account-header">
        <div className="account-title">
          <span className="panel-icon" aria-hidden="true"><UserRound size={18} /></span>
          <div className="min-w-0">
            <h2 className="section-label">账户</h2>
            <p className="truncate text-xs text-ink-500">{user.username} · {user.role === 'admin' ? '管理员' : '用户'}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="btn-secondary btn-icon-label">
          <LogOut size={16} />
          退出
        </button>
      </div>

      <div className="account-status-grid">
        <div className="metric-box">
          <span>{keySource}</span>
          <small>当前 Key</small>
        </div>
        <div className="metric-box">
          <span>{user.hasApiKey ? '已填写' : '未填写'}</span>
          <small>个人 Key</small>
        </div>
      </div>

      {!settings.effectiveKeySource && (
        <p className="account-note">当前账号需要个人 Key 或管理员授权。</p>
      )}

      <div className="account-section">
        <div className="account-section-title">
          <KeyRound size={16} />
          <h3>我的 API Key</h3>
        </div>
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
        <div className="account-button-row">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !settings.userApiKeysEnabled}
            className="btn-secondary btn-icon-label"
          >
            <Save size={16} />
            {saving ? '保存中...' : '保存 Key'}
          </button>
          <button
            type="button"
            onClick={handleBalance}
            disabled={checking}
            className="btn-secondary btn-icon-label"
          >
            <WalletCards size={16} />
            {checking ? '查询中...' : '查询余额'}
          </button>
        </div>
        {balance && (
          <div className="account-balance">
            <p>来源：{KEY_SOURCE_LABELS[balance.source]}</p>
            <p>
              {balance.balance.unlimited_quota
                ? '无限额度'
                : `剩余 ${balance.balance.remain_balance ?? '-'}，已用 ${balance.balance.used_balance ?? '-'}`}
            </p>
          </div>
        )}
        {message && <p className="text-xs text-ink-500">{message}</p>}
      </div>

      <div className="account-section">
        <button
          type="button"
          onClick={() => setPasswordOpen(value => !value)}
          className="account-collapse-button"
        >
          <span className="account-section-title">
            <LockKeyhole size={16} />
            <span>修改密码</span>
          </span>
          <ChevronDown size={16} className={passwordOpen ? 'rotate-180' : ''} />
        </button>

        {passwordOpen && (
          <div className="account-password-form">
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
              className="btn-secondary btn-icon-label w-full"
            >
              <Save size={16} />
              {savingPassword ? '更新中...' : '更新密码'}
            </button>
            {passwordMessage && <p className="text-xs text-ink-500">{passwordMessage}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
