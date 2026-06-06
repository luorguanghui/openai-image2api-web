import { Router, type Request, type Response, type NextFunction } from "express";
import { getHistory, clearHistory } from "../services/historyService.js";
import type { HistoryRecord, ErrorResponse } from "../types/image.js";
import { MIME_TYPES } from "../types/image.js";
import { safeLog } from "../utils/sanitize.js";

const router = Router();

/**
 * 将后端 HistoryRecord 转换为前端期望的 HistoryEntry 格式
 */
function transformRecord(record: HistoryRecord) {
  const mimeType = MIME_TYPES[record.output_format] || "image/png";
  const images = record.images && record.images.length > 0
    ? record.images
    : [
        {
          id: record.id,
          b64_json: "",
          mimeType,
          url: record.imageUrl,
        },
      ];

  return {
    id: record.id,
    prompt: record.prompt,
    params: {
      model: record.model,
      size: record.size,
      resolution: record.resolution || "",
      quality: record.quality,
      output_format: record.output_format,
      background: record.background,
      moderation: record.moderation || "auto",
      output_compression: record.output_compression,
      n: record.n || 1,
      image_urls: record.image_urls,
      mask_url: record.mask_url,
      saveHistory: true,
    },
    images,
    createdAt: record.createdAt,
  };
}

/**
 * GET /api/history
 * 获取历史记录列表
 */
router.get(
  "/",
  async (
    _req: Request,
    res: Response<object | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const records = await getHistory();
      const history = records.map(transformRecord);
      safeLog("info", `返回 ${history.length} 条历史记录`);
      res.status(200).json({ success: true, history });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/history
 * 清空所有历史记录
 */
router.delete(
  "/",
  async (
    _req: Request,
    res: Response<{ success: true; message: string } | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      await clearHistory();
      safeLog("info", "历史记录已清空");
      res.status(200).json({ success: true, message: "历史记录已清空。" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
