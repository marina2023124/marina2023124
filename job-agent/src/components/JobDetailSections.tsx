"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { JobPosting } from "@/lib/types";
import { getJobSections } from "@/lib/job-sections";

function SectionBlock({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-indigo-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-indigo-50/40"
      >
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-400">{subtitle}</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>
      {open && <div className="border-t border-indigo-50 px-3 py-2.5">{children}</div>}
    </div>
  );
}

function EmptyHint() {
  return <p className="text-sm text-slate-400">暂未识别，请确认已粘贴完整 JD 并点击「智能识别」</p>;
}

function FullSections({
  jobIntro,
  responsibilities,
  requirements,
}: {
  jobIntro?: string;
  responsibilities: string[];
  requirements: string[];
}) {
  return (
    <div className="space-y-2">
      <SectionBlock title="职位描述" subtitle="工作时间、待遇、福利、标签等">
        {jobIntro ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{jobIntro}</p>
        ) : (
          <EmptyHint />
        )}
      </SectionBlock>
      <SectionBlock title="岗位职责" subtitle="这个岗位要做什么">
        {responsibilities.length > 0 ? (
          <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
            {responsibilities.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        ) : (
          <EmptyHint />
        )}
      </SectionBlock>
      <SectionBlock title="任职要求" subtitle="这个岗位要怎样的人（任职条件）" defaultOpen>
        {requirements.length > 0 ? (
          <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
            {requirements.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        ) : (
          <EmptyHint />
        )}
      </SectionBlock>
    </div>
  );
}

export function JobDetailSections({
  job,
  compact = false,
}: {
  job: Pick<JobPosting, "jobIntro" | "responsibilities" | "requirements" | "description" | "preferredSkills">;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { jobIntro, responsibilities, requirements } = getJobSections(job as JobPosting);
  const introText =
    jobIntro ||
    (job.preferredSkills?.length ? `技能标签：${job.preferredSkills.join("、")}` : undefined);

  if (compact && !expanded) {
    const respPreview = responsibilities[0];
    const reqPreview = requirements[0];
    const totalParts = [
      introText ? "职位描述" : "",
      responsibilities.length ? `岗位职责 ${responsibilities.length} 条` : "",
      requirements.length ? `任职要求 ${requirements.length} 条` : "",
    ].filter(Boolean);

    return (
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">岗位详情</p>
          {(responsibilities.length > 1 || requirements.length > 1 || (introText && introText.length > 80)) && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              展开全部
            </button>
          )}
        </div>
        {totalParts.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">{totalParts.join(" · ")}</p>
        )}
        <div className="mt-2 space-y-2 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">职位描述：</span>
            {introText ? (
              <p className="mt-1 whitespace-pre-line">{introText}</p>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
          {respPreview && (
            <div>
              <span className="font-medium text-slate-700">岗位职责：</span>
              <p className="mt-1 whitespace-pre-line">{respPreview}</p>
              {responsibilities.length > 1 && (
                <p className="mt-1 text-xs text-slate-400">还有 {responsibilities.length - 1} 条…</p>
              )}
            </div>
          )}
          {reqPreview && (
            <div>
              <span className="font-medium text-slate-700">任职要求：</span>
              <p className="mt-1 whitespace-pre-line">{reqPreview}</p>
              {requirements.length > 1 && (
                <p className="mt-1 text-xs text-slate-400">还有 {requirements.length - 1} 条…</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (compact && expanded) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            收起详情
          </button>
        </div>
        <FullSections
          jobIntro={introText}
          responsibilities={responsibilities}
          requirements={requirements}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        岗位详情 · 职位描述 / 岗位职责 / 任职要求
      </p>
      <FullSections
        jobIntro={introText}
        responsibilities={responsibilities}
        requirements={requirements}
      />
    </div>
  );
}
