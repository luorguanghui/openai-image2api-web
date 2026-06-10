import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { getUserForSession } from "../services/sessionService.js";

function authError(message = "请先登录。"): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = "AUTH_REQUIRED";
  return error;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.get("authorization") || "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      throw authError();
    }

    const user = await getUserForSession(token);
    if (!user) {
      throw authError("登录已过期，请重新登录。");
    }

    const authReq = req as AuthenticatedRequest;
    authReq.user = user;
    authReq.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user.role !== "admin") {
    const error = new Error("需要管理员权限。") as Error & { code: string };
    error.code = "FORBIDDEN";
    next(error);
    return;
  }

  next();
}
