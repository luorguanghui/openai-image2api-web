import { useState, useCallback } from 'react'

interface LoginViewProps {
  loading: boolean
  error: string | null
  onLogin: (username: string, password: string) => Promise<void>
}

export default function LoginView({ loading, error, onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    await onLogin(username, password)
  }, [onLogin, password, username])

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="flex items-center gap-2">
          <span className="brand-mark" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight text-ink-950">Image2API Console</h1>
        </div>
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">Sign in</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink-950">登录工作台</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
