import type { AuthUserSummary } from "../types/auth.js";
import type {
  ConversationRecord,
  ConversationTurn,
  GeneratedImage,
  HistoryRecord,
  ImageGenerateResponse,
} from "../types/image.js";
import { execute, query } from "./database.js";
import { safeLog } from "../utils/sanitize.js";

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

function toIso(value?: Date | string): string {
  if (!value) {
    return new Date().toISOString();
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function newestFirst(a: ConversationRecord, b: ConversationRecord): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function oldestTurnFirst(a: ConversationTurn, b: ConversationTurn): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function conversationKey(record: HistoryRecord): string {
  return `${record.userId}::${record.conversationId}`;
}

function createTurnFromHistoryRecord(record: HistoryRecord): ConversationTurn {
  return {
    id: record.id,
    prompt: record.prompt,
    params: {
      model: record.model,
      prompt: record.prompt,
      size: record.size,
      resolution: record.resolution,
      quality: record.quality,
      output_format: record.output_format,
      background: record.background,
      moderation: record.moderation || "auto",
      output_compression: record.output_compression,
      n: record.n || 1,
      image_urls: record.image_urls,
      mask_url: record.mask_url,
    },
    images: record.images || [],
    createdAt: record.createdAt,
    model: record.model,
  };
}

function getLatestTurn(turns: ConversationTurn[]): ConversationTurn | undefined {
  const sortedTurns = [...turns].sort(oldestTurnFirst);
  return sortedTurns[sortedTurns.length - 1];
}

function deriveTitle(turns: ConversationTurn[]): string {
  const firstPrompt = turns[0]?.prompt?.trim() || "未命名对话";
  return firstPrompt.length > 40 ? `${firstPrompt.slice(0, 40)}...` : firstPrompt;
}

function latestImageUrlFromTurns(turns: ConversationTurn[]): string {
  const latest = getLatestTurn(turns);
  const latestImage = latest?.images?.[0];
  return latestImage?.url || "";
}

export function groupHistoryRecordsIntoConversations(records: HistoryRecord[]): ConversationRecord[] {
  const grouped = new Map<string, ConversationRecord>();

  for (const record of records) {
    const key = conversationKey(record);
    const turn = createTurnFromHistoryRecord(record);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        id: record.conversationId,
        userId: record.userId,
        username: record.username,
        title: "",
        turns: [turn],
        latestImageUrl: record.imageUrl || record.images?.[0]?.url || "",
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      });
      continue;
    }

    existing.turns.push(turn);
    if (new Date(record.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
      existing.createdAt = record.createdAt;
    }
    if (new Date(record.createdAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      existing.updatedAt = record.createdAt;
      existing.latestImageUrl = record.imageUrl || record.images?.[0]?.url || existing.latestImageUrl;
    }
  }

  return [...grouped.values()]
    .map(conversation => {
      const turns = conversation.turns.sort(oldestTurnFirst);
      return {
        ...conversation,
        title: conversation.title || deriveTitle(turns),
        turns,
        latestImageUrl: latestImageUrlFromTurns(turns) || conversation.latestImageUrl,
      };
    })
    .sort(newestFirst);
}

export function filterConversationsForViewer(
  conversations: ConversationRecord[],
  viewer: AuthUserSummary
): ConversationRecord[] {
  if (viewer.role === "admin") {
    return conversations;
  }
  return conversations.filter(conversation => conversation.userId === viewer.id);
}

function toConversationRecord(row: Record<string, unknown>): ConversationRecord {
  const turns = parseJsonArray<ConversationTurn>(row.turns_json, []).sort(oldestTurnFirst);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    username: row.username ? String(row.username) : undefined,
    title: String(row.title || deriveTitle(turns)),
    turns,
    latestImageUrl: String(row.latest_image_url || latestImageUrlFromTurns(turns)),
    createdAt: toIso(row.created_at as Date | string),
    updatedAt: toIso(row.updated_at as Date | string),
  };
}

export function createConversationTurn(input: {
  id: string;
  prompt: string;
  params: ImageGenerateResponse["params"];
  images: GeneratedImage[];
  createdAt: string;
}): ConversationTurn {
  return {
    id: input.id,
    prompt: input.prompt,
    params: input.params,
    images: input.images,
    createdAt: input.createdAt,
    model: input.params.model,
  };
}

export async function getConversations(): Promise<ConversationRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, u.username
     FROM (
       SELECT id, user_id
       FROM conversations FORCE INDEX (idx_conversations_updated)
       ORDER BY updated_at DESC
       LIMIT 500
     ) recent
     JOIN conversations c ON c.id = recent.id AND c.user_id = recent.user_id
     LEFT JOIN users u ON u.id = c.user_id`
  );
  return rows.map(toConversationRecord).sort(newestFirst);
}

export async function getConversationsForViewer(
  viewer: AuthUserSummary,
  scope: "own" | "all" = "own"
): Promise<ConversationRecord[]> {
  if (viewer.role === "admin" && scope === "all") {
    return getConversations();
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, u.username
     FROM (
       SELECT id, user_id
       FROM conversations FORCE INDEX (idx_conversations_user_updated)
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 200
     ) recent
     JOIN conversations c ON c.id = recent.id AND c.user_id = recent.user_id
     LEFT JOIN users u ON u.id = c.user_id`,
    [viewer.id]
  );
  return rows.map(toConversationRecord).sort(newestFirst);
}

export async function getConversationForUser(
  userId: string,
  conversationId: string
): Promise<ConversationRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, u.username
     FROM conversations c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.user_id = ? AND c.id = ?
     LIMIT 1`,
    [userId, conversationId]
  );
  return rows[0] ? toConversationRecord(rows[0]) : null;
}

export async function getLatestConversationTurn(
  userId: string,
  conversationId: string
): Promise<ConversationTurn | null> {
  const conversation = await getConversationForUser(userId, conversationId);
  return conversation ? getLatestTurn(conversation.turns) || null : null;
}

export async function appendConversationTurn(input: {
  conversationId: string;
  userId: string;
  turn: ConversationTurn;
}): Promise<ConversationRecord> {
  const existing = await getConversationForUser(input.userId, input.conversationId);
  const turns = existing ? [...existing.turns, input.turn].sort(oldestTurnFirst) : [input.turn];
  const latestTurn = getLatestTurn(turns) || input.turn;
  const latestImageUrl = latestImageUrlFromTurns(turns);
  const title = existing?.title || deriveTitle(turns);
  const createdAt = existing?.createdAt || input.turn.createdAt;

  await execute(
    `INSERT INTO conversations (
      id, user_id, title, turns_json, latest_image_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      turns_json = VALUES(turns_json),
      latest_image_url = VALUES(latest_image_url),
      updated_at = VALUES(updated_at)`,
    [
      input.conversationId,
      input.userId,
      title,
      JSON.stringify(turns),
      latestImageUrl,
      new Date(createdAt),
      new Date(latestTurn.createdAt),
    ]
  );

  const saved = await getConversationForUser(input.userId, input.conversationId);
  if (!saved) {
    throw new Error("对话记录保存失败。");
  }
  return saved;
}

export async function clearConversationsForViewer(
  viewer: AuthUserSummary,
  scope: "own" | "all" = "own"
): Promise<void> {
  if (viewer.role === "admin" && scope === "all") {
    await execute("DELETE FROM conversations");
    return;
  }
  await execute("DELETE FROM conversations WHERE user_id = ?", [viewer.id]);
}

export async function migrateLegacyHistoryToConversations(): Promise<void> {
  const existing = await query<{ count: number }>("SELECT COUNT(*) AS count FROM conversations");
  if (Number(existing[0]?.count || 0) > 0) {
    return;
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT h.*, u.username
     FROM history_records h
     LEFT JOIN users u ON u.id = h.user_id`
  );

  if (rows.length === 0) {
    return;
  }

  const records = rows.map(row => ({
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
    images: parseJsonArray<GeneratedImage>(row.images, []),
    imageUrl: String(row.image_url || ""),
    createdAt: toIso(row.created_at as Date | string),
  }));

  for (const conversation of groupHistoryRecordsIntoConversations(records)) {
    await execute(
      `INSERT INTO conversations (
        id, user_id, title, turns_json, latest_image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        turns_json = VALUES(turns_json),
        latest_image_url = VALUES(latest_image_url),
        updated_at = VALUES(updated_at)`,
      [
        conversation.id,
        conversation.userId,
        conversation.title,
        JSON.stringify(conversation.turns),
        conversation.latestImageUrl,
        new Date(conversation.createdAt),
        new Date(conversation.updatedAt),
      ]
    );
  }

  safeLog("info", `旧历史记录已迁移为 ${groupHistoryRecordsIntoConversations(records).length} 条对话`);
}
