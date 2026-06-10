import type {
  GenerateImageParams,
  GenerateImageResponse,
  HistoryResponse,
  ModelsResponse,
  ApiError,
  AuthResponse,
  MeResponse,
  BalanceResponse,
  SettingsResponse,
  UsersResponse,
  PublicUser,
  AdminCreateUserInput,
  AdminUpdateUserInput,
} from '../types/image'

const API_BASE = '/api'

let authToken = ''

export function setAuthToken(token: string) {
  authToken = token
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(extra || {}),
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const err = data as ApiError | null
    throw new Error(err?.error?.message || `${fallbackMessage} (${response.status})`)
  }
  return data as T
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return parseJsonResponse<AuthResponse>(response, '登录失败')
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
  return parseJsonResponse<MeResponse>(response, '获取当前用户失败')
}

export async function logout(): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseJsonResponse<{ success: boolean }>(response, '退出登录失败')
}

export async function fetchModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE}/models`, { headers: authHeaders() })

  return parseJsonResponse<ModelsResponse>(response, '获取模型列表失败')
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  const response = await fetch(`${API_BASE}/generate-image`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  return parseJsonResponse<GenerateImageResponse>(response, '请求失败')
}

export async function fetchHistory(scope: 'own' | 'all' = 'own'): Promise<HistoryResponse> {
  const query = scope === 'all' ? '?scope=all' : ''
  const response = await fetch(`${API_BASE}/history${query}`, { headers: authHeaders() })

  return parseJsonResponse<HistoryResponse>(response, '获取历史记录失败')
}

export async function clearHistory(scope: 'own' | 'all' = 'own'): Promise<{ success: boolean; message: string }> {
  const query = scope === 'all' ? '?scope=all' : ''
  const response = await fetch(`${API_BASE}/history${query}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  return parseJsonResponse<{ success: boolean; message: string }>(response, '清空历史记录失败')
}

export async function uploadReferenceImages(files: File[]): Promise<string[]> {
  const formData = new FormData()
  files.forEach(file => formData.append('images', file))

  const response = await fetch(`${API_BASE}/uploads/reference`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  const data = await parseJsonResponse<{ files?: Array<{ url: string }> }>(response, '上传参考图失败')

  return (data.files || []).map((file: { url: string }) => file.url)
}

export async function updateMyApiKey(apiKey: string): Promise<{ success: boolean; user: PublicUser }> {
  const response = await fetch(`${API_BASE}/account/api-key`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ apiKey }),
  })
  return parseJsonResponse<{ success: boolean; user: PublicUser }>(response, '保存 API Key 失败')
}

export async function updateMyPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/account/password`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
  return parseJsonResponse<{ success: boolean }>(response, '修改密码失败')
}

export async function fetchBalance(): Promise<BalanceResponse> {
  const response = await fetch(`${API_BASE}/account/balance`, { headers: authHeaders() })
  return parseJsonResponse<BalanceResponse>(response, '余额查询失败')
}

export async function fetchAdminSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/admin/settings`, { headers: authHeaders() })
  return parseJsonResponse<SettingsResponse>(response, '获取管理员设置失败')
}

export async function updateAdminSettings(input: { globalApiKey?: string; userApiKeysEnabled?: boolean }): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/admin/settings`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
  return parseJsonResponse<SettingsResponse>(response, '保存管理员设置失败')
}

export async function fetchAdminUsers(): Promise<UsersResponse> {
  const response = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() })
  return parseJsonResponse<UsersResponse>(response, '获取用户列表失败')
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<{ success: boolean; user: PublicUser }> {
  const response = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
  return parseJsonResponse<{ success: boolean; user: PublicUser }>(response, '创建用户失败')
}

export async function updateAdminUser(id: string, input: AdminUpdateUserInput): Promise<{ success: boolean; user: PublicUser }> {
  const response = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
  return parseJsonResponse<{ success: boolean; user: PublicUser }>(response, '更新用户失败')
}
