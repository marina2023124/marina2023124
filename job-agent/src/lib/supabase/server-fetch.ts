type FetchFn = typeof fetch;

function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
}

let proxyAgent: import("undici").ProxyAgent | undefined;

async function getUndici() {
  return import("undici");
}

async function getProxyAgent(): Promise<import("undici").ProxyAgent | undefined> {
  const proxy = getProxyUrl();
  if (!proxy) return undefined;
  if (!proxyAgent) {
    const { ProxyAgent } = await getUndici();
    proxyAgent = new ProxyAgent(proxy);
  }
  return proxyAgent;
}

export function getServerProxyStatus(): { configured: boolean; url?: string } {
  const url = getProxyUrl();
  if (!url) return { configured: false };
  return { configured: true, url };
}

/** Server-side fetch via undici (proxy-aware). Avoids Node fetch POST issues on Vercel. */
export const serverFetch: FetchFn = (async (input, init) => {
  const { fetch: undiciFetch } = await getUndici();
  const agent = await getProxyAgent();

  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Record<string, unknown>),
    ...(agent ? { dispatcher: agent } : {}),
  }) as unknown as Response;
}) as FetchFn;
