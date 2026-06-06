/**
 * 日志脱敏工具
 * 用于清除日志中的敏感信息（如 API Key）
 */

/** API Key 正则匹配模式 */
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /sk-proj-[a-zA-Z0-9_-]{20,}/g,
];

/**
 * 对字符串进行脱敏处理，移除可能的 API Key
 * @param text - 需要脱敏的文本
 * @returns 脱敏后的文本
 */
export function sanitizeLog(text: string): string {
  let sanitized = text;
  for (const pattern of API_KEY_PATTERNS) {
    sanitized = sanitized.replace(pattern, "***REDACTED***");
  }
  return sanitized;
}

/**
 * 对对象进行深度脱敏，移除所有 apiKey 字段
 * @param obj - 需要脱敏的对象
 * @returns 脱敏后的对象副本
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (key.toLowerCase().includes("apikey") || key.toLowerCase().includes("api_key")) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

/**
 * 带时间戳的安全日志输出
 * @param level - 日志级别
 * @param message - 日志消息
 * @param data - 附加数据（可选）
 */
export function safeLog(level: "info" | "warn" | "error", message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitizeLog(message);

  if (data !== undefined) {
    const sanitizedData = typeof data === "object" && data !== null
      ? sanitizeObject(data as Record<string, unknown>)
      : data;
    const dataStr = sanitizeLog(JSON.stringify(sanitizedData, null, 2));
    console[level](`[${timestamp}] ${sanitizedMessage}`, dataStr);
  } else {
    console[level](`[${timestamp}] ${sanitizedMessage}`);
  }
}
