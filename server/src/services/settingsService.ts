import { config } from "../config/env.js";
import type { AuthUser } from "../types/auth.js";
import { resolveEffectiveApiKey, type ApiKeySource, type ResolvedApiKey } from "./accessControl.js";
import { execute, query, type SqlParam } from "./database.js";

export interface AppSettings {
  hasGlobalApiKey: boolean;
  userApiKeysEnabled: boolean;
  effectiveKeySource?: ApiKeySource;
}

interface RawSettings {
  globalApiKey: string;
  userApiKeysEnabled: boolean;
}

interface SettingsRow extends Record<string, unknown> {
  global_api_key: string | null;
  user_api_keys_enabled: number | boolean;
}

async function getRawSettings(): Promise<RawSettings> {
  const rows = await query<SettingsRow>(
    "SELECT global_api_key, user_api_keys_enabled FROM app_settings WHERE id = 1 LIMIT 1"
  );

  const row = rows[0];
  if (!row) {
    await execute("INSERT INTO app_settings (id, global_api_key, user_api_keys_enabled) VALUES (1, NULL, TRUE)");
    return { globalApiKey: "", userApiKeysEnabled: true };
  }

  return {
    globalApiKey: row.global_api_key || "",
    userApiKeysEnabled: Boolean(row.user_api_keys_enabled),
  };
}

export async function getSettings(user?: AuthUser): Promise<AppSettings> {
  const raw = await getRawSettings();
  let effectiveKeySource: ApiKeySource | undefined;
  if (user) {
    try {
      effectiveKeySource = resolveEffectiveApiKey({
        userApiKey: user.apiKey,
        globalApiKey: raw.globalApiKey,
        envApiKey: config.openaiApiKey,
        userApiKeysEnabled: raw.userApiKeysEnabled,
      }).source;
    } catch {
      effectiveKeySource = undefined;
    }
  }

  return {
    hasGlobalApiKey: Boolean(raw.globalApiKey.trim() || config.openaiApiKey.trim()),
    userApiKeysEnabled: raw.userApiKeysEnabled,
    effectiveKeySource,
  };
}

export async function updateSettings(input: {
  globalApiKey?: string;
  userApiKeysEnabled?: boolean;
}): Promise<AppSettings> {
  const updates: string[] = [];
  const params: SqlParam[] = [];

  if (input.globalApiKey !== undefined) {
    updates.push("global_api_key = ?");
    params.push(input.globalApiKey.trim() || null);
  }
  if (input.userApiKeysEnabled !== undefined) {
    updates.push("user_api_keys_enabled = ?");
    params.push(input.userApiKeysEnabled);
  }

  if (updates.length > 0) {
    await execute(`UPDATE app_settings SET ${updates.join(", ")} WHERE id = 1`, params);
  }

  return getSettings();
}

export async function getEffectiveApiKeyForUser(user: AuthUser): Promise<ResolvedApiKey> {
  const raw = await getRawSettings();
  return resolveEffectiveApiKey({
    userApiKey: user.apiKey,
    globalApiKey: raw.globalApiKey,
    envApiKey: config.openaiApiKey,
    userApiKeysEnabled: raw.userApiKeysEnabled,
  });
}
