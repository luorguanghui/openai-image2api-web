import { Router, type Request, type NextFunction } from "express";
import { AVAILABLE_MODELS } from "../types/image.js";
import { config } from "../config/env.js";
import { safeLog } from "../utils/sanitize.js";

const router = Router();

interface OnlineModel {
  id?: string;
}

interface OnlineModelsResponse {
  data?: OnlineModel[];
}

const COMPATIBLE_IMAGE_MODEL_IDS = new Set(AVAILABLE_MODELS.map(model => model.id));
const MODEL_BY_ID = new Map(AVAILABLE_MODELS.map(model => [model.id, model]));

function getRequestApiKey(req: Request): string {
  const headerKey = req.get("x-api-key") || "";
  return headerKey.trim() || config.openaiApiKey;
}

async function fetchOnlineModelIds(apiKey: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${config.apiBaseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`models endpoint returned ${response.status}`);
    }

    const data = await response.json() as OnlineModelsResponse;
    return (data.data || [])
      .map(model => model.id)
      .filter((id): id is string => Boolean(id));
  } finally {
    clearTimeout(timeout);
  }
}

function isLikelyImageModel(id: string): boolean {
  const normalized = id.toLowerCase();
  return normalized.includes("gpt-image") || normalized.includes("image");
}

function createOnlineImageModel(id: string) {
  const known = MODEL_BY_ID.get(id);
  if (known) {
    return {
      ...known,
      description: `${known.description}（已从在线模型列表确认）`,
    };
  }

  const isLegacy = id === "gpt-image-1";
  return {
    id,
    name: id,
    description: "从在线模型列表发现的图像模型，请按实际 API 能力调整参数。",
    maxN: isLegacy ? 10 : 4,
    supportedSizes: isLegacy
      ? ["1024x1024", "1024x1536", "1536x1024", "auto"]
      : [
          "auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5",
          "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21",
        ],
    supportedResolutions: isLegacy ? [] : ["1k", "2k", "4k"],
    supportedQualities: ["auto", "low", "medium", "high"],
    supportsImageUrls: !isLegacy,
    supportsMask: !isLegacy,
  };
}

/**
 * GET /api/models
 * 获取可用模型列表。传入 X-API-Key 时会尝试在线读取 OpenAI 兼容 /v1/models，
 * 再筛选出当前图像生成表单已支持的模型。
 */
router.get(
  "/",
  async (
    req: Request,
    res,
    next: NextFunction
  ) => {
    try {
      const apiKey = getRequestApiKey(req);

      if (!apiKey) {
        res.status(200).json({
          success: true,
          source: "local",
          models: AVAILABLE_MODELS,
        });
        return;
      }

      try {
        const onlineIds = await fetchOnlineModelIds(apiKey);
        const onlineImageModels = onlineIds
          .filter(id => COMPATIBLE_IMAGE_MODEL_IDS.has(id) || isLikelyImageModel(id))
          .map(createOnlineImageModel);
        const onlineModelIds = new Set(onlineImageModels.map(model => model.id));
        const localFallbackModels = AVAILABLE_MODELS.filter(model => !onlineModelIds.has(model.id));
        const onlineModels = [...onlineImageModels, ...localFallbackModels];

        res.status(200).json({
          success: true,
          source: "online",
          onlineModelCount: onlineIds.length,
          models: onlineModels.length > 0 ? onlineModels : AVAILABLE_MODELS,
        });
      } catch (err) {
        safeLog("warn", "在线模型列表获取失败，使用本地兼容模型列表", err);
        res.status(200).json({
          success: true,
          source: "local",
          models: AVAILABLE_MODELS,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
