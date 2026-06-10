import { useState, useCallback } from 'react'
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react'

interface LoginViewProps {
  loading: boolean
  error: string | null
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  onClearError: () => void
}

type AuthMode = 'login' | 'register'

export default function LoginView({ loading, error, onLogin, onRegister, onClearError }: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleModeChange = useCallback((nextMode: AuthMode) => {
    setMode(nextMode)
    setLocalError(null)
    setConfirmPassword('')
    onClearError()
  }, [onClearError])

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    onClearError()

    if (mode === 'register') {
      if (password.length < 6) {
        setLocalError('密码至少需要 6 位。')
        return
      }
      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致。')
        return
      }
      await onRegister(username, password)
      return
    }

    await onLogin(username, password)
  }, [confirmPassword, mode, onClearError, onLogin, onRegister, password, username])

  const message = localError || error

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="flex items-center gap-2">
          <span className="brand-mark" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight text-ink-950">Image2API Console</h1>
        </div>
        <div className="mt-6 flex items-start gap-3">
          <span className="login-badge" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-950">
              {mode === 'login' ? '登录工作台' : '注册账号'}
            </h2>
          </div>
        </div>

        <div className="auth-tabs mt-6" role="tablist" aria-label="认证方式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => handleModeChange('login')}
            className={mode === 'login' ? 'auth-tab is-active' : 'auth-tab'}
          >
            <LogIn size={16} />
            账号登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => handleModeChange('register')}
            className={mode === 'register' ? 'auth-tab is-active' : 'auth-tab'}
          >
            <UserPlus size={16} />
            注册账号
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="login-username" className="label-text">用户名</label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="input-field"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="label-text">密码</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          {mode === 'register' && (
            <div>
              <label htmlFor="login-confirm-password" className="label-text">确认密码</label>
              <input
                id="login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-field"
                autoComplete="new-password"
                required
              />
            </div>
          )}
          {message && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary btn-icon-label">
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? (mode === 'login' ? '登录中...' : '注册中...') : (mode === 'login' ? '登录' : '注册并进入')}
          </button>
        </form>
      </section>
    </main>
  )
}
