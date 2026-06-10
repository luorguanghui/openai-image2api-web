import { useCallback, useState } from 'react'
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

export default function AdminPanel({
  settings,
  users,
  loading,
  onSaveSettings,
  onCreateUser,
  onUpdateUser,
  onRefreshUsers,
}: AdminPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [globalApiKey, setGlobalApiKey] = useState('')
  const [userApiKeysEnabled, setUserApiKeysEnabled] = useState(settings.userApiKeysEnabled)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [newCanUseAdminApiKey, setNewCanUseAdminApiKey] = useState(true)
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

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
        username: newUsername,
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
    <section className="surface-panel p-4">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="section-label">管理员</h2>
          <p className="mt-1 text-xs text-ink-500">全局 Key、用户启用和权限</p>
        </div>
        <span className="text-button">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-ink-200 pt-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="metric-box">
              <span>{settings.hasGlobalApiKey ? '已配置' : '未配置'}</span>
              <small>全局 Key</small>
            </div>
            <div className="metric-box">
              <span>{settings.userApiKeysEnabled ? '已启用' : '已关闭'}</span>
              <small>用户 Key</small>
            </div>
          </div>

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
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={userApiKeysEnabled}
              onChange={(event) => setUserApiKeysEnabled(event.target.checked)}
            />
            <span>允许用户使用自己的 API Key</span>
          </label>
          <button type="button" onClick={handleSaveSettings} className="btn-secondary w-full">
            保存管理员设置
          </button>

          <div className="rounded-lg border border-ink-200 bg-white/50 p-3">
            <h3 className="text-sm font-semibold text-ink-950">创建用户</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              <label className="toggle-row justify-start rounded-lg border border-ink-200 bg-white/55 px-3 py-2">
                <input
                  type="checkbox"
                  checked={newCanUseAdminApiKey}
                  onChange={(event) => setNewCanUseAdminApiKey(event.target.checked)}
                />
                <span>允许管理员 Key</span>
              </label>
              <button type="button" onClick={handleCreateUser} className="btn-secondary">
                创建
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-950">用户列表</h3>
              <button type="button" onClick={onRefreshUsers} disabled={loading} className="btn-secondary">
                {loading ? '刷新中...' : '刷新'}
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {users.map(user => (
                <article key={user.id} className="admin-user-row">
                  <div className="min-w-0 admin-user-main">
                    <p className="truncate text-sm font-semibold text-ink-900">{user.username}</p>
                    <p className="text-xs text-ink-500">
                      {user.role === 'admin' ? '管理员' : '用户'} · {user.hasApiKey ? '有个人 Key' : '无个人 Key'}
                    </p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(event) => handleUpdateUser(user.id, { role: event.target.value as UserRole })}
                    className="select-field admin-user-role text-sm"
                  >
                    <option value="user">用户</option>
                    <option value="admin">管理员</option>
                  </select>
                  <div className="admin-user-toggles">
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={user.enabled}
                        onChange={(event) => handleUpdateUser(user.id, { enabled: event.target.checked })}
                      />
                      <span>{user.enabled ? '启用' : '停用'}</span>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={user.canUseAdminApiKey ?? true}
                        onChange={(event) => handleUpdateUser(user.id, { canUseAdminApiKey: event.target.checked })}
                      />
                      <span>允许使用管理员 Key</span>
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
                      className="btn-secondary"
                    >
                      重置
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          {message && <p className="text-xs text-ink-500">{message}</p>}
        </div>
      )}
    </section>
  )
}
