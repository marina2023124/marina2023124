"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { JobPosting, MatchResult, Profile } from "@/lib/types";
import type { LlmMatchAnalysis } from "@/lib/llm/prompts";
import { Button } from "./ui";

export function LlmMatchPanel({
  profile,
  job,
  ruleMatch,
}: {
  profile: Profile;
  job: JobPosting;
  ruleMatch: MatchResult;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LlmMatchAnalysis | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);

  const checkStatus = async () => {
    if (llmReady !== null) return llmReady;
    try {
      const res = await fetch("/api/llm/status");
      const body = (await res.json()) as { configured: boolean };
      setLlmReady(body.configured);
      return body.configured;
    } catch {
      setLlmReady(false);
      return false;
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    const configured = await checkStatus();
    if (!configured) {
      setError("未配置 DeepSeek。请在 .env.local 添加 DEEPSEEK_API_KEY 后重启服务");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/llm/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, job }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        analysis?: LlmMatchAnalysis;
      };

      if (!res.ok || !body.ok || !body.analysis) {
        throw new Error(body.error ?? "AI 分析失败");
      }

      setAnalysis(body.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分析失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-900">
          <Sparkles className="h-4 w-4" />
          AI 深度匹配（DeepSeek）
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={runAnalysis}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              分析中…
            </>
          ) : analysis ? (
            "重新分析"
          ) : (
            "生成简历向匹配"
          )}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {analysis && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="leading-relaxed text-slate-700">{analysis.overall}</p>

          {analysis.recommendedProjects.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase text-violet-800">AI 推荐写入简历的项目</p>
              {analysis.recommendedProjects.map((project) => (
                <div
                  key={`${project.workExperience}-${project.projectName}`}
                  className="rounded-lg border border-violet-100 bg-white px-3 py-2.5"
                >
                  <p className="font-medium text-slate-900">{project.projectName}</p>
                  <p className="text-xs text-indigo-600">{project.workExperience}</p>
                  <p className="mt-1 text-xs text-slate-600">{project.outcomeSentence}</p>
                  {project.resumeBullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                      {project.resumeBullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                  {project.matchReasons.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {project.matchReasons.map((reason) => (
                        <li key={reason} className="text-xs text-violet-800">· {reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {analysis.gaps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-800">仍需补强</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {analysis.gaps.map((gap) => (
                  <li key={gap}>· {gap}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.resumeAdvice && (
            <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              💡 {analysis.resumeAdvice}
            </p>
          )}
        </div>
      )}

      {!analysis && !error && !loading && (
        <p className="mt-2 text-xs text-violet-700/80">
          规则初筛 {ruleMatch.score}% · 点击后由 DeepSeek 结合 JD 全文生成简历向推荐
        </p>
      )}
    </div>
  );
}
