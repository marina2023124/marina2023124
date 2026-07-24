import { NextResponse } from "next/server";
import { deepseekChat, LlmError } from "@/lib/llm/deepseek";
import { buildAgentChatPrompt } from "@/lib/llm/prompts";
import type { AppData } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { data, message } = (await request.json()) as {
      data: AppData;
      message: string;
    };

    if (!data || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "缺少对话内容" }, { status: 400 });
    }

    const { system, messages } = buildAgentChatPrompt(data, message.trim());

    const content = await deepseekChat(
      [{ role: "system", content: system }, ...messages],
      { temperature: 0.6, maxTokens: 1800 }
    );

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "对话失败";
    const status = err instanceof LlmError && err.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
