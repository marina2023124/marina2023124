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

export function JobDetailSections({
  job,
  compact = false,
}: {
  job: Pick<JobPosting, "jobIntro" | "responsibilities" | "requirements" | "description">;
  compact?: boolean;
}) {
  const { jobIntro, responsibilities, requirements } = getJobSections(job as JobPosting);

  if (compact) {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <p className="text-xs font-medium text-slate-500">岗位详情</p>
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">职位描述：</span>
          {jobIntro ? (
            <p className="mt-1 whitespace-pre-line line-clamp-3">{jobIntro}</p>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">岗位职责：</span>
          {responsibilities.length > 0 ? (
            <ul className="mt-1 list-inside list-decimal space-y-0.5">
              {responsibilities.slice(0, 3).map((r, i) => (
                <li key={i} className="line-clamp-2">{r}</li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">任职要求：</span>
          {requirements.length > 0 ? (
            <ul className="mt-1 list-inside list-decimal space-y-0.5">
              {requirements.slice(0, 3).map((r, i) => (
                <li key={i} className="line-clamp-2">{r}</li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        岗位详情 · 职位描述 / 岗位职责 / 任职要求
      </p>
      <SectionBlock title="职位描述" subtitle="工作时间、待遇、福利等">
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
