import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import type { AuthenticatedRequest, UserRole } from "../types/auth.js";
import { getSettings, updateSettings } from "../services/settingsService.js";
import { createUser, listUsers, updateUser } from "../services/userService.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get(
  "/settings",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getSettings();
      res.status(200).json({ success: true, settings });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/settings",
  async (
    req: Request<object, object, { globalApiKey?: string; userApiKeysEnabled?: boolean }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const settings = await updateSettings({
        globalApiKey: req.body.globalApiKey,
        userApiKeysEnabled: req.body.userApiKeysEnabled,
      });
      res.status(200).json({ success: true, settings });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/users",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await listUsers();
      res.status(200).json({ success: true, users });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/users",
  async (
    req: Request<object, object, { username?: string; password?: string; role?: UserRole; enabled?: boolean }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = await createUser({
        username: req.body.username || "",
        password: req.body.password || "",
        role: req.body.role === "admin" ? "admin" : "user",
        enabled: req.body.enabled ?? true,
      });
      res.status(201).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/users/:id",
  async (
    req: Request<{ id: string }, object, { password?: string; role?: UserRole; enabled?: boolean }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      if (authReq.user.id === req.params.id && req.body.enabled === false) {
        const error = new Error("不能停用当前登录的管理员账号。") as Error & { code: string };
        error.code = "VALIDATION_ERROR";
        throw error;
      }

      const user = await updateUser(req.params.id, {
        password: req.body.password,
        role: req.body.role,
        enabled: req.body.enabled,
      });
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
