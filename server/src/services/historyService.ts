import { config } from "../config/env.js";
import type { HistoryRecord } from "../types/image.js";
import { readJsonFile, writeJsonFile } from "../utils/file.js";
import { safeLog } from "../utils/sanitize.js";

/**
 * 历史记录服务
 * 管理图片生成历史记录的读写
 */

/**
 * 获取所有历史记录
 * @returns 历史记录数组
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  return readJsonFile<HistoryRecord[]>(config.historyFile, []);
}

/**
 * 添加一条历史记录
 * @param record - 历史记录条目
 */
export async function addHistory(record: HistoryRecord): Promise<void> {
  const history = await getHistory();
  history.unshift(record); // 最新的在前

  // 限制最多保存 100 条记录
  const trimmed = history.slice(0, 100);
  await writeJsonFile(config.historyFile, trimmed);
  safeLog("info", `历史记录已保存，当前共 ${trimmed.length} 条`);
}

/**
 * 清空所有历史记录
 */
export async function clearHistory(): Promise<void> {
  await writeJsonFile(config.historyFile, []);
  safeLog("info", "历史记录已清空");
}
