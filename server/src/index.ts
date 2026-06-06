import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "node:path";
import { config } from "./config/env.js";
import { generalRateLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import imageRoutes from "./routes/imageRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import modelsRoutes from "./routes/modelsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { ensureDir } from "./utils/file.js";
import { safeLog } from "./utils/sanitize.js";
import { initProxy } from "./utils/proxy.js";

/**
 * 启动 Express 服务
 */
async function startServer(): Promise<void> {
  // 初始化 HTTP 代理（如果配置了 HTTPS_PROXY 环境变量）
  initProxy();

  const app = express();

  // ── 安全中间件 ──
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // 手动设置 CSP（不包含 upgrade-insecure-requests）
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; script-src-attr 'none'"
    );
    next();
  });

  app.use(cors({
    origin: config.corsOrigin === "" ? false : config.corsOrigin,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  }));

  // ── 请求体解析 ──
  app.use(express.json({ limit: "1mb", strict: true }));

  // ── 通用速率限制 ──
  app.use("/api", generalRateLimiter);

  // ── 静态文件服务（生成的图片） ──
  const generatedDir = config.generatedDir;
  await ensureDir(generatedDir);
  app.use("/generated", express.static(generatedDir, {
    maxAge: "1d",
    immutable: true,
  }));

  // ── API 路由 ──
  app.use("/api/generate-image", imageRoutes);
  app.use("/api/models", modelsRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/health", healthRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "请求的 API 不存在。" },
    });
  });

  // ── 前端静态文件服务（生产环境） ──
  const clientDistDir = path.resolve(config.generatedDir, "../../../client/dist");
  app.use(express.static(clientDistDir));

  // SPA fallback：非 API 路由都返回 index.html
  app.get("*", (_req, res) => {
    const indexPath = path.join(clientDistDir, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "请求的资源不存在。" },
        });
      }
    });
  });

  // ── 全局错误处理 ──
  app.use(errorHandler);

  // ── 启动监听 ──
  const server = app.listen(config.port, () => {
    safeLog("info", `服务已启动，监听端口 ${config.port}`);
    safeLog("info", `环境: ${config.nodeEnv}`);
    safeLog("info", `API 健康检查: http://localhost:${config.port}/api/health`);
  });

  server.requestTimeout = config.httpRequestTimeout;
  server.timeout = config.httpRequestTimeout;
  server.keepAliveTimeout = Math.min(65000, config.httpRequestTimeout);
  server.headersTimeout = server.keepAliveTimeout + 5000;
}

startServer().catch((err) => {
  safeLog("error", "服务启动失败", err);
  process.exit(1);
});
