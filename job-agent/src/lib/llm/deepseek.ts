import { getDeepSeekConfig, isDeepSeekConfigured } from "./config";
import { serverFetch } from "@/lib/supabase/server-fetch";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export async function deepseekChat(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!isDeepSeekConfigured()) {
    throw new LlmError("未配置 DeepSeek API Key，请在 .env.local 或 Vercel 设置 DEEPSEEK_API_KEY");
  }

  const { apiKey, baseUrl, model } = getDeepSeekConfig();

  if (!apiKey.startsWith("sk-")) {
    throw new LlmError(
      "DeepSeek API Key 格式不对：应以 sk- 开头。请到 https://platform.deepseek.com/api_keys 创建新 Key"
    );
  }

  const res = await serverFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || body.includes("invalid") || body.includes("Authentication")) {
      throw new LlmError(
        "DeepSeek API Key 无效或已过期。请到 platform.deepseek.com 创建以 sk- 开头的新 Key，并确认账户有余额",
        res.status
      );
    }
    throw new LlmError(`DeepSeek 请求失败 (${res.status})`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new LlmError(data.error.message);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new LlmError("DeepSeek 返回为空");
  }

  return content;
}

export function parseJsonFromLlm<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  return JSON.parse(raw) as T;
}

/** Minimal live call to verify the configured key works with DeepSeek. */
export async function verifyDeepSeekKey(): Promise<{
  liveValid: boolean;
  httpStatus?: number;
  reason?: string;
}> {
  if (!isDeepSeekConfigured()) {
    return { liveValid: false, reason: "not_configured" };
  }

  const { apiKey, baseUrl, model } = getDeepSeekConfig();

  if (!apiKey.startsWith("sk-")) {
    return { liveValid: false, reason: "format_invalid" };
  }

  try {
    const res = await serverFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });

    if (res.ok) {
      return { liveValid: true, httpStatus: res.status };
    }

    const body = await res.text().catch(() => "");
    if (res.status === 402 || body.includes("Insufficient Balance")) {
      return { liveValid: false, httpStatus: res.status, reason: "insufficient_balance" };
    }
    if (res.status === 401 || body.includes("invalid") || body.includes("Authentication")) {
      return { liveValid: false, httpStatus: res.status, reason: "invalid_key" };
    }

    return { liveValid: false, httpStatus: res.status, reason: "request_failed" };
  } catch {
    return { liveValid: false, reason: "network_error" };
  }
}
