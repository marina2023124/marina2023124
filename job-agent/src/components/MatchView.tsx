"use client";

import { useApp } from "@/context/AppContext";
import { matchAllJobs, getScoreLabel } from "@/lib/matching";
import { Card, ScoreRing, Badge, EmptyState } from "./ui";
import { Target } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui";

function MatchedProjectsList({
  projects,
}: {
  projects: { id: string; name: string; summary: string; reasons: string[] }[];
}) {
  if (projects.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase text-slate-400">匹配项目经历</p>
      <ul className="space-y-3">
        {projects.map((project) => (
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
  );
}

export function MatchView() {
  const { data } = useApp();
  const matches = matchAllJobs(data.profile, data.jobs);

  if (data.jobs.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-8 w-8" />}
        title="暂无匹配数据"
        description="请先在「岗位管理」中添加感兴趣的 JD，系统会根据你的技能和经验自动计算匹配度"
        action={
          <Link href="/jobs">
            <Button>去添加岗位</Button>
          </Link>
        }
      />
    );
  }

  if (data.profile.workExperiences.length === 0 && data.profile.skills.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-8 w-8" />}
        title="请先完善个人经历"
        description="添加工作经历和技能后，匹配结果会更准确"
        action={
          <Link href="/experience">
            <Button>完善我的经历</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
        <h2 className="text-xl font-bold">智能匹配结果</h2>
        <p className="mt-1 text-indigo-100">
          基于你的{" "}
          <Link href="/experience" className="underline underline-offset-2 hover:text-white">
            {data.profile.skills.length} 项技能
          </Link>{" "}
          和{" "}
          <Link href="/experience" className="underline underline-offset-2 hover:text-white">
            {data.profile.workExperiences.length} 段工作经历
          </Link>
          ，分析了{" "}
          <Link href="/jobs" className="underline underline-offset-2 hover:text-white">
            {data.jobs.length} 个岗位
          </Link>{" "}
          的匹配度
        </p>
      </div>

      <div className="grid gap-6">
        {matches.map((match) => {
          const job = data.jobs.find((j) => j.id === match.jobId)!;
          return (
            <Card key={match.jobId}>
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <ScoreRing score={match.score} />
                  <p className="mt-2 text-center text-xs font-medium text-slate-500">
                    {getScoreLabel(match.score)}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                    <span className="text-sm text-indigo-600">{job.company}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-slate-500">
                    {job.location && <span>{job.location}</span>}
                    {job.salary && <span>{job.salary}</span>}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-slate-400">匹配技能</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.matchedSkills.length > 0 ? (
                          match.matchedSkills.slice(0, 6).map((s) => (
                            <Badge key={s} color="green">{s}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">暂无匹配</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-slate-400">待补充</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.missingSkills.length > 0 ? (
                          match.missingSkills.slice(0, 6).map((s) => (
                            <Badge key={s} color="amber">{s}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-emerald-500">全部匹配 ✓</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <MatchedProjectsList projects={match.matchedProjects} />

                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{match.recommendation}</p>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-slate-500">
                    <span>技能匹配 {match.skillMatch}%</span>
                    <span>经验匹配 {match.experienceMatch}%</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
