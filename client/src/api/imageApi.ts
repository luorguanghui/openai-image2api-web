import type {
  GenerateImageParams,
  GenerateImageResponse,
  HistoryResponse,
  ModelsResponse,
  ApiError,
} from '../types/image'

const API_BASE = '/api'

export async function fetchModels(apiKey?: string): Promise<ModelsResponse> {
  const headers: HeadersInit = {}
  if (apiKey?.trim()) {
    headers['X-API-Key'] = apiKey.trim()
  }

  const response = await fetch(`${API_BASE}/models`, { headers })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || `获取模型列表失败 (${response.status})`)
  }

  return response.json()
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  const response = await fetch(`${API_BASE}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as ApiError
    throw new Error(err.error?.message || `请求失败，状态码 ${response.status}`)
  }

  return data as GenerateImageResponse
}

export async function fetchHistory(): Promise<HistoryResponse> {
  const response = await fetch(`${API_BASE}/history`)

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || `获取历史记录失败 (${response.status})`)
  }

  return response.json()
}

export async function clearHistory(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/history`, { method: 'DELETE' })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || `清空历史记录失败 (${response.status})`)
  }

  return response.json()
}

export async function uploadReferenceImages(files: File[], apiKey: string): Promise<string[]> {
  const formData = new FormData()
  files.forEach(file => formData.append('images', file))

  const response = await fetch(`${API_BASE}/uploads/reference`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || `上传参考图失败 (${response.status})`)
  }

  return (data.files || []).map((file: { url: string }) => file.url)
}
