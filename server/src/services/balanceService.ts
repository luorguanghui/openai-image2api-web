import { config } from "../config/env.js";

export interface TokenBalance {
  success: boolean;
  remain_balance?: number;
  used_balance?: number;
  unlimited_quota?: boolean;
  message?: string;
}

export async function fetchTokenBalance(apiKey: string): Promise<TokenBalance> {
  const response = await fetch(`${config.apiBaseUrl}/v1/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await response.json().catch(() => ({})) as TokenBalance;

  if (!response.ok) {
    const error = new Error(data.message || `余额查询失败，状态码 ${response.status}`) as Error & { code: string };
    error.code = response.status === 429 ? "RATE_LIMIT" : "OPENAI_API_ERROR";
    throw error;
  }

  return data;
}
