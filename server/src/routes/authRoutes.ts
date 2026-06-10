import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate } from "../middlewares/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { createSession, deleteSession } from "../services/sessionService.js";
import { getSettings } from "../services/settingsService.js";
import { loginUser, toPublicUser } from "../services/userService.js";

const router = Router();

router.post(
  "/login",
  async (
    req: Request<object, object, { username?: string; password?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const username = req.body.username || "";
      const password = req.body.password || "";
      const user = await loginUser(username, password);
      const session = await createSession(user.id);
      const settings = await getSettings(user);

      res.status(200).json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: toPublicUser(user),
        settings,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/me",
  authenticate,
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

router.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await deleteSession(authReq.authToken || "");
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
