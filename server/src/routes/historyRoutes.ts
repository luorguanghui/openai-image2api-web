import { Router, type Request, type Response, type NextFunction } from "express";
import {
  clearConversationsForViewer,
  getConversationsForViewer,
} from "../services/conversationService.js";
import { authenticate } from "../middlewares/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import type { ConversationRecord, ErrorResponse } from "../types/image.js";
import { safeLog } from "../utils/sanitize.js";

const router = Router();

router.use(authenticate);

function transformRecord(record: ConversationRecord) {
  const latestTurn = record.turns[record.turns.length - 1];

  return {
    id: record.id,
    userId: record.userId,
    username: record.username,
    conversationId: record.id,
    title: record.title,
    prompt: latestTurn?.prompt || record.title,
    params: latestTurn?.params,
    images: latestTurn?.images || [],
    turns: record.turns,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    latestImageUrl: record.latestImageUrl,
  };
}

/**
 * GET /api/history
 * 获取对话记录列表
 */
router.get(
  "/",
  async (
    req: Request,
    res: Response<object | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const scope = req.query.scope === "all" ? "all" : "own";
      const records = await getConversationsForViewer(authReq.user, scope);
      const history = records.map(transformRecord);
      safeLog("info", `返回 ${history.length} 条对话记录`);
      res.status(200).json({ success: true, history });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/history
 * 清空对话记录
 */
router.delete(
  "/",
  async (
    req: Request,
    res: Response<{ success: true; message: string } | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const scope = req.query.scope === "all" ? "all" : "own";
      await clearConversationsForViewer(authReq.user, scope);
      safeLog("info", "对话记录已清空");
      res.status(200).json({ success: true, message: "对话记录已清空。" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
