import type { HistoryRecord } from "../types/image.js";
import type { AuthUserSummary } from "../types/auth.js";
import { execute, query } from "./database.js";
import { safeLog } from "../utils/sanitize.js";

/**
 * 历史记录服务
 * 管理图片生成历史记录的读写
 */

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value !== "string" || !value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function toHistoryRecord(row: Record<string, unknown>): HistoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    username: row.username ? String(row.username) : undefined,
    conversationId: String(row.conversation_id),
    prompt: String(row.prompt || ""),
    model: String(row.model || ""),
    size: String(row.size || ""),
    resolution: String(row.resolution || ""),
    quality: String(row.quality || ""),
    output_format: String(row.output_format || ""),
    background: String(row.background || ""),
    moderation: row.moderation ? String(row.moderation) : undefined,
    output_compression: row.output_compression == null ? undefined : Number(row.output_compression),
    n: row.n == null ? undefined : Number(row.n),
    image_urls: parseJsonArray<string>(row.image_urls, []),
    mask_url: row.mask_url ? String(row.mask_url) : undefined,
    images: parseJsonArray(row.images, []),
    imageUrl: String(row.image_url || ""),
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(String(row.created_at)).toISOString(),
  };
}

export function filterHistoryForViewer(
  records: HistoryRecord[],
  viewer: AuthUserSummary
): HistoryRecord[] {
  if (viewer.role === "admin") {
    return records;
  }
  return records.filter(record => record.userId === viewer.id);
}

/**
 * 获取所有历史记录
 * @returns 历史记录数组
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT h.*, u.username
     FROM (
       SELECT id
       FROM history_records
       ORDER BY created_at DESC
       LIMIT 500
     ) latest
     JOIN history_records h ON h.id = latest.id
     LEFT JOIN users u ON u.id = h.user_id`
  );
  return rows.map(toHistoryRecord).sort(sortNewestFirst);
}

function sortNewestFirst(a: HistoryRecord, b: HistoryRecord): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export async function getHistoryForUser(userId: string, limit = 200): Promise<HistoryRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const rows = await query<Record<string, unknown>>(
    `SELECT h.*, u.username
     FROM history_records h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.id IN (
       SELECT id
       FROM (
         SELECT id
         FROM history_records
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ${safeLimit}
       ) latest
     )`,
    [userId]
  );
  return rows.map(toHistoryRecord).sort(sortNewestFirst);
}

export async function getHistoryForViewer(
  viewer: AuthUserSummary,
  scope: "own" | "all" = "own"
): Promise<HistoryRecord[]> {
  if (viewer.role === "admin" && scope === "all") {
    return getHistory();
  }

  return getHistoryForUser(viewer.id);
}

export async function getLatestHistoryForConversation(
  userId: string,
  conversationId: string
): Promise<HistoryRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT h.*, u.username
     FROM history_records h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.user_id = ? AND h.conversation_id = ?
     ORDER BY h.created_at DESC
     LIMIT 1`,
    [userId, conversationId]
  );
  return rows[0] ? toHistoryRecord(rows[0]) : null;
}

/**
 * 添加一条历史记录
 * @param record - 历史记录条目
 */
export async function addHistory(record: HistoryRecord): Promise<void> {
  await execute(
    `INSERT INTO history_records (
      id, user_id, conversation_id, prompt, model, size, resolution, quality,
      output_format, background, moderation, output_compression, n,
      image_urls, mask_url, images, image_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      prompt = VALUES(prompt),
      images = VALUES(images),
      image_url = VALUES(image_url)`,
    [
      record.id,
      record.userId,
      record.conversationId,
      record.prompt,
      record.model,
      record.size,
      record.resolution,
      record.quality,
      record.output_format,
      record.background,
      record.moderation || "auto",
      record.output_compression ?? null,
      record.n ?? 1,
      JSON.stringify(record.image_urls || []),
      record.mask_url || null,
      JSON.stringify(record.images || []),
      record.imageUrl,
      new Date(record.createdAt),
    ]
  );
  safeLog("info", `历史记录已保存: ${record.id}`);
}

/**
 * 清空所有历史记录
 */
export async function clearHistory(): Promise<void> {
  await execute("DELETE FROM history_records");
  safeLog("info", "历史记录已清空");
}

export async function clearHistoryForViewer(
  viewer: AuthUserSummary,
  scope: "own" | "all" = "own"
): Promise<void> {
  if (viewer.role === "admin" && scope === "all") {
    await clearHistory();
    return;
  }

  await execute("DELETE FROM history_records WHERE user_id = ?", [viewer.id]);
  safeLog("info", `用户历史记录已清空: ${viewer.id}`);
}
