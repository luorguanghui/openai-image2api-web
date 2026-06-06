import { Router, type Request, type Response } from "express";
import { config } from "../config/env.js";
import type { HealthResponse } from "../types/image.js";

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * 服务健康检查
 */
router.get("/", (_req: Request, res: Response<HealthResponse>) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: config.nodeEnv,
    version: config.version,
    timestamp: new Date().toISOString(),
  });
});

export default router;
