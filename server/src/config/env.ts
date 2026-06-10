import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 从项目根目录加载 .env（server/ 的上一级）
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** 应用配置 */
export const config = {
  /** 服务端口 */
  port: parseInt(process.env.PORT || "3001", 10),
  /** OpenAI API Key（环境变量） */
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  /** API 基础 URL（默认为 apimart.ai） */
  apiBaseUrl: process.env.API_BASE_URL || "https://api.apimart.ai",
  /** CORS 允许的来源 */
  corsOrigin: process.env.CORS_ORIGIN || "",
  /** 速率限制：窗口时间（毫秒） */
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  /** 速率限制：最大请求数 */
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "60", 10),
  /** 任务轮询：首次查询延迟（毫秒） */
  taskPollInitialDelay: parseInt(process.env.TASK_POLL_INITIAL_DELAY || "10000", 10),
  /** 任务轮询：查询间隔（毫秒） */
  taskPollInterval: parseInt(process.env.TASK_POLL_INTERVAL || "3000", 10),
  /** 任务轮询：超时时间（毫秒） */
  taskPollTimeout: parseInt(process.env.TASK_POLL_TIMEOUT || "180000", 10),
  /** HTTP 长请求超时时间（毫秒），需大于任务轮询超时 */
  httpRequestTimeout: parseInt(process.env.HTTP_REQUEST_TIMEOUT || "240000", 10),
  /** 生成图片存储目录 */
  generatedDir: new URL("../../public/generated/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  /** 历史记录文件路径 */
  historyFile: new URL("../../data/history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  /** MySQL 配置 */
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "openai_image2api",
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || "10", 10),
  },
  /** 首个管理员账号（仅 users 表为空时创建） */
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  /** 首个管理员密码（生产环境请务必覆盖） */
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  /** 登录会话有效期（小时） */
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || "168", 10),
  /** 当前环境 */
  nodeEnv: process.env.NODE_ENV || "development",
  /** 应用版本 */
  version: "1.1.0",
} as const;
