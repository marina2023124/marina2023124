import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { serverFetch } from "./server-fetch";

function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes("your-project")) {
    throw new Error("未配置 Supabase");
  }
  return { url, anonKey };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: User;
  error?: string;
  error_description?: string;
  msg?: string;
}

interface AuthClientInternals {
  _saveSession(session: Session): Promise<void>;
  _notifyAllSubscribers(event: string, session: Session): Promise<void>;
}

function buildSession(body: TokenResponse): Session {
  if (!body.access_token || !body.refresh_token || !body.expires_in || !body.user) {
    throw new Error("登录响应不完整，请重试");
  }

  const expiresAt = body.expires_at ?? Math.floor(Date.now() / 1000) + body.expires_in;

  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    expires_at: expiresAt,
    token_type: "bearer",
    user: body.user,
  };
}

/** 写入 cookie，避免 setSession 额外请求 /user 导致 fetch failed */
export async function persistAuthSession(supabase: SupabaseClient, session: Session) {
  const auth = supabase.auth as unknown as AuthClientInternals;
  await auth._saveSession(session);
  await auth._notifyAllSubscribers("SIGNED_IN", session);
}

function formatAuthApiError(body: TokenResponse, status: number): string {
  const raw = body.error_description || body.msg || body.error || "";
  if (/invalid login credentials/i.test(raw)) {
    return "邮箱或密码错误，请检查后重试";
  }
  if (/email not confirmed/i.test(raw)) {
    return "邮箱尚未验证，请先到邮箱点击验证链接";
  }
  if (raw) return raw;
  return `登录失败 (${status})`;
}

function authHeaders(anonKey: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json;charset=UTF-8",
    "X-Supabase-Api-Version": "2024-01-01",
  };
}

function wrapFetchError(err: unknown, action: string): Error {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? `: ${err.cause.message}` : "";
    if (/fetch failed|Failed to fetch|NetworkError/i.test(err.message)) {
      return new Error(`${action}网络失败${cause}`);
    }
    return err;
  }
  return new Error(`${action}失败`);
}

/** 直接调用 Supabase Auth REST（与 ping 相同 fetch 路径，避免 signInWithPassword 的 fetch failed） */
export async function passwordSignIn(email: string, password: string): Promise<Session> {
  const { url, anonKey } = getSupabaseAuthConfig();

  let res: Response;
  try {
    res = await serverFetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(anonKey),
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: { captcha_token: undefined },
      }),
    });
  } catch (err) {
    throw wrapFetchError(err, "登录");
  }

  const body = (await res.json()) as TokenResponse;

  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(formatAuthApiError(body, res.status));
  }

  return buildSession(body);
}

export async function passwordSignUp(email: string, password: string) {
  const { url, anonKey } = getSupabaseAuthConfig();

  let res: Response;
  try {
    res = await serverFetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: authHeaders(anonKey),
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    throw wrapFetchError(err, "注册");
  }

  const body = (await res.json()) as TokenResponse & { user?: { id?: string } };

  if (!res.ok) {
    throw new Error(formatAuthApiError(body, res.status));
  }

  return body;
}
