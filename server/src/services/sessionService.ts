import crypto from "node:crypto";
import { config } from "../config/env.js";
import type { AuthUser } from "../types/auth.js";
import { execute, query } from "./database.js";
import { findUserById } from "./userService.js";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = `sess_${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

  await execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [hashToken(token), userId, expiresAt]
  );

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export async function getUserForSession(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  const rows = await query<{ user_id: string; expires_at: Date | string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token_hash = ? LIMIT 1",
    [hashToken(token)]
  );
  const session = rows[0];
  if (!session) {
    return null;
  }

  const expiresAt = session.expires_at instanceof Date
    ? session.expires_at
    : new Date(session.expires_at);
  if (expiresAt.getTime() <= Date.now()) {
    await deleteSession(token);
    return null;
  }

  const user = await findUserById(session.user_id);
  if (!user || !user.enabled) {
    return null;
  }

  await execute("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?", [hashToken(token)]);
  return user;
}

export async function cleanupExpiredSessions(): Promise<void> {
  await execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
}
