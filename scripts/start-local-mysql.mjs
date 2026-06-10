import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = process.env.MYSQL_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.MYSQL_PORT || "3306", 10);
const DEFAULT_MYSQLD = "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqld.exe";
const MYSQLD = process.env.MYSQLD_PATH || DEFAULT_MYSQLD;
const DATA_DIR = process.env.MYSQL_DEV_DATA_DIR ||
  path.join(process.env.LOCALAPPDATA || os.tmpdir(), "openai-image2api-mysql", "data");
const LOG_DIR = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "openai-image2api-mysql", "logs");

function canConnect() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForMysql() {
  for (let i = 0; i < 40; i += 1) {
    if (await canConnect()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

function initializeDataDir() {
  const mysqlSubdir = path.join(DATA_DIR, "mysql");
  if (fs.existsSync(mysqlSubdir)) {
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[mysql] 初始化本地数据目录: ${DATA_DIR}`);
  const result = spawnSync(MYSQLD, [`--initialize-insecure`, `--datadir=${DATA_DIR}`], {
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  if (process.platform !== "win32") {
    console.log("[mysql] 非 Windows 环境，跳过本机 MySQL 自动启动。");
    return;
  }

  if (await canConnect()) {
    console.log(`[mysql] 已检测到 ${HOST}:${PORT} 正在监听，跳过自动启动。`);
    return;
  }

  if (!fs.existsSync(MYSQLD)) {
    console.warn(`[mysql] 未找到 mysqld: ${MYSQLD}`);
    console.warn("[mysql] 请安装 MySQL，或通过 MYSQLD_PATH 指定 mysqld.exe。");
    return;
  }

  initializeDataDir();
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const stdout = fs.openSync(path.join(LOG_DIR, "mysqld.out.log"), "a");
  const stderr = fs.openSync(path.join(LOG_DIR, "mysqld.err.log"), "a");
  const child = spawn(MYSQLD, [
    `--datadir=${DATA_DIR}`,
    `--port=${PORT}`,
    `--bind-address=${HOST}`,
    "--mysqlx=0",
  ], {
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  child.unref();

  if (await waitForMysql()) {
    console.log(`[mysql] 本机 MySQL 已启动: ${HOST}:${PORT}`);
    return;
  }

  console.warn("[mysql] MySQL 启动超时，请查看日志:");
  console.warn(`[mysql] ${path.join(LOG_DIR, "mysqld.err.log")}`);
}

main().catch(err => {
  console.error("[mysql] 自动启动失败", err);
  process.exit(1);
});
