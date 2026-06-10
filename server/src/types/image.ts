/** 图片生成请求参数 */
export interface ImageGenerateRequest {
  /** 用户临时 API Key（可选） */
  apiKey?: string;
  /** 当前对话 ID；为空时服务端会创建新对话 */
  conversationId?: string;
  /** 是否把同一对话上一轮结果作为本轮参考图 */
  continueFromLastImage?: boolean;
  /** 模型名称 */
  model?: string;
  /** 图片描述提示词 */
  prompt: string;
  /** 画面比例（如 1:1, 16:9, auto 等） */
  size?: string;
  /** 分辨率档位（1k / 2k / 4k） */
  resolution?: string;
  /** 图片质量 */
  quality?: string;
  /** 输出格式 */
  output_format?: string;
  /** 背景类型 */
  background?: string;
  /** 审核强度 */
  moderation?: string;
  /** 输出压缩强度（0-100） */
  output_compression?: number;
  /** 生成数量 */
  n?: number;
  /** 参考图 URL 数组 */
  image_urls?: string[];
  /** 遮罩图 URL（局部重绘） */
  mask_url?: string;
  /** 是否保存到历史记录 */
  saveHistory?: boolean;
}

/** 生成的图片信息 */
export interface GeneratedImage {
  /** 图片唯一 ID */
  id: string;
  /** Base64 编码的图片数据（可能为空，如果 API 返回 URL） */
  b64_json: string;
  /** MIME 类型 */
  mimeType: string;
  /** 图片访问 URL */
  url: string;
}

/** 图片生成成功响应 */
export interface ImageGenerateResponse {
  success: true;
  conversationId: string;
  images: GeneratedImage[];
  params: {
    model: string;
    prompt: string;
    size: string;
    resolution: string;
    quality: string;
    output_format: string;
    background: string;
    moderation: string;
    output_compression?: number;
    n: number;
    image_urls?: string[];
    mask_url?: string;
  };
  createdAt: string;
}

/** 错误响应 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** 历史记录条目 */
export interface HistoryRecord {
  id: string;
  userId: string;
  username?: string;
  conversationId: string;
  prompt: string;
  model: string;
  size: string;
  resolution: string;
  quality: string;
  output_format: string;
  background: string;
  moderation?: string;
  output_compression?: number;
  n?: number;
  image_urls?: string[];
  mask_url?: string;
  images?: GeneratedImage[];
  imageUrl: string;
  createdAt: string;
}

export interface ConversationTurn {
  id: string;
  prompt: string;
  params: ImageGenerateResponse["params"];
  images: GeneratedImage[];
  createdAt: string;
  model: string;
}

export interface ConversationRecord {
  id: string;
  userId: string;
  username?: string;
  title: string;
  turns: ConversationTurn[];
  latestImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** 健康检查响应 */
export interface HealthResponse {
  status: string;
  uptime: number;
  environment: string;
  version: string;
  timestamp: string;
}

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  maxN: number;
  maxReferenceImages?: number;
  supportedSizes: string[];
  supportedResolutions: string[];
  supportedQualities: string[];
  supportedOutputFormats?: string[];
  supportsImageUrls: boolean;
  supportsBase64ImageUrls?: boolean;
  supportsMask: boolean;
  requestMode?: "async" | "sync";
  apiFamily?: "gpt" | "wan" | "gemini";
  maxPromptLength?: number;
}

const GPT_IMAGE_2_RATIO_SIZES = [
  "auto",
  "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5",
  "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21",
];

const GPT_IMAGE_2_PIXEL_SIZES = [
  "1024x1024", "1254x1254", "2048x2048", "2880x2880",
  "1536x1024", "2048x1360", "3520x2336",
  "1024x1536", "1360x2048", "2336x3520",
  "1024x768", "2048x1536", "3312x2480",
  "768x1024", "1536x2048", "2480x3312",
  "1280x1024", "1448x1086", "2560x2048", "3216x2576",
  "1024x1280", "1122x1402", "2048x2560", "2576x3216",
  "1536x864", "1672x941", "2048x1152", "3840x2160",
  "864x1536", "941x1672", "1152x2048", "2160x3840",
  "2048x1024", "1774x887", "2688x1344", "3840x1920",
  "1024x2048", "887x1774", "1344x2688", "1920x3840",
  "1881x836", "1536x512", "3072x1024", "3840x1280",
  "512x1536", "1024x3072", "1280x3840",
  "2016x864", "1915x821", "2688x1152", "3840x1648",
  "864x2016", "821x1915", "1152x2688", "1648x3840",
];

const GPT_IMAGE_1_OFFICIAL_SIZES = ["1:1", "3:2", "2:3"];
const LEGACY_OPENAI_GPT_IMAGE_1_SIZES = ["1024x1024", "1024x1536", "1536x1024", "auto"];
const WAN_IMAGE_SIZES = ["1K", "2K", "1:1", "4:3", "3:4", "16:9", "9:16"];
const WAN_IMAGE_PRO_SIZES = ["1K", "2K", "4K", "1:1", "4:3", "3:4", "16:9", "9:16"];
const GEMINI_IMAGE_SIZES = ["1:1", "3:4", "4:3", "9:16", "16:9"];
const GEMINI_31_IMAGE_SIZES = [
  ...GEMINI_IMAGE_SIZES,
  "21:9", "9:21", "2:3", "3:2", "5:4", "4:5",
];

const ALL_SIZES = [
  ...new Set([
    ...GPT_IMAGE_2_RATIO_SIZES,
    ...GPT_IMAGE_2_PIXEL_SIZES,
    ...GPT_IMAGE_1_OFFICIAL_SIZES,
    ...LEGACY_OPENAI_GPT_IMAGE_1_SIZES,
    ...WAN_IMAGE_PRO_SIZES,
    ...GEMINI_31_IMAGE_SIZES,
  ]),
];

/** 参数校验白名单定义 */
export const ALLOWED_VALUES = {
  model: [
    "gpt-image-2", "gpt-image-2-official", "gpt-image-1.5-official", "gpt-image-1-official", "gpt-image-1",
    "wan2.7-image-pro", "wan2.7-image",
    "gemini-3.1-flash-image-preview", "gemini-3.1-flash-image-preview-official",
    "gemini-3-pro-image-preview", "gemini-3-pro-image-preview-official",
    "gemini-2.5-flash-image-preview", "gemini-2.5-flash-image-preview-official",
  ],
  size: [
    "auto",
    "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5",
    "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21",
    // 兼容常用像素尺寸
    "1024x1024", "1024x1536", "1536x1024",
    "2048x2048", "2880x2880",
    "1536x864", "2048x1152", "3840x2160",
    "864x1536", "1152x2048", "2160x3840",
    "1881x836", "3072x1024", "3840x1280",
    "887x1774", "1024x3072", "1280x3840",
    "2016x864", "2688x1152", "3840x1648",
    "864x2016", "1152x2688", "1648x3840",
  ],
  resolution: ["0.5K", "1K", "2K", "4K", "1k", "2k", "4k"],
  quality: ["low", "medium", "high", "auto"],
  output_format: ["png", "jpeg", "webp"],
  background: ["transparent", "auto", "opaque"],
  moderation: ["auto", "low"],
  n: { min: 1, max: 4 },
  prompt: { maxLength: 5000 },
  image_urls: { maxCount: 16 },
  output_compression: { min: 0, max: 100 },
} as const;

/** 参数默认值 */
export const DEFAULT_VALUES = {
  model: "gpt-image-2",
  size: "1:1",
  resolution: "1k",
  quality: "auto",
  output_format: "png",
  background: "auto",
  moderation: "auto",
  n: 1,
  saveHistory: true,
} as const;

/** MIME 类型映射 */
export const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** 可用模型列表 */
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: "gpt-image-2",
    name: "GPT-Image-2（APIMart）",
    description: "APIMart gpt-image-2 聚合渠道，支持文生图/图生图，15 种比例，最高 4K，参考图最多 16 张。",
    maxN: 1,
    maxReferenceImages: 16,
    supportedSizes: [...GPT_IMAGE_2_RATIO_SIZES, ...GPT_IMAGE_2_PIXEL_SIZES],
    supportedResolutions: ["1k", "2k", "4k"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsBase64ImageUrls: true,
    supportsMask: false,
    requestMode: "async",
    apiFamily: "gpt",
  },
  {
    id: "gpt-image-2-official",
    name: "GPT-Image-2（官方渠道）",
    description: "OpenAI 官方 gpt-image-2 模型，支持文生图/图生图/局部重绘，15 种比例，最高 4K",
    maxN: 4,
    maxReferenceImages: 16,
    supportedSizes: [...GPT_IMAGE_2_RATIO_SIZES, ...GPT_IMAGE_2_PIXEL_SIZES],
    supportedResolutions: ["1k", "2k", "4k"],
    supportedQualities: ["auto", "low", "medium", "high"],
    supportedOutputFormats: ["png", "jpeg", "webp"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gpt",
  },
  {
    id: "gpt-image-1.5-official",
    name: "GPT-Image-1.5（官方渠道）",
    description: "OpenAI 官方 gpt-image-1.5 模型，与 gpt-image-2 接口 95% 对齐",
    maxN: 4,
    maxReferenceImages: 15,
    supportedSizes: GPT_IMAGE_1_OFFICIAL_SIZES,
    supportedResolutions: [],
    supportedQualities: ["auto", "low", "medium", "high"],
    supportedOutputFormats: ["png", "jpeg"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gpt",
  },
  {
    id: "gpt-image-1-official",
    name: "GPT-Image-1 (Official)",
    description: "OpenAI official gpt-image-1 channel. Stable general image generation with image-to-image and inpainting support.",
    maxN: 4,
    maxReferenceImages: 15,
    supportedSizes: GPT_IMAGE_1_OFFICIAL_SIZES,
    supportedResolutions: [],
    supportedQualities: ["auto", "low", "medium", "high"],
    supportedOutputFormats: ["png", "jpeg"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gpt",
  },
  {
    id: "wan2.7-image-pro",
    name: "Wan2.7 Image Pro",
    description: "Wan2.7 Image Pro async model. Text-to-image supports up to 4K; image-to-image/reference workflows support up to 2K.",
    maxN: 4,
    maxReferenceImages: 9,
    supportedSizes: WAN_IMAGE_PRO_SIZES,
    supportedResolutions: ["1K", "2K", "4K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: false,
    requestMode: "async",
    apiFamily: "wan",
    maxPromptLength: 5000,
  },
  {
    id: "wan2.7-image",
    name: "Wan2.7 Image",
    description: "Wan2.7 Image async model. Supports text-to-image, image-to-image and reference images up to 2K.",
    maxN: 4,
    maxReferenceImages: 9,
    supportedSizes: WAN_IMAGE_SIZES,
    supportedResolutions: ["1K", "2K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: false,
    requestMode: "async",
    apiFamily: "wan",
    maxPromptLength: 5000,
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image Preview",
    description: "Gemini 3.1 Flash Image Preview (Nano Banana 2). Supports 0.5K/1K/2K/4K and up to 14 reference images.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_31_IMAGE_SIZES,
    supportedResolutions: ["0.5K", "1K", "2K", "4K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: false,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gemini-3.1-flash-image-preview-official",
    name: "Gemini 3.1 Flash Image Preview (Official)",
    description: "Official Gemini 3.1 Flash Image Preview channel. Supports 0.5K/1K/2K/4K and up to 14 reference images.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_31_IMAGE_SIZES,
    supportedResolutions: ["0.5K", "1K", "2K", "4K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: false,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image Preview",
    description: "Gemini 3 Pro Image Preview (Nano Banana Pro). Supports 1K/2K/4K, up to 14 reference images and mask editing.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_IMAGE_SIZES,
    supportedResolutions: ["1K", "2K", "4K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gemini-3-pro-image-preview-official",
    name: "Gemini 3 Pro Image Preview (Official)",
    description: "Official Gemini 3 Pro Image Preview channel. Supports 1K/2K/4K, up to 14 reference images and mask editing.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_IMAGE_SIZES,
    supportedResolutions: ["1K", "2K", "4K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gemini-2.5-flash-image-preview",
    name: "Gemini 2.5 Flash Image Preview",
    description: "Gemini 2.5 Flash Image Preview (Nano Banana). Supports 1K, up to 14 reference images and mask editing.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_IMAGE_SIZES,
    supportedResolutions: ["1K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gemini-2.5-flash-image-preview-official",
    name: "Gemini 2.5 Flash Image Preview (Official)",
    description: "Official Gemini 2.5 Flash Image Preview channel. Supports 1K, up to 14 reference images and mask editing.",
    maxN: 4,
    maxReferenceImages: 14,
    supportedSizes: GEMINI_IMAGE_SIZES,
    supportedResolutions: ["1K"],
    supportedQualities: ["auto"],
    supportedOutputFormats: ["png"],
    supportsImageUrls: true,
    supportsMask: true,
    requestMode: "async",
    apiFamily: "gemini",
    maxPromptLength: 1000,
  },
  {
    id: "gpt-image-1",
    name: "GPT-Image-1",
    description: "OpenAI gpt-image-1 模型，基础文生图功能",
    maxN: 10,
    supportedSizes: ["1024x1024", "1024x1536", "1536x1024", "auto"],
    supportedResolutions: [],
    supportedQualities: ["auto", "low", "medium", "high"],
    supportedOutputFormats: ["png", "jpeg", "webp"],
    supportsImageUrls: false,
    supportsMask: false,
    requestMode: "sync",
    apiFamily: "gpt",
  },
];
