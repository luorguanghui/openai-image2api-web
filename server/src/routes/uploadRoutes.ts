import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { config } from "../config/env.js";

interface UploadResponse {
  success: true;
  files: Array<{
    name: string;
    url: string;
    mimeType: string;
    size: number;
    expiresInHours: number;
  }>;
}

interface ApimartUploadResponse {
  url?: string;
  filename?: string;
  content_type?: string;
  bytes?: number;
  created_at?: number;
  error?: {
    message?: string;
    code?: string;
  };
}

const router = Router();

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 16,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("仅支持 PNG、JPEG、WebP、GIF 图片。") as Error & { code: string };
      error.code = "UPLOAD_ERROR";
      cb(error);
      return;
    }
    cb(null, true);
  },
});

function getRequestApiKey(req: Request): string {
  const headerKey = req.get("x-api-key") || "";
  return headerKey.trim() || config.openaiApiKey;
}

function toAppError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

async function uploadToApimart(apiKey: string, file: Express.Multer.File) {
  const formData = new FormData();
  const bytes = new Uint8Array(file.buffer.byteLength);
  bytes.set(file.buffer);
  const blob = new Blob([bytes.buffer], { type: file.mimetype });
  formData.append("file", blob, file.originalname || "reference-image");

  const response = await fetch(`${config.apiBaseUrl}/v1/uploads/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({})) as ApimartUploadResponse;

  if (!response.ok || !data.url) {
    const message = data.error?.message || `APIMart 上传失败，状态码 ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw toAppError("API Key 验证失败，无法上传参考图。", "API_KEY_MISSING");
    }
    if (response.status === 429) {
      throw toAppError("上传请求过于频繁，请稍后重试。", "RATE_LIMIT");
    }
    throw toAppError(message, "UPLOAD_ERROR");
  }

  return {
    name: data.filename || file.originalname,
    url: data.url,
    mimeType: data.content_type || file.mimetype,
    size: data.bytes || file.size,
    expiresInHours: 72,
  };
}

router.post(
  "/reference",
  upload.array("images", 16),
  async (
    req: Request,
    res: Response<UploadResponse>,
    next: NextFunction
  ) => {
    try {
      const apiKey = getRequestApiKey(req);
      if (!apiKey) {
        throw toAppError("请先提供 API Key，再上传参考图。", "API_KEY_MISSING");
      }

      const files = (req.files || []) as Express.Multer.File[];
      if (files.length === 0) {
        throw toAppError("请至少选择一张参考图。", "UPLOAD_ERROR");
      }

      const uploadedFiles = await Promise.all(files.map(file => uploadToApimart(apiKey, file)));

      res.status(200).json({
        success: true,
        files: uploadedFiles,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
