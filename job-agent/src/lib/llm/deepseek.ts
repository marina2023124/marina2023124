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
    throw new LlmError("未配置 DeepSeek API Key，请在 .env.local 设置 DEEPSEEK_API_KEY");
  }

  const { apiKey, baseUrl, model } = getDeepSeekConfig();

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
    throw new LlmError(
      body.includes("invalid") ? "DeepSeek API Key 无效" : `DeepSeek 请求失败 (${res.status})`,
      res.status
    );
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
