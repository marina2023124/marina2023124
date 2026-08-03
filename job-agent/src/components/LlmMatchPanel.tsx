"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { JobPosting, MatchedProject, MatchResult, Profile, JdRequirementMatch } from "@/lib/types";
import type { LlmMatchAnalysis } from "@/lib/llm/prompts";
import { Button } from "./ui";
import { JdRequirementMatchList } from "./JdRequirementMatchList";

function groupMatchedProjectsByWork(projects: MatchedProject[]): { label: string; projects: MatchedProject[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, MatchedProject[]>();

  for (const project of projects) {
    const label = project.workExperienceLabel;
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(project);
  }

  return order.map((label) => ({ label, projects: buckets.get(label)! }));
}

function groupRecommendedProjects(
  projects: LlmMatchAnalysis["recommendedProjects"]
): { label: string; projects: LlmMatchAnalysis["recommendedProjects"] }[] {
  const order: string[] = [];
  const buckets = new Map<string, LlmMatchAnalysis["recommendedProjects"]>();

  for (const project of projects) {
    const label = project.workExperience || "未关联工作";
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(project);
  }

  return order.map((label) => ({ label, projects: buckets.get(label)! }));
}

function MatchedProjectsSection({
  projects,
  source,
}: {
  projects: MatchedProject[];
  source: "rule" | "ai";
}) {
  if (projects.length === 0) return null;

  const groups = groupMatchedProjectsByWork(projects);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-medium uppercase text-slate-400">匹配项目经历</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            source === "ai" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {source === "ai" ? "AI 精准匹配" : "规则初筛"}
        </span>
      </div>
      <div className="space-y-4">
        {groups.map(({ label, projects: groupProjects }) => (
          <div key={label}>
            <p className="mb-2 text-xs font-medium text-indigo-700">{label}</p>
            <ul className="space-y-3">
              {groupProjects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-slate-800">{project.name}</p>
                  {project.summary && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{project.summary}</p>
                  )}
                  {project.reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {project.reasons.map((reason) => (
                        <li key={reason} className="flex gap-1.5 text-xs leading-relaxed text-emerald-800">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchedProjectsLoading() {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-medium uppercase text-slate-400">匹配项目经历</p>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
          AI 分析中…
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-4 text-sm text-violet-800">
        <Loader2 className="h-4 w-4 animate-spin" />
        DeepSeek 正在结合 JD 全文筛选匹配项目…
      </div>
    </div>
  );
}

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
  const [autoPending, setAutoPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LlmMatchAnalysis | null>(null);
  const [llmMatchedProjects, setLlmMatchedProjects] = useState<MatchedProject[] | null>(null);
  const [llmRequirementMappings, setLlmRequirementMappings] = useState<JdRequirementMatch[] | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const autoStartedRef = useRef(false);

  const hasLlmRequirements = Boolean(llmRequirementMappings?.length);
  const displayRequirements = hasLlmRequirements
    ? llmRequirementMappings!
    : ruleMatch.requirementMatches;
  const requirementSource = hasLlmRequirements ? "ai" : "rule";
  const showRequirementsLoading = autoPending && loading && !hasLlmRequirements;

  const hasLlmProjects = Boolean(llmMatchedProjects?.length);
  const displayProjects = hasLlmProjects
    ? llmMatchedProjects!
    : autoPending && loading
      ? []
      : ruleMatch.matchedProjects;
  const projectSource = hasLlmProjects ? "ai" : "rule";
  const showProjectsLoading = autoPending && loading && !hasLlmProjects;

  const checkStatus = useCallback(async () => {
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
  }, [llmReady]);

  const runAnalysis = useCallback(async (options?: { silent?: boolean }) => {
    setLoading(true);
    if (!options?.silent) setError(null);

    const configured = await checkStatus();
    if (!configured) {
      setAutoPending(false);
      if (!options?.silent) {
        setError("未配置 DeepSeek。请在 Vercel Environment Variables 添加 DEEPSEEK_API_KEY 后 Redeploy");
      }
      setLoading(false);
      return;
    }

    const statusRes = await fetch("/api/llm/status");
    const statusBody = (await statusRes.json()) as {
      formatValid?: boolean;
      liveValid?: boolean;
      hint?: string;
      vercelEnv?: string;
    };
    if (statusBody.formatValid === false) {
      setAutoPending(false);
      if (!options?.silent) {
        setError(statusBody.hint ?? "DeepSeek Key 格式不对，应以 sk- 开头");
      }
      setLoading(false);
      return;
    }
    if (statusBody.liveValid === false) {
      setAutoPending(false);
      if (!options?.silent) {
        setError(
          statusBody.hint ??
            (statusBody.vercelEnv === "preview"
              ? "Preview 部署未生效 DeepSeek Key：请在 Vercel 环境变量勾选 Preview 并 Redeploy"
              : "DeepSeek Key 无效，请到 platform.deepseek.com 新建 Key 并更新 Vercel")
        );
      }
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
        matchedProjects?: MatchedProject[];
        requirementMappings?: JdRequirementMatch[];
      };

      if (!res.ok || !body.ok || !body.analysis) {
        throw new Error(body.error ?? "AI 分析失败");
      }

      setAnalysis(body.analysis);
      if (body.requirementMappings?.length) {
        setLlmRequirementMappings(body.requirementMappings);
      } else {
        setLlmRequirementMappings(null);
      }
      if (body.matchedProjects?.length) {
        setLlmMatchedProjects(body.matchedProjects);
      } else {
        setLlmMatchedProjects(null);
      }
      setError(null);
    } catch (err) {
      setAutoPending(false);
      const message = err instanceof Error ? err.message : "AI 分析失败";
      if (!options?.silent) setError(message);
    } finally {
      setAutoPending(false);
      setLoading(false);
    }
  }, [checkStatus, job, profile]);

  useEffect(() => {
    autoStartedRef.current = false;
    setAutoPending(true);
    setLlmMatchedProjects(null);
    setLlmRequirementMappings(null);
    setAnalysis(null);
    setError(null);
  }, [job.id]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void runAnalysis({ silent: true });
  }, [runAnalysis, job.id]);

  return (
    <>
      {showRequirementsLoading ? (
        <MatchedProjectsLoading />
      ) : (
        <JdRequirementMatchList items={displayRequirements} source={requirementSource} />
      )}

      {!hasLlmRequirements && !autoPending && !loading && ruleMatch.requirementMatches.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {error
            ? "AI 逐条匹配不可用，已展示规则匹配结果"
            : "规则逐条匹配已生成，配置 DeepSeek 后将自动 AI 优化"}
        </p>
      )}

      {showProjectsLoading ? (
        <MatchedProjectsLoading />
      ) : (
        <MatchedProjectsSection projects={displayProjects} source={projectSource} />
      )}

      {!llmMatchedProjects && !autoPending && !loading && ruleMatch.matchedProjects.length <= 2 && (
        <p className="mt-2 text-xs text-amber-700">
          {error
            ? `AI 分析不可用，已展示规则初筛（${ruleMatch.matchedProjects.length} 个项目）`
            : `规则初筛仅 ${ruleMatch.matchedProjects.length} 个项目，可能偏少。点击「重新分析」重试 AI 匹配。`}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-900">
            <Sparkles className="h-4 w-4" />
            AI 深度匹配（DeepSeek）
            {loading && (
              <span className="text-xs font-normal text-violet-600">分析中…</span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => void runAnalysis()}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                分析中…
              </>
            ) : analysis ? (
              "重新分析"
            ) : (
              "重新分析"
            )}
          </Button>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {analysis && (
          <div className="mt-3 space-y-3 text-sm">
            <p className="leading-relaxed text-slate-700">{analysis.overall}</p>

            {analysis.recommendedProjects.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase text-violet-800">AI 推荐写入简历的项目</p>
                {groupRecommendedProjects(analysis.recommendedProjects).map(({ label, projects }) => (
                  <div key={label}>
                    <p className="mb-2 text-xs font-medium text-indigo-700">{label}</p>
                    <div className="space-y-3">
                      {projects.map((project) => (
                        <div
                          key={`${project.workExperience}-${project.projectName}`}
                          className="rounded-lg border border-violet-100 bg-white px-3 py-2.5"
                        >
                          <p className="font-medium text-slate-900">{project.projectName}</p>
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
                                <li key={reason} className="text-xs text-violet-800">
                                  · {reason}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
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

        {!analysis && !error && loading && (
          <p className="mt-2 text-xs text-violet-700/80">
            正在由 DeepSeek 分析匹配项目与简历建议…
          </p>
        )}

        {!analysis && !error && !loading && !llmMatchedProjects && (
          <p className="mt-2 text-xs text-violet-700/80">
            规则初筛 {ruleMatch.score}% · 已展示规则匹配结果，配置 DeepSeek 后将自动 AI 分析
          </p>
        )}
      </div>
    </>
  );
}
