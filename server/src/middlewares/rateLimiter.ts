import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";

/**
 * 图片生成接口速率限制中间件
 * 限制每个 IP 在指定时间窗口内的请求次数
 */
export const imageRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT",
      message: "请求过于频繁，请稍后重试。",
    },
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
});

/**
 * 通用 API 速率限制（较宽松）
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT",
      message: "请求过于频繁，请稍后重试。",
    },
  },
});
