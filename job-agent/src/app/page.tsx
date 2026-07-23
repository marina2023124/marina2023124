"use client";

import Link from "next/link";
import {
  User,
  Briefcase,
  Target,
  MessageSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { matchAllJobs, getScoreLabel } from "@/lib/matching";
import { calcTotalExperienceYears } from "@/lib/utils";
import { Card, Button, Badge, ScoreRing } from "@/components/ui";

function StatCard({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="!p-5 transition-all group-hover:border-indigo-200 group-hover:shadow-md">
        <p className="text-sm text-slate-500 group-hover:text-indigo-600">{label}</p>
        <div className="mt-1">{value}</div>
        {sub && <div className="mt-1">{sub}</div>}
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { data } = useApp();
  const { profile, jobs } = data;
  const totalYears = calcTotalExperienceYears(profile.workExperiences);
  const matches = matchAllJobs(profile, jobs);
  const topMatch = matches[0];

  const completeness = [
    profile.name ? 25 : 0,
    profile.workExperiences.length > 0 ? 25 : 0,
    profile.skills.length > 0 ? 25 : 0,
    jobs.length > 0 ? 25 : 0,
  ].reduce((a, b) => a + b, 0);

  const quickLinks = [
    { href: "/experience", icon: User, label: "完善经历", desc: "录入工作和项目经验", color: "from-blue-500 to-cyan-500" },
    { href: "/jobs", icon: Briefcase, label: "添加岗位", desc: "收藏感兴趣的 JD", color: "from-violet-500 to-purple-500" },
    { href: "/match", icon: Target, label: "查看匹配", desc: "智能分析匹配度", color: "from-emerald-500 to-teal-500" },
    { href: "/agent", icon: MessageSquare, label: "咨询顾问", desc: "AI 职业顾问对话", color: "from-orange-500 to-red-500" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {profile.name ? `你好，${profile.name}` : "欢迎使用 JobAgent"}
        </h1>
        <p className="mt-1 text-slate-500">智能求职助手 — 梳理经历，匹配理想岗位</p>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-slate-500">档案完整度</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{completeness}%</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${completeness}%` }} />
          </div>
        </Card>
        <StatCard
          href="/experience"
          label="工作经验"
          value={
            <p className="text-3xl font-bold text-slate-900 group-hover:text-indigo-600">
              {totalYears}
              <span className="text-lg font-normal text-slate-400">年</span>
            </p>
          }
          sub={
            <p className="text-xs text-slate-400">
              {profile.workExperiences.length} 段经历
              {totalYears > 0 && " · 已合并重叠区间"}
            </p>
          }
        />
        <StatCard
          href="/experience"
          label="技能数量"
          value={
            <p className="text-3xl font-bold text-slate-900 group-hover:text-indigo-600">
              {profile.skills.length}
            </p>
          }
          sub={<p className="text-xs text-slate-400">{profile.projects.length} 个项目</p>}
        />
        <StatCard
          href="/jobs"
          label="关注岗位"
          value={
            <p className="text-3xl font-bold text-slate-900 group-hover:text-indigo-600">{jobs.length}</p>
          }
          sub={
            topMatch ? (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" /> 最高匹配 {topMatch.score}%
              </p>
            ) : undefined
          }
        />
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {quickLinks.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}>
            <div className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md">
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600">{label}</h3>
              <p className="mt-1 text-xs text-slate-500">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="快速开始">
          <div className="space-y-3">
            {completeness < 100 ? (
              <>
                {!profile.name && (
                  <StepItem done={false} text="填写基本信息（姓名、目标岗位）" href="/experience" />
                )}
                {profile.workExperiences.length === 0 && (
                  <StepItem done={false} text="添加至少一段工作经历" href="/experience" />
                )}
                {profile.skills.length === 0 && (
                  <StepItem done={false} text="录入你的核心技能" href="/experience" />
                )}
                {jobs.length === 0 && (
                  <StepItem done={false} text="添加感兴趣的岗位 JD" href="/jobs" />
                )}
              </>
            ) : (
              <p className="text-sm text-emerald-600">档案已完善！去查看匹配结果或咨询职业顾问吧。</p>
            )}
            {profile.name && <StepItem done text="基本信息已填写" />}
            {profile.workExperiences.length > 0 && <StepItem done text={`已录入 ${profile.workExperiences.length} 段工作经历`} />}
            {profile.skills.length > 0 && <StepItem done text={`已录入 ${profile.skills.length} 项技能`} />}
            {jobs.length > 0 && <StepItem done text={`已关注 ${jobs.length} 个岗位`} />}
          </div>
        </Card>

        <Card
          title="最佳匹配"
          action={
            jobs.length > 0 ? (
              <Link href="/match">
                <Button variant="ghost" size="sm">查看全部 <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            ) : undefined
          }
        >
          {topMatch ? (
            <div className="flex items-start gap-4">
              <ScoreRing score={topMatch.score} size={72} />
              <div className="min-w-0 flex-1">
                {(() => {
                  const job = jobs.find((j) => j.id === topMatch.jobId)!;
                  return (
                    <>
                      <h4 className="font-semibold text-slate-900">{job.title}</h4>
                      <p className="text-sm text-indigo-600">{job.company}</p>
                      <Badge color="green">{getScoreLabel(topMatch.score)}</Badge>
                      {topMatch.matchedSkills.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">
                          匹配：{topMatch.matchedSkills.slice(0, 4).join("、")}
                        </p>
                      )}
                      {topMatch.matchedProjects.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-slate-500">相关项目</p>
                          <ul className="mt-1 space-y-1">
                            {topMatch.matchedProjects.slice(0, 3).map((p) => (
                              <li key={p.id} className="text-xs text-emerald-700">
                                <span className="font-medium text-slate-700">{p.name}</span>
                                {p.summary && (
                                  <span className="block truncate text-slate-500">{p.summary}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">添加岗位后，这里会显示最佳匹配推荐</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StepItem({ done, text, href }: { done?: boolean; text: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
        {done ? "✓" : "○"}
      </div>
      <span className={`text-sm ${done ? "text-slate-500" : "text-slate-700"}`}>{text}</span>
      {href && !done && <ArrowRight className="ml-auto h-4 w-4 text-indigo-400" />}
    </div>
  );

  if (href && !done) {
    return <Link href={href} className="block rounded-lg p-2 transition-colors hover:bg-slate-50">{content}</Link>;
  }
  return <div className="p-2">{content}</div>;
}
