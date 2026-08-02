import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.WECHAT_JWT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("未配置 WECHAT_JWT_SECRET");
  }
  return secret;
}

export function signWechatToken(openid: string): string {
  const issuedAt = Date.now();
  const payload = `${openid}:${issuedAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyWechatToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const colon = payload.indexOf(":");
    if (colon <= 0) return null;
    const openid = payload.slice(0, colon);
    const issuedAt = Number(payload.slice(colon + 1));
    if (!openid || Number.isNaN(issuedAt)) return null;
    if (Date.now() - issuedAt > TOKEN_TTL_MS) return null;
    return openid;
  } catch {
    return null;
  }
}

export interface WechatSession {
  openid: string;
  session_key?: string;
}

export async function exchangeWechatCode(code: string): Promise<WechatSession> {
  const appId = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appId || !secret) {
    throw new Error("未配置 WECHAT_APPID / WECHAT_SECRET");
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  const body = (await res.json()) as {
    openid?: string;
    session_key?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!body.openid) {
    throw new Error(body.errmsg ?? `微信登录失败 (${body.errcode ?? "unknown"})`);
  }

  return { openid: body.openid, session_key: body.session_key };
}

export function getOpenidFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyWechatToken(authHeader.slice(7));
}
