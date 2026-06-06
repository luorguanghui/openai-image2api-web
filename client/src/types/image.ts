export interface GenerateImageParams {
  apiKey: string
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

export interface GenerateImageResponse {
  success: boolean
  images: GeneratedImage[]
  params: Omit<GenerateImageParams, 'apiKey'>
  createdAt: string
}

export interface HistoryEntry {
  id: string
  prompt: string
  params: Omit<GenerateImageParams, 'apiKey' | 'prompt'>
  images: GeneratedImage[]
  createdAt: string
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
