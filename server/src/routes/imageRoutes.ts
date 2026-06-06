import { Router, type Request, type Response, type NextFunction } from "express";
import { generateImage } from "../services/openaiImageService.js";
import { imageRateLimiter } from "../middlewares/rateLimiter.js";
import type { ImageGenerateRequest, ImageGenerateResponse, ErrorResponse } from "../types/image.js";
import { safeLog } from "../utils/sanitize.js";

const router = Router();

/**
 * POST /api/generate-image
 * 生成图片
 */
router.post(
  "/",
  imageRateLimiter,
  async (
    req: Request<object, ImageGenerateResponse | ErrorResponse, ImageGenerateRequest>,
    res: Response<ImageGenerateResponse | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      safeLog("info", "收到图片生成请求");

      const result = await generateImage(req.body);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
