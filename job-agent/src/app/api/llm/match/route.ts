import { NextResponse } from "next/server";
import { deepseekChat, LlmError, parseJsonFromLlm } from "@/lib/llm/deepseek";
import { buildMatchAnalysisPrompt, type LlmMatchAnalysis } from "@/lib/llm/prompts";
import { matchJob } from "@/lib/matching";
import type { JobPosting, Profile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { profile, job } = (await request.json()) as {
      profile: Profile;
      job: JobPosting;
    };

    if (!profile || !job) {
      return NextResponse.json({ ok: false, error: "缺少 profile 或 job" }, { status: 400 });
    }

    const ruleMatch = matchJob(profile, job);
    const { system, user } = buildMatchAnalysisPrompt(profile, job, ruleMatch);

    const raw = await deepseekChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.35, maxTokens: 2500 }
    );

    const analysis = parseJsonFromLlm<LlmMatchAnalysis>(raw);

    return NextResponse.json({
      ok: true,
      analysis,
      ruleScore: ruleMatch.score,
    });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "分析失败";
    const status = err instanceof LlmError && err.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
