#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_TASK_ID = "task_01KTCQMRHCG8AW5Z6CF36MX4MT";

function readEnvFile() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    taskId: args.find(arg => !arg.startsWith("--")) || DEFAULT_TASK_ID,
    download: args.includes("--download"),
    raw: args.includes("--raw"),
  };
}

function getImagesFromTask(data) {
  const images = data?.data?.result?.images || [];
  return images
    .flatMap(image => Array.isArray(image.url) ? image.url : image.url ? [image.url] : [])
    .filter(Boolean);
}

async function downloadImages(urls, taskId) {
  const outputDir = path.resolve(__dirname, "../server/public/generated");
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [index, url] of urls.entries()) {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`下载失败 #${index + 1}: ${response.status} ${url}`);
      continue;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : "png";
    const filePath = path.join(outputDir, `recovered-${taskId}-${index + 1}.${ext}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    console.log(`已下载 #${index + 1}: ${filePath}`);
  }
}

async function main() {
  const fileEnv = readEnvFile();
  const apiKey = process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY;
  const baseUrl = (process.env.API_BASE_URL || fileEnv.API_BASE_URL || "https://api.apimart.ai").replace(/\/$/, "");
  const { taskId, download, raw } = parseArgs();

  if (!apiKey) {
    console.error("未找到 API Key。请在 .env 里设置 OPENAI_API_KEY，或运行前设置环境变量。");
    process.exit(1);
  }

  const url = `${baseUrl}/v1/tasks/${taskId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`查询失败: HTTP ${response.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const outputPath = path.resolve(__dirname, `../server/data/${taskId}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");

  if (raw) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    const task = data?.data || {};
    const imageUrls = getImagesFromTask(data);
    console.log(`任务 ID: ${taskId}`);
    console.log(`状态: ${task.status || "unknown"}`);
    console.log(`进度: ${task.progress ?? "unknown"}`);
    console.log(`完整响应已保存: ${outputPath}`);

    if (imageUrls.length > 0) {
      console.log("图片 URL:");
      imageUrls.forEach((imageUrl, index) => {
        console.log(`  ${index + 1}. ${imageUrl}`);
      });
    } else {
      console.log("暂未找到图片 URL。");
    }

    if (download && imageUrls.length > 0) {
      await downloadImages(imageUrls, taskId);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
