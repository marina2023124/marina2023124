import { NextResponse } from "next/server";
import { deepseekChat, LlmError, parseJsonFromLlm } from "@/lib/llm/deepseek";
import { buildProjectSummariesPrompt } from "@/lib/llm/prompts";
import type { Project } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { projects } = (await request.json()) as { projects: Project[] };

    if (!projects?.length) {
      return NextResponse.json({ ok: false, error: "缺少项目数据" }, { status: 400 });
    }

    const { system, user } = buildProjectSummariesPrompt(projects);
    const raw = await deepseekChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.35, maxTokens: 3000 }
    );

    const parsed = parseJsonFromLlm<{ summaries: { id: string; workSummary: string }[] }>(raw);
    const summaries: Record<string, string> = {};
    for (const item of parsed.summaries ?? []) {
      if (item.id && item.workSummary?.trim()) {
        summaries[item.id] = item.workSummary.trim();
      }
    }

    return NextResponse.json({ ok: true, summaries });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "总结失败";
    const status = err instanceof LlmError && err.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
