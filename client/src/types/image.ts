export interface GenerateImageParams {
  apiKey?: string
  conversationId?: string
  continueFromLastImage?: boolean
  model: string
  prompt: string
  size: string
  resolution: string
  quality: ImageQuality
  output_format: OutputFormat
  background: BackgroundMode
  moderation: string
  output_compression?: number
  n: number
  image_urls?: string[]
  mask_url?: string
  saveHistory: boolean
}

export interface GeneratedImage {
  id: string
  b64_json: string
  mimeType: string
  url?: string
}

export interface GeneratedParams {
  model: string
  prompt: string
  size: string
  resolution: string
  quality: ImageQuality
  output_format: OutputFormat
  background: BackgroundMode
  moderation: string
  output_compression?: number
  n: number
  image_urls?: string[]
  mask_url?: string
}

export interface GenerateImageResponse {
  success: boolean
  conversationId: string
  images: GeneratedImage[]
  params: GeneratedParams
  createdAt: string
}

export interface HistoryEntry {
  id: string
  userId: string
  username?: string
  conversationId: string
  title: string
  prompt: string
  params: GeneratedParams
  images: GeneratedImage[]
  turns: ConversationTurn[]
  createdAt: string
  updatedAt: string
  latestImageUrl?: string
}

export interface ConversationTurn {
  id: string
  prompt: string
  params: GeneratedParams
  images: GeneratedImage[]
  createdAt: string
  model: string
}

export interface HistoryResponse {
  success: boolean
  history: HistoryEntry[]
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export interface ModelInfo {
  id: string
  name: string
  description: string
  maxN: number
  maxReferenceImages?: number
  supportedSizes: string[]
  supportedResolutions: string[]
  supportedQualities: string[]
  supportedOutputFormats?: string[]
  supportsImageUrls: boolean
  supportsBase64ImageUrls?: boolean
  supportsMask: boolean
  requestMode?: 'async' | 'sync'
  apiFamily?: 'gpt' | 'wan' | 'gemini'
  maxPromptLength?: number
}

export interface ModelsResponse {
  success: boolean
  models: ModelInfo[]
  source?: 'local' | 'online'
  onlineModelCount?: number
}

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto'
export type OutputFormat = 'png' | 'jpeg' | 'webp'
export type BackgroundMode = 'auto' | 'transparent' | 'opaque'

export type UserRole = 'admin' | 'user'
export type ApiKeySource = 'user' | 'admin' | 'env'

export interface PublicUser {
  id: string
  username: string
  role: UserRole
  enabled: boolean
  hasApiKey: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AppSettings {
  hasGlobalApiKey: boolean
  userApiKeysEnabled: boolean
  effectiveKeySource?: ApiKeySource
}

export interface AuthResponse {
  success: boolean
  token: string
  expiresAt: string
  user: PublicUser
  settings: AppSettings
}

export interface MeResponse {
  success: boolean
  user: PublicUser
  settings: AppSettings
}

export interface UsersResponse {
  success: boolean
  users: PublicUser[]
}

export interface SettingsResponse {
  success: boolean
  settings: AppSettings
}

export interface BalanceResponse {
  success: boolean
  source: ApiKeySource
  balance: {
    success: boolean
    remain_balance?: number
    used_balance?: number
    unlimited_quota?: boolean
    message?: string
  }
}
