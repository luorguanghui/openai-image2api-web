import fs from "node:fs/promises";
import path from "node:path";
import { safeLog } from "./sanitize.js";

/**
 * 确保目录存在，不存在则递归创建
 * @param dirPath - 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    safeLog("info", `已创建目录: ${dirPath}`);
  }
}

/**
 * 将 Base64 数据写入文件
 * @param filePath - 目标文件路径
 * @param base64Data - Base64 编码数据
 */
export async function writeBase64ToFile(filePath: string, base64Data: string): Promise<void> {
  const buffer = Buffer.from(base64Data, "base64");
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
  safeLog("info", `图片已保存: ${filePath}`);
}

/**
 * 读取 JSON 文件，文件不存在则返回默认值
 * @param filePath - 文件路径
 * @param defaultValue - 默认值
 * @returns 解析后的数据
 */
export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 将数据写入 JSON 文件
 * @param filePath - 文件路径
 * @param data - 要写入的数据
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
