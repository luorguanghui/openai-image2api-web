import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyRound,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import type { AdminCreateUserInput, AdminUpdateUserInput, AppSettings, PublicUser, UserRole } from '../types/image'

interface AdminPanelProps {
  settings: AppSettings
  users: PublicUser[]
  loading: boolean
  onSaveSettings: (input: { globalApiKey?: string; userApiKeysEnabled?: boolean }) => Promise<void>
  onCreateUser: (input: AdminCreateUserInput) => Promise<void>
  onUpdateUser: (id: string, input: AdminUpdateUserInput) => Promise<void>
  onRefreshUsers: () => Promise<void>
}

const roleLabel: Record<UserRole, string> = {
  admin: '管理员',
  user: '用户',
}

export default function AdminPanel({
  settings,
  users,
  loading,
  onSaveSettings,
  onCreateUser,
  onUpdateUser,
  onRefreshUsers,
}: AdminPanelProps) {
  const [globalApiKey, setGlobalApiKey] = useState('')
  const [userApiKeysEnabled, setUserApiKeysEnabled] = useState(settings.userApiKeysEnabled)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [newCanUseAdminApiKey, setNewCanUseAdminApiKey] = useState(true)
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setUserApiKeysEnabled(settings.userApiKeysEnabled)
  }, [settings.userApiKeysEnabled])

  const stats = useMemo(() => {
    const enabled = users.filter(user => user.enabled).length
    const admins = users.filter(user => user.role === 'admin').length
    const withKey = users.filter(user => user.hasApiKey).length
    return { enabled, admins, withKey }
  }, [users])

  const handleSaveSettings = useCallback(async () => {
    setMessage(null)
    try {
      await onSaveSettings({
        ...(globalApiKey.trim() ? { globalApiKey: globalApiKey.trim() } : {}),
        userApiKeysEnabled,
      })
      setGlobalApiKey('')
      setMessage('管理员设置已保存。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存管理员设置失败。')
    }
  }, [globalApiKey, onSaveSettings, userApiKeysEnabled])

  const handleCreateUser = useCallback(async () => {
    setMessage(null)
    try {
      await onCreateUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        enabled: true,
        canUseAdminApiKey: newCanUseAdminApiKey,
      })
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      setNewCanUseAdminApiKey(true)
      setMessage('用户已创建。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '创建用户失败。')
    }
  }, [newCanUseAdminApiKey, newPassword, newRole, newUsername, onCreateUser])

  const handleUpdateUser = useCallback(async (id: string, input: AdminUpdateUserInput) => {
    setMessage(null)
    try {
      await onUpdateUser(id, input)
      setMessage('用户已更新。')
      return true
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '更新用户失败。')
      return false
    }
  }, [onUpdateUser])

  const handleResetPassword = useCallback(async (id: string) => {
    const password = resetPasswords[id] || ''
    if (!password) {
      setMessage('请输入新的密码。')
      return
    }

    const updated = await handleUpdateUser(id, { password })
    if (updated) {
      setResetPasswords(prev => ({ ...prev, [id]: '' }))
    }
  }, [handleUpdateUser, resetPasswords])

  return (
    <section className="admin-workspace min-w-0">
      <div className="admin-hero">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Admin</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink-950">管理中心</h2>
          <p className="mt-2 text-sm text-ink-600">全局 Key、用户注册、权限和账号状态</p>
        </div>
        <div className="admin-stat-strip">
          <div className="metric-box">
            <span>{users.length}</span>
            <small>总用户</small>
          </div>
          <div className="metric-box">
            <span>{stats.enabled}</span>
            <small>已启用</small>
          </div>
          <div className="metric-box">
            <span>{stats.admins}</span>
            <small>管理员</small>
          </div>
          <div className="metric-box">
            <span>{stats.withKey}</span>
            <small>个人 Key</small>
          </div>
        </div>
      </div>

      {message && <p className="admin-message">{message}</p>}

      <div className="admin-settings-grid">
        <section className="surface-panel admin-section">
          <div className="admin-section-header">
            <span className="panel-icon" aria-hidden="true"><KeyRound size={18} /></span>
            <div>
              <h3>Key 设置</h3>
              <p>{settings.hasGlobalApiKey ? '全局 Key 已配置' : '全局 Key 未配置'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label htmlFor="admin-global-key" className="label-text">全局 API Key</label>
              <input
                id="admin-global-key"
                type="password"
                value={globalApiKey}
                onChange={(event) => setGlobalApiKey(event.target.value)}
                placeholder="留空则不修改"
                className="input-field text-sm"
                autoComplete="off"
              />
            </div>
            <label className="admin-switch-field self-end">
              <input
                type="checkbox"
                checked={userApiKeysEnabled}
                onChange={(event) => setUserApiKeysEnabled(event.target.checked)}
              />
              <span>用户个人 Key</span>
            </label>
          </div>

          <button type="button" onClick={handleSaveSettings} className="btn-secondary btn-icon-label mt-4">
            <Save size={16} />
            保存设置
          </button>
        </section>

        <section className="surface-panel admin-section">
          <div className="admin-section-header">
            <span className="panel-icon" aria-hidden="true"><UserPlus size={18} /></span>
            <div>
              <h3>创建用户</h3>
              <p>管理员创建的用户可单独授权全局 Key</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="用户名"
              className="input-field text-sm"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="初始密码"
              className="input-field text-sm"
            />
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as UserRole)}
              className="select-field text-sm"
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
            <label className="admin-switch-field">
              <input
                type="checkbox"
                checked={newCanUseAdminApiKey}
                onChange={(event) => setNewCanUseAdminApiKey(event.target.checked)}
              />
              <span>允许管理员 Key</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreateUser}
            disabled={!newUsername.trim() || !newPassword}
            className="btn-secondary btn-icon-label mt-4"
          >
            <UserPlus size={16} />
            创建用户
          </button>
        </section>
      </div>

      <section className="surface-panel admin-section">
        <div className="admin-section-header admin-users-heading">
          <span className="panel-icon" aria-hidden="true"><Users size={18} /></span>
          <div>
            <h3>用户管理</h3>
            <p>角色、启用状态、管理员 Key 授权和密码重置</p>
          </div>
          <button type="button" onClick={onRefreshUsers} disabled={loading} className="btn-secondary btn-icon-label">
            <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>

        <div className="admin-user-list">
          {users.map(user => (
            <article key={user.id} className="admin-user-row">
              <div className="admin-user-main">
                <span className={user.role === 'admin' ? 'user-role-icon is-admin' : 'user-role-icon'} aria-hidden="true">
                  {user.role === 'admin' ? <ShieldCheck size={18} /> : <Shield size={18} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{user.username}</p>
                  <p className="text-xs text-ink-500">
                    {roleLabel[user.role]} · {user.enabled ? '启用' : '停用'} · {user.hasApiKey ? '有个人 Key' : '无个人 Key'}
                  </p>
                </div>
              </div>

              <div className="admin-user-controls">
                <label>
                  <span>角色</span>
                  <select
                    value={user.role}
                    onChange={(event) => handleUpdateUser(user.id, { role: event.target.value as UserRole })}
                    className="select-field admin-user-role text-sm"
                  >
                    <option value="user">用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </label>
                <label className="admin-switch-field">
                  <input
                    type="checkbox"
                    checked={user.enabled}
                    onChange={(event) => handleUpdateUser(user.id, { enabled: event.target.checked })}
                  />
                  <span>{user.enabled ? '启用' : '停用'}</span>
                </label>
                <label className="admin-switch-field">
                  <input
                    type="checkbox"
                    checked={user.canUseAdminApiKey ?? true}
                    onChange={(event) => handleUpdateUser(user.id, { canUseAdminApiKey: event.target.checked })}
                  />
                  <span>管理员 Key</span>
                </label>
              </div>

              <div className="admin-user-reset">
                <input
                  type="password"
                  value={resetPasswords[user.id] || ''}
                  onChange={(event) => setResetPasswords(prev => ({ ...prev, [user.id]: event.target.value }))}
                  placeholder="重置密码"
                  className="input-field text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => handleResetPassword(user.id)}
                  className="btn-secondary btn-icon-label"
                >
                  <RotateCcw size={16} />
                  重置
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
