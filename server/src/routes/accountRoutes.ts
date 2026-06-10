import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate } from "../middlewares/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { fetchTokenBalance } from "../services/balanceService.js";
import { getEffectiveApiKeyForUser, getSettings } from "../services/settingsService.js";
import { setUserApiKey, toPublicUser, updateOwnPassword } from "../services/userService.js";

const router = Router();

router.use(authenticate);

router.get(
  "/profile",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const settings = await getSettings(authReq.user);
      res.status(200).json({
        success: true,
        user: toPublicUser(authReq.user),
        settings,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/api-key",
  async (
    req: Request<object, object, { apiKey?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await setUserApiKey(authReq.user.id, req.body.apiKey || "");
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/password",
  async (
    req: Request<object, object, { currentPassword?: string; newPassword?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await updateOwnPassword(
        authReq.user.id,
        req.body.currentPassword || "",
        req.body.newPassword || ""
      );
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/balance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const key = await getEffectiveApiKeyForUser(authReq.user);
      const balance = await fetchTokenBalance(key.value);
      res.status(200).json({
        success: true,
        source: key.source,
        balance,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
