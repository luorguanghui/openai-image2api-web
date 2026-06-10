import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { config } from "../config/env.js";
import { safeLog } from "../utils/sanitize.js";

let pool: Pool | null = null;

export type SqlParam = string | number | boolean | Date | Buffer | null;

function assertSafeDatabaseName(name: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error("MYSQL_DATABASE 只能包含字母、数字和下划线。");
  }
}

function toDatabaseUnavailableError(err: unknown): Error & { code: string } {
  const original = err as { code?: string; errno?: number; address?: string; port?: number; message?: string };
  const target = `${config.mysql.host}:${config.mysql.port}`;
  const error = new Error(
    `MySQL 数据库不可用，无法连接到 ${target}。请确认 MySQL 已启动，并在 .env 中配置 MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD、MYSQL_DATABASE。`
  ) as Error & { code: string; cause?: unknown };
  error.code = "DB_UNAVAILABLE";
  error.cause = {
    code: original.code,
    errno: original.errno,
    address: original.address,
    port: original.port,
    message: original.message,
  };
  return error;
}

async function ensureDatabaseExists(): Promise<void> {
  assertSafeDatabaseName(config.mysql.database);
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      multipleStatements: false,
    });
  } catch (err) {
    throw toDatabaseUnavailableError(err);
  }

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    await ensureDatabaseExists();
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: config.mysql.connectionLimit,
      namedPlaceholders: false,
      dateStrings: false,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "DB_UNAVAILABLE") {
      throw err;
    }
    throw toDatabaseUnavailableError(err);
  }

  return pool;
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  const db = await getPool();
  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params: SqlParam[] = []): Promise<ResultSetHeader> {
  const db = await getPool();
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}

async function ensureIndex(tableName: string, indexName: string, createSql: string): Promise<void> {
  const existing = await query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?`,
    [tableName, indexName]
  );

  if (Number(existing[0]?.count || 0) === 0) {
    await execute(createSql);
  }
}

export async function initDatabase(): Promise<void> {
  await getPool();

  await execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      global_api_key TEXT NULL,
      user_api_keys_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(128) NOT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      api_key TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_role (role),
      INDEX idx_users_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NULL,
      INDEX idx_sessions_user_id (user_id),
      INDEX idx_sessions_expires_at (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS history_records (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      conversation_id VARCHAR(80) NOT NULL,
      prompt TEXT NOT NULL,
      model VARCHAR(120) NOT NULL,
      size VARCHAR(40) NOT NULL,
      resolution VARCHAR(40) NOT NULL DEFAULT '',
      quality VARCHAR(40) NOT NULL,
      output_format VARCHAR(20) NOT NULL,
      background VARCHAR(40) NOT NULL,
      moderation VARCHAR(40) NULL,
      output_compression INT NULL,
      n INT NOT NULL DEFAULT 1,
      image_urls JSON NULL,
      mask_url TEXT NULL,
      images JSON NULL,
      image_url TEXT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_history_user_created (user_id, created_at),
      INDEX idx_history_conversation (conversation_id, created_at),
      CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureIndex(
    "history_records",
    "idx_history_created",
    "CREATE INDEX idx_history_created ON history_records (created_at DESC)"
  );

  await execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(80) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      turns_json JSON NOT NULL,
      latest_image_url TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id, user_id),
      INDEX idx_conversations_user_updated (user_id, updated_at),
      INDEX idx_conversations_updated (updated_at),
      CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    INSERT IGNORE INTO app_settings (id, global_api_key, user_api_keys_enabled)
    VALUES (1, NULL, TRUE)
  `);

  safeLog("info", "MySQL 数据表已就绪");
}
