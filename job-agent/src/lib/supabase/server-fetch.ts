import { fetch as undiciFetch, ProxyAgent } from "undici";

type FetchFn = typeof fetch;

function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
}

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent(): ProxyAgent | undefined {
  const proxy = getProxyUrl();
  if (!proxy) return undefined;
  if (!proxyAgent) {
    proxyAgent = new ProxyAgent(proxy);
  }
  return proxyAgent;
}

export function getServerProxyStatus(): { configured: boolean; url?: string } {
  const url = getProxyUrl();
  if (!url) return { configured: false };
  return { configured: true, url };
}

/** Server-side fetch that respects HTTPS_PROXY (Clash / V2Ray local proxy). API routes only. */
export const serverFetch: FetchFn = (async (input, init) => {
  const agent = getProxyAgent();
  if (!agent) {
    return fetch(input, init);
  }

  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Record<string, unknown>),
    dispatcher: agent,
  }) as unknown as Response;
}) as FetchFn;
