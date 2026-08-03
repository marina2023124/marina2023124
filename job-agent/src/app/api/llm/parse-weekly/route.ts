import { NextResponse } from "next/server";
import { deepseekChat, LlmError, parseJsonFromLlm } from "@/lib/llm/deepseek";
import { buildWeeklyReportParsePrompt, type LlmWeeklyParseResult } from "@/lib/llm/prompts";
import { projectsFromLlmWeeklyDrafts } from "@/lib/weekly-report-parser";
import type { Project } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { text, existingProjects } = (await request.json()) as {
      text: string;
      existingProjects?: Project[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: "缺少周报文本" }, { status: 400 });
    }

    const { system, user } = buildWeeklyReportParsePrompt(text);
    const raw = await deepseekChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.2, maxTokens: 3500 }
    );

    const parsed = parseJsonFromLlm<LlmWeeklyParseResult>(raw);
    const projects = projectsFromLlmWeeklyDrafts(
      parsed.projects ?? [],
      text,
      existingProjects ?? []
    );

    if (!projects.length) {
      return NextResponse.json({ ok: false, error: "AI 未能从周报中识别项目" }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      projects,
      weekLabel: parsed.weekLabel,
      source: "llm" as const,
    });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "解析失败";
    const status = err instanceof LlmError && err.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
