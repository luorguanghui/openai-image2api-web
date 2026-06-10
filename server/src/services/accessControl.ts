export type ApiKeySource = "user" | "admin" | "env";

export interface ResolveApiKeyInput {
  userApiKey?: string | null;
  globalApiKey?: string | null;
  envApiKey?: string | null;
  userApiKeysEnabled: boolean;
  canUseAdminApiKey: boolean;
}

export interface ResolvedApiKey {
  value: string;
  source: ApiKeySource;
}

function cleanKey(value?: string | null): string {
  return (value || "").trim();
}

export function resolveEffectiveApiKey(input: ResolveApiKeyInput): ResolvedApiKey {
  const userApiKey = cleanKey(input.userApiKey);
  if (input.userApiKeysEnabled && userApiKey) {
    return { value: userApiKey, source: "user" };
  }

  if (input.canUseAdminApiKey) {
    const globalApiKey = cleanKey(input.globalApiKey);
    if (globalApiKey) {
      return { value: globalApiKey, source: "admin" };
    }

    const envApiKey = cleanKey(input.envApiKey);
    if (envApiKey) {
      return { value: envApiKey, source: "env" };
    }
  }

  const error = new Error("请先配置 API Key：管理员可设置全局 Key，或启用用户 Key 后由用户填写。") as Error & { code: string };
  error.code = "API_KEY_MISSING";
  throw error;
}
