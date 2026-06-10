import crypto from "node:crypto";
import { config } from "../config/env.js";
import type { AuthUser, PublicUser, UserRole } from "../types/auth.js";
import { execute, query, type SqlParam } from "./database.js";
import { safeLog } from "../utils/sanitize.js";

interface UserRow extends Record<string, unknown> {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  enabled: number | boolean;
  api_key: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value?: Date | string): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAuthUser(row: UserRow): AuthUser {
  const apiKey = row.api_key || "";
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    enabled: Boolean(row.enabled),
    apiKey,
    hasApiKey: Boolean(apiKey.trim()),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    enabled: user.enabled,
    hasApiKey: user.hasApiKey,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return {
    salt,
    hash: hash.toString("hex"),
  };
}

async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(actual.hash, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function validationError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = "VALIDATION_ERROR";
  return error;
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const rows = await query<{ count: number }>("SELECT COUNT(*) AS count FROM users");
  if (Number(rows[0]?.count || 0) > 0) {
    return;
  }

  await createUser({
    username: config.adminUsername,
    password: config.adminPassword,
    role: "admin",
    enabled: true,
  });

  safeLog("warn", `已创建初始管理员账号: ${config.adminUsername}`);
  if (config.adminPassword === "admin123") {
    safeLog("warn", "当前使用默认管理员密码 admin123，请在生产环境通过 ADMIN_PASSWORD 覆盖。");
  }
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await query<UserRow>(
    "SELECT * FROM users ORDER BY role = 'admin' DESC, created_at ASC"
  );
  return rows.map(row => toPublicUser(toAuthUser(row)));
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  const rows = await query<UserRow>(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [normalizeUsername(username)]
  );
  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function loginUser(username: string, password: string): Promise<AuthUser> {
  const normalized = normalizeUsername(username);
  const rows = await query<UserRow>("SELECT * FROM users WHERE username = ? LIMIT 1", [normalized]);
  const row = rows[0];
  if (!row) {
    const error = new Error("用户名或密码不正确。") as Error & { code: string };
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  const ok = await verifyPassword(password, row.password_salt, row.password_hash);
  if (!ok) {
    const error = new Error("用户名或密码不正确。") as Error & { code: string };
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  const user = toAuthUser(row);
  if (!user.enabled) {
    const error = new Error("该用户已被管理员停用。") as Error & { code: string };
    error.code = "USER_DISABLED";
    throw error;
  }

  return user;
}

export async function createUser(input: {
  username: string;
  password: string;
  role?: UserRole;
  enabled?: boolean;
}): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9_.-]{3,80}$/.test(username)) {
    throw validationError("用户名需为 3-80 位，可包含字母、数字、下划线、点和短横线。");
  }
  if (input.password.length < 6) {
    throw validationError("密码至少需要 6 位。");
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    throw validationError("用户名已存在。");
  }

  const id = `usr_${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(input.password);
  await execute(
    `INSERT INTO users (id, username, password_hash, password_salt, role, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      username,
      passwordHash.hash,
      passwordHash.salt,
      input.role || "user",
      input.enabled ?? true,
    ]
  );

  const created = await findUserById(id);
  if (!created) {
    throw new Error("用户创建失败。");
  }
  return toPublicUser(created);
}

export async function updateUser(
  id: string,
  input: {
    password?: string;
    role?: UserRole;
    enabled?: boolean;
  }
): Promise<PublicUser> {
  const user = await findUserById(id);
  if (!user) {
    throw validationError("用户不存在。");
  }

  const updates: string[] = [];
  const params: SqlParam[] = [];

  if (input.role) {
    updates.push("role = ?");
    params.push(input.role);
  }
  if (input.enabled !== undefined) {
    updates.push("enabled = ?");
    params.push(input.enabled);
  }
  if (input.password !== undefined) {
    if (input.password.length < 6) {
      throw validationError("密码至少需要 6 位。");
    }
    const passwordHash = await hashPassword(input.password);
    updates.push("password_hash = ?", "password_salt = ?");
    params.push(passwordHash.hash, passwordHash.salt);
  }

  if (updates.length > 0) {
    params.push(id);
    await execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  }

  const updated = await findUserById(id);
  if (!updated) {
    throw new Error("用户更新失败。");
  }
  return toPublicUser(updated);
}

export async function setUserApiKey(userId: string, apiKey: string): Promise<PublicUser> {
  await execute("UPDATE users SET api_key = ? WHERE id = ?", [apiKey.trim() || null, userId]);
  const updated = await findUserById(userId);
  if (!updated) {
    throw validationError("用户不存在。");
  }
  return toPublicUser(updated);
}
