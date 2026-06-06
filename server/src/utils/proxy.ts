/**
 * HTTP/HTTPS 代理支持
 * 当设置了 HTTPS_PROXY 或 HTTP_PROXY 环境变量时，所有 fetch 请求自动走代理
 */
import { ProxyAgent, setGlobalDispatcher, getGlobalDispatcher } from "undici";

const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || "";
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy || "";

/**
 * 初始化代理。如果设置了代理环境变量，则将全局 dispatcher 替换为 ProxyAgent。
 * 应在应用启动时调用一次。
 */
export function initProxy(): void {
  const proxyUrl = HTTPS_PROXY || HTTP_PROXY;
  if (!proxyUrl) {
    return;
  }

  try {
    const agent = new ProxyAgent({
      uri: proxyUrl,
      requestTls: { rejectUnauthorized: true },
    });
    setGlobalDispatcher(agent);
    console.log(`[proxy] 已启用代理: ${proxyUrl}`);
  } catch (err) {
    console.error(`[proxy] 代理初始化失败: ${proxyUrl}`, err);
  }
}

/**
 * 获取当前 dispatcher（用于需要手动指定的场景）
 */
export function getDispatcher() {
  const proxyUrl = HTTPS_PROXY || HTTP_PROXY;
  if (!proxyUrl) {
    return undefined;
  }
  return new ProxyAgent({
    uri: proxyUrl,
    requestTls: { rejectUnauthorized: true },
  });
}
