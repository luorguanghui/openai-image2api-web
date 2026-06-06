import type { Request, Response, NextFunction } from "express";
import type { ErrorResponse } from "../types/image.js";
import { safeLog } from "../utils/sanitize.js";

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误，返回统一格式的错误响应
 */
export function errorHandler(
  err: Error & { code?: string; status?: number },
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  // 根据错误码确定 HTTP 状态码和消息
  let statusCode = 500;
  let errorCode = "INTERNAL_ERROR";
  let message = "服务器内部错误。";

  switch (err.code) {
    case "VALIDATION_ERROR":
      statusCode = 400;
      errorCode = "VALIDATION_ERROR";
      message = err.message;
      break;
    case "API_KEY_MISSING":
      statusCode = 401;
      errorCode = "API_KEY_MISSING";
      message = err.message;
      break;
    case "OPENAI_API_ERROR":
      statusCode = 502;
      errorCode = "OPENAI_API_ERROR";
      message = err.message;
      break;
    case "NETWORK_ERROR":
      statusCode = 503;
      errorCode = "NETWORK_ERROR";
      message = err.message;
      break;
    case "RATE_LIMIT":
      statusCode = 429;
      errorCode = "RATE_LIMIT";
      message = err.message;
      break;
    case "FILE_WRITE_ERROR":
      statusCode = 500;
      errorCode = "FILE_WRITE_ERROR";
      message = err.message;
      break;
    case "LIMIT_FILE_SIZE":
    case "LIMIT_FILE_COUNT":
    case "LIMIT_UNEXPECTED_FILE":
    case "UPLOAD_ERROR":
      statusCode = 400;
      errorCode = "UPLOAD_ERROR";
      message = err.message;
      break;
    default:
      // 未知错误，记录详细信息但不暴露给客户端
      safeLog("error", "未处理的错误", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      break;
  }

  // 日志记录（脱敏）
  safeLog("warn", `请求处理失败 [${errorCode}]: ${message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
    },
  });
}
