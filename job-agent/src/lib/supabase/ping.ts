const PING_TIMEOUT_MS = 8000;

export interface PingResult {
  ok: boolean;
  message: string;
  proxy?: { configured: boolean; url?: string };
}

/** Quick reachability check for the configured Supabase project (browser or server). */
export async function pingSupabaseProject(
  url: string,
  anonKey: string,
  customFetch?: typeof fetch
): Promise<PingResult> {
  const base = url.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const doFetch = customFetch ?? fetch;

  try {
    const res = await doFetch(`${base}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, message: `项目 API 返回 ${res.status}，请检查 .env.local 中的 URL` };
    }

    return { ok: true, message: "项目 API 连接正常，可以尝试登录" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/abort|timeout/i.test(message)) {
      return {
        ok: false,
        message: "连接超时：请确认 VPN 为全局模式，或在浏览器直接打开项目 API 地址测试",
      };
    }
    if (/fetch failed|Failed to fetch|NetworkError/i.test(message)) {
      return {
        ok: false,
        message: "无法访问项目 API（*.supabase.co），VPN 可能未代理浏览器流量",
      };
    }
    return { ok: false, message: message || "连接失败" };
  } finally {
    clearTimeout(timer);
  }
}

export function maskSupabaseUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    const parts = host.split(".");
    if (parts.length >= 1 && parts[0].length > 8) {
      parts[0] = `${parts[0].slice(0, 4)}…${parts[0].slice(-3)}`;
    }
    return parts.join(".");
  } catch {
    return "your-project.supabase.co";
  }
}

/** Server-side: verify Auth token POST path (same as login). */
export async function probeAuthTokenPost(
  url: string,
  anonKey: string,
  customFetch: typeof fetch
): Promise<PingResult> {
  const base = url.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const res = await customFetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json;charset=UTF-8",
        "X-Supabase-Api-Version": "2024-01-01",
      },
      body: JSON.stringify({
        email: "probe-invalid@jobagent.invalid",
        password: "invalid-probe-password",
        gotrue_meta_security: {},
      }),
      signal: controller.signal,
    });

    if (res.status === 400 || res.status === 401 || res.status === 422) {
      return { ok: true, message: "Auth 登录接口可达（POST /token 正常）" };
    }

    return {
      ok: false,
      message: `Auth 登录接口异常 HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/abort|timeout/i.test(message)) {
      return { ok: false, message: "Auth 登录接口超时" };
    }
    return { ok: false, message: `Auth 登录接口不可达：${message}` };
  } finally {
    clearTimeout(timer);
  }
}
