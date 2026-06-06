import crypto from "node:crypto";
import path from "node:path";
import { config } from "../config/env.js";
import type {
  ImageGenerateRequest,
  GeneratedImage,
  ImageGenerateResponse,
} from "../types/image.js";
import {
  ALLOWED_VALUES,
  AVAILABLE_MODELS,
  DEFAULT_VALUES,
  MIME_TYPES,
} from "../types/image.js";
import { writeBase64ToFile, ensureDir } from "../utils/file.js";
import { safeLog } from "../utils/sanitize.js";
import { addHistory } from "./historyService.js";

/**
 * 参数校验错误
 */
class ValidationError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MODEL_BY_ID = new Map(AVAILABLE_MODELS.map(model => [model.id, model]));

function isDataImageUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

/**
 * 校验请求参数，返回处理后的参数
 * @param body - 原始请求体
 * @returns 校验后的参数
 */
function validateParams(body: ImageGenerateRequest) {
  // prompt 校验
  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    throw new ValidationError("请提供图片描述（prompt），不能为空。");
  }
  if (body.prompt.length > ALLOWED_VALUES.prompt.maxLength) {
    throw new ValidationError(`图片描述不能超过 ${ALLOWED_VALUES.prompt.maxLength} 个字符。`);
  }

  // model 校验
  const model = body.model || DEFAULT_VALUES.model;
  const modelInfo = MODEL_BY_ID.get(model);
  if (!modelInfo) {
    throw new ValidationError(`Unsupported model: ${model}`);
  }
  if (!(ALLOWED_VALUES.model as readonly string[]).includes(model)) {
    throw new ValidationError(`不支持的模型: ${model}，允许的模型: ${ALLOWED_VALUES.model.join(", ")}`);
  }

  // size 校验
  const size = body.size || DEFAULT_VALUES.size;
  if (!modelInfo.supportedSizes.includes(size)) {
    throw new ValidationError(`不支持的尺寸: ${size}，允许的尺寸: ${ALLOWED_VALUES.size.join(", ")}`);
  }

  // resolution 校验（仅 gpt-image-2/1.5 支持）
  let resolution = body.resolution || DEFAULT_VALUES.resolution;
  const supportsResolution = modelInfo.supportedResolutions.length > 0;
  if (supportsResolution) {
    if (!modelInfo.supportedResolutions.includes(resolution)) {
      throw new ValidationError(`不支持的分辨率: ${resolution}，允许的分辨率: ${ALLOWED_VALUES.resolution.join(", ")}`);
    }
  } else {
    resolution = ""; // gpt-image-1 不支持 resolution
  }

  // quality 校验
  const quality = body.quality || DEFAULT_VALUES.quality;
  if (!modelInfo.supportedQualities.includes(quality)) {
    throw new ValidationError(`不支持的质量: ${quality}，允许的质量: ${ALLOWED_VALUES.quality.join(", ")}`);
  }

  // output_format 校验
  const output_format = body.output_format || DEFAULT_VALUES.output_format;
  const supportedOutputFormats = modelInfo.supportedOutputFormats || [...ALLOWED_VALUES.output_format];
  if (!supportedOutputFormats.includes(output_format)) {
    throw new ValidationError(`不支持的输出格式: ${output_format}，允许的格式: ${ALLOWED_VALUES.output_format.join(", ")}`);
  }

  // background 校验
  const background = body.background || DEFAULT_VALUES.background;
  if (!(ALLOWED_VALUES.background as readonly string[]).includes(background)) {
    throw new ValidationError(`不支持的背景类型: ${background}，允许的类型: ${ALLOWED_VALUES.background.join(", ")}`);
  }

  // moderation 校验
  const moderation = body.moderation || DEFAULT_VALUES.moderation;
  if (!(ALLOWED_VALUES.moderation as readonly string[]).includes(moderation)) {
    throw new ValidationError(`不支持的审核强度: ${moderation}，允许的类型: ${ALLOWED_VALUES.moderation.join(", ")}`);
  }

  // n 校验
  const n = body.n ?? DEFAULT_VALUES.n;
  if (!Number.isInteger(n) || n < ALLOWED_VALUES.n.min || n > modelInfo.maxN) {
    throw new ValidationError(`生成数量必须是 ${ALLOWED_VALUES.n.min} 到 ${ALLOWED_VALUES.n.max} 之间的整数。`);
  }

  // image_urls 校验
  if (body.image_urls && !Array.isArray(body.image_urls)) {
    throw new ValidationError("参考图 URL 必须是数组。");
  }
  if (body.image_urls && body.image_urls.length > 0 && !modelInfo.supportsImageUrls) {
    throw new ValidationError(`Model ${model} does not support reference images.`);
  }
  if (body.image_urls && body.image_urls.length > (modelInfo.maxReferenceImages ?? ALLOWED_VALUES.image_urls.maxCount)) {
    throw new ValidationError(`参考图最多支持 ${ALLOWED_VALUES.image_urls.maxCount} 张。`);
  }
  if (body.image_urls) {
    for (const url of body.image_urls) {
      const isHttpUrl = typeof url === "string" && /^https?:\/\//i.test(url);
      const isAllowedDataUri = typeof url === "string" && Boolean(modelInfo.supportsBase64ImageUrls) && isDataImageUrl(url);
      if (!isHttpUrl && !isAllowedDataUri) {
        throw new ValidationError("参考图 URL 必须是可公网访问的 http/https 地址。");
      }
    }
  }

  if (body.mask_url) {
    if (!modelInfo.supportsMask) {
      throw new ValidationError(`Model ${model} does not support mask_url.`);
    }
    if (!body.image_urls || body.image_urls.length === 0) {
      throw new ValidationError("遮罩图 URL 必须搭配至少一张参考图使用。");
    }
    if (typeof body.mask_url !== "string" || !/^https?:\/\//i.test(body.mask_url)) {
      throw new ValidationError("遮罩图 URL 必须是可公网访问的 http/https 地址。");
    }
  }

  // output_compression 校验
  if (body.output_compression !== undefined) {
    if (!Number.isInteger(body.output_compression) ||
        body.output_compression < ALLOWED_VALUES.output_compression.min ||
        body.output_compression > ALLOWED_VALUES.output_compression.max) {
      throw new ValidationError(`输出压缩强度必须是 ${ALLOWED_VALUES.output_compression.min} 到 ${ALLOWED_VALUES.output_compression.max} 之间的整数。`);
    }
  }

  return {
    prompt: body.prompt.trim(),
    model,
    size,
    resolution,
    quality,
    output_format,
    background,
    moderation,
    n,
    output_compression: body.output_compression,
    image_urls: body.image_urls,
    mask_url: body.mask_url,
    saveHistory: body.saveHistory ?? DEFAULT_VALUES.saveHistory,
  };
}

/**
 * 生成图片 ID
 * @returns 唯一图片 ID
 */
function generateImageId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const uuid = crypto.randomUUID().slice(0, 8);
  return `img_${date}_${uuid}`;
}

/**
 * 构建 API 请求体
 */
function buildRequestBody(params: ReturnType<typeof validateParams>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    size: params.size,
    quality: params.quality,
    output_format: params.output_format,
    background: params.background,
    moderation: params.moderation,
    n: params.n,
  };

  // 仅新版模型支持 resolution
  if (params.resolution) {
    body.resolution = params.resolution;
  }

  // 仅新版模型支持 image_urls / mask_url
  if (params.image_urls && params.image_urls.length > 0) {
    body.image_urls = params.image_urls;
  }
  if (params.mask_url) {
    body.mask_url = params.mask_url;
  }

  // output_compression 仅 jpeg/webp 有效
  if (params.output_compression !== undefined && (params.output_format === "jpeg" || params.output_format === "webp")) {
    body.output_compression = params.output_compression;
  }

  return body;
}

/**
 * 延迟指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorCode(err: unknown): string | undefined {
  const error = err as { code?: string; cause?: { code?: string } };
  return error.code || error.cause?.code;
}

function isTransientNetworkError(err: unknown): boolean {
  return ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(getErrorCode(err) || "");
}

function toApiError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/**
 * 调用 apimart.ai 生成图片（异步模式）
 * 提交任务后轮询直到完成
 */
async function callApiAsync(apiKey: string, requestBody: Record<string, unknown>): Promise<{ url?: string; b64_json?: string }[]> {
  const baseUrl = config.apiBaseUrl;
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. 提交生成任务
  safeLog("info", "提交图片生成任务到 apimart.ai...");
  let submitResponse: Response;
  try {
    submitResponse = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (isTransientNetworkError(err)) {
      throw toApiError("提交生成任务时网络连接被重置，请稍后重试。", "NETWORK_ERROR");
    }
    throw err;
  }

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
    const statusCode = submitResponse.status;

    if (statusCode === 401) {
      const error = new Error("身份验证失败，请检查您的 API 密钥。") as Error & { code: string };
      error.code = "API_KEY_MISSING";
      throw error;
    }
    if (statusCode === 429) {
      const error = new Error("请求过于频繁，请稍后再试。") as Error & { code: string };
      error.code = "RATE_LIMIT";
      throw error;
    }
    if (statusCode === 402) {
      const error = new Error("账户余额不足，请充值后再试。") as Error & { code: string };
      error.code = "OPENAI_API_ERROR";
      throw error;
    }

    const errorMsg = errorData?.error?.message || `API 请求失败，状态码 ${statusCode}`;
    const error = new Error(errorMsg) as Error & { code: string };
    error.code = "OPENAI_API_ERROR";
    throw error;
  }

  const submitData = await submitResponse.json() as { code: number; data?: Array<{ status: string; task_id: string }> };

  if (!submitData.data || submitData.data.length === 0) {
    const error = new Error("API 返回了空的任务数据。") as Error & { code: string };
    error.code = "OPENAI_API_ERROR";
    throw error;
  }

  const taskId = submitData.data[0].task_id;
  safeLog("info", `任务已提交，task_id: ${taskId}`);

  // 2. 轮询任务状态
  await sleep(config.taskPollInitialDelay); // 首次查询延迟

  const startTime = Date.now();
  while (Date.now() - startTime < config.taskPollTimeout) {
    let pollResponse: Response;
    try {
      pollResponse = await fetch(`${baseUrl}/v1/tasks/${taskId}`, { headers });
    } catch (err) {
      if (isTransientNetworkError(err)) {
        safeLog("warn", `任务查询遇到临时网络错误，将继续轮询: ${getErrorCode(err) || "UNKNOWN"}`);
        await sleep(config.taskPollInterval);
        continue;
      }
      throw err;
    }

    if (!pollResponse.ok) {
      safeLog("warn", `任务查询失败，状态码: ${pollResponse.status}`);
      await sleep(config.taskPollInterval);
      continue;
    }

    const taskData = await pollResponse.json() as {
      code: number;
      data?: {
        id: string;
        status: string;
        progress?: number;
        result?: { images?: Array<{ url?: string[] }> };
      };
    };

    const task = taskData.data;
    if (!task) {
      await sleep(config.taskPollInterval);
      continue;
    }

    safeLog("info", `任务状态: ${task.status}，进度: ${task.progress ?? 0}%`);

    if (task.status === "completed") {
      // 任务完成，提取图片
      const images: { url?: string; b64_json?: string }[] = [];
      for (const img of task.result?.images ?? []) {
        if (img.url && img.url.length > 0) {
          images.push({ url: img.url[0] });
        }
      }
      return images;
    }

    if (task.status === "failed") {
      const error = new Error("图片生成任务失败，请重试。") as Error & { code: string };
      error.code = "OPENAI_API_ERROR";
      throw error;
    }

    // submitted / in_progress，继续轮询
    await sleep(config.taskPollInterval);
  }

  // 超时
  const error = new Error("图片生成超时，请稍后重试。") as Error & { code: string };
  error.code = "OPENAI_API_ERROR";
  throw error;
}

/**
 * 调用 OpenAI 兼容 API 生成图片（同步模式，用于 gpt-image-1 等旧模型）
 */
async function callApiSync(apiKey: string, requestBody: Record<string, unknown>): Promise<{ url?: string; b64_json?: string }[]> {
  const baseUrl = config.apiBaseUrl;
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  safeLog("info", "调用 OpenAI 兼容 API 生成图片...");
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const statusCode = response.status;

    if (statusCode === 401) {
      const error = new Error("身份验证失败，请检查您的 API 密钥。") as Error & { code: string };
      error.code = "API_KEY_MISSING";
      throw error;
    }
    if (statusCode === 429) {
      const error = new Error("请求过于频繁，请稍后再试。") as Error & { code: string };
      error.code = "RATE_LIMIT";
      throw error;
    }

    const errorMsg = errorData?.error?.message || `API 请求失败，状态码 ${statusCode}`;
    const error = new Error(errorMsg) as Error & { code: string };
    error.code = "OPENAI_API_ERROR";
    throw error;
  }

  const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
  return data.data ?? [];
}

/**
 * 下载远程图片并转为 base64
 */
async function downloadImageAsBase64(url: string): Promise<{ b64_json: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");
    return { b64_json: b64, mimeType: contentType };
  } catch {
    return null;
  }
}

/**
 * 执行图片生成
 * @param body - 请求参数
 * @returns 生成结果
 */
export async function generateImage(body: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  // 1. 校验参数
  const params = validateParams(body);

  // 2. 确定 API Key
  const apiKey = body.apiKey || config.openaiApiKey;
  if (!apiKey) {
    const error = new Error("请提供 API Key 或在服务器配置环境变量。") as Error & { code: string };
    error.code = "API_KEY_MISSING";
    throw error;
  }

  const requestMode = MODEL_BY_ID.get(params.model)?.requestMode || "async";

  safeLog("info", `开始生成图片，模型: ${params.model}，尺寸: ${params.size}，分辨率: ${params.resolution || "N/A"}，数量: ${params.n}`);

  // 3. 构建请求体
  const requestBody = buildRequestBody(params);

  // 4. 调用 API（根据模型选择同步或异步模式）
  let apiImages: { url?: string; b64_json?: string }[];
  try {
    if (requestMode === "async") {
      // gpt-image-2 / gpt-image-1.5 使用异步任务模式
      apiImages = await callApiAsync(apiKey, requestBody);
    } else {
      // gpt-image-1 等旧模型使用同步模式
      apiImages = await callApiSync(apiKey, requestBody);
    }
  } catch (err: unknown) {
    const apiErr = err as { status?: number; message?: string; code?: string };

    // 如果已经是自定义错误码，直接抛出
    if (apiErr.code && ["API_KEY_MISSING", "RATE_LIMIT", "OPENAI_API_ERROR"].includes(apiErr.code)) {
      throw err;
    }

    // 网络错误
    if (apiErr.code === "ECONNREFUSED" || apiErr.code === "ENOTFOUND" || apiErr.code === "ETIMEDOUT") {
      const error = new Error("网络连接异常，请稍后重试。") as Error & { code: string };
      error.code = "NETWORK_ERROR";
      throw error;
    }

    safeLog("error", "API 调用失败", { status: apiErr.status, message: apiErr.message });
    const error = new Error("图片生成失败，请检查 API Key、模型名称或网络连接。") as Error & { code: string };
    error.code = "OPENAI_API_ERROR";
    throw error;
  }

  // 5. 处理返回结果
  const images: GeneratedImage[] = [];
  const createdAt = new Date().toISOString();

  await ensureDir(config.generatedDir);

  for (const item of apiImages) {
    const id = generateImageId();

    if (item.b64_json) {
      // API 直接返回 base64 数据
      const mimeType = MIME_TYPES[params.output_format] || "image/png";
      const fileName = `${id}.${params.output_format}`;
      const filePath = path.join(config.generatedDir, fileName);
      const imageUrl = `/generated/${fileName}`;

      try {
        await writeBase64ToFile(filePath, item.b64_json);
      } catch (writeErr) {
        safeLog("error", "图片文件写入失败", writeErr);
        const error = new Error("服务器文件写入失败。") as Error & { code: string };
        error.code = "FILE_WRITE_ERROR";
        throw error;
      }

      images.push({ id, b64_json: item.b64_json, mimeType, url: imageUrl });
    } else if (item.url) {
      // API 返回远程 URL，尝试下载保存
      const downloaded = await downloadImageAsBase64(item.url);
      if (downloaded) {
        const ext = downloaded.mimeType.includes("jpeg") || downloaded.mimeType.includes("jpg") ? "jpeg"
          : downloaded.mimeType.includes("webp") ? "webp" : "png";
        const fileName = `${id}.${ext}`;
        const filePath = path.join(config.generatedDir, fileName);
        const imageUrl = `/generated/${fileName}`;

        try {
          await writeBase64ToFile(filePath, downloaded.b64_json);
        } catch (writeErr) {
          safeLog("warn", "图片文件写入失败，使用远程 URL", writeErr);
          images.push({ id, b64_json: "", mimeType: downloaded.mimeType, url: item.url });
          continue;
        }

        images.push({ id, b64_json: downloaded.b64_json, mimeType: downloaded.mimeType, url: imageUrl });
      } else {
        // 下载失败，直接使用远程 URL
        images.push({ id, b64_json: "", mimeType: "image/png", url: item.url });
      }
    }
  }

  // 6. 保存历史记录
  if (params.saveHistory && images.length > 0) {
    try {
      const historyRecord = {
        id: images[0].id,
        prompt: params.prompt,
        model: params.model,
        size: params.size,
        resolution: params.resolution,
        quality: params.quality,
        output_format: params.output_format,
        background: params.background,
        moderation: params.moderation,
        output_compression: params.output_compression,
        n: params.n,
        image_urls: params.image_urls,
        mask_url: params.mask_url,
        imageUrl: images[0].url,
        createdAt,
      };
      await addHistory(historyRecord);
    } catch (histErr) {
      // 历史记录保存失败不影响主流程
      safeLog("warn", "历史记录保存失败（不影响图片生成）", histErr);
    }
  }

  safeLog("info", `图片生成成功，共 ${images.length} 张`);

  return {
    success: true,
    images,
    params: {
      model: params.model,
      prompt: params.prompt,
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
      output_format: params.output_format,
      background: params.background,
      moderation: params.moderation,
      output_compression: params.output_compression,
      n: params.n,
      image_urls: params.image_urls,
      mask_url: params.mask_url,
    },
    createdAt,
  };
}
