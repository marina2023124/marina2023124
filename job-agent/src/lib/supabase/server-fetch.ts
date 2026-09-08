import { ensureProxyEnv, getProxyUrl } from "./proxy-env";

type FetchFn = typeof fetch;

let proxyAgent: import("undici").ProxyAgent | undefined;
let cachedProxyForAgent: string | undefined;

async function getUndici() {
  return import("undici");
}

async function getProxyAgent(proxy: string): Promise<import("undici").ProxyAgent> {
  if (proxyAgent && cachedProxyForAgent === proxy) {
    return proxyAgent;
  }
  const { ProxyAgent } = await getUndici();
  proxyAgent = new ProxyAgent(proxy);
  cachedProxyForAgent = proxy;
  return proxyAgent;
}

export function getServerProxyStatus(): { configured: boolean; url?: string } {
  const url = getProxyUrl();
  if (!url) return { configured: false };
  return { configured: true, url };
}

async function fetchViaUndici(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  proxy?: string
): Promise<Response> {
  const { fetch: undiciFetch } = await getUndici();
  const options = { ...(init as Record<string, unknown>) };
  if (proxy) {
    options.dispatcher = await getProxyAgent(proxy);
  }
  return undiciFetch(input as Parameters<typeof undiciFetch>[0], options) as unknown as Response;
}

/** Server-side fetch: 有代理走 undici ProxyAgent，失败时回退 Node fetch；无代理 Vercel 走 undici。 */
export const serverFetch: FetchFn = (async (input, init) => {
  ensureProxyEnv();
  const proxy = getProxyUrl();

  if (proxy) {
    try {
      return await fetchViaUndici(input, init, proxy);
    } catch (err) {
      process.env.HTTP_PROXY = proxy;
      process.env.HTTPS_PROXY = proxy;
      try {
        return await fetch(input, init);
      } catch {
        throw err;
      }
    }
  }

  try {
    return await fetchViaUndici(input, init);
  } catch (err) {
    try {
      return await fetch(input, init);
    } catch {
      throw err;
    }
  }
}) as FetchFn;
