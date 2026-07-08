"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { JobPosting } from "@/lib/types";
import { getJobSections } from "@/lib/job-sections";

function SectionBlock({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200 bg-white/80">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-3 py-2">{children}</div>}
    </div>
  );
}

export function JobDetailSections({
  job,
  compact = false,
}: {
  job: Pick<JobPosting, "jobIntro" | "responsibilities" | "requirements" | "description">;
  compact?: boolean;
}) {
  const { jobIntro, responsibilities, requirements } = getJobSections(job as JobPosting);

  if (!jobIntro && !responsibilities.length && !requirements.length) return null;

  if (compact) {
    return (
      <div className="mt-3 space-y-2">
        {jobIntro && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">职位描述：</span>
            <p className="mt-1 whitespace-pre-line line-clamp-4">{jobIntro}</p>
          </div>
        )}
        {responsibilities.length > 0 && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">岗位职责：</span>
            <ul className="mt-1 list-inside list-decimal space-y-0.5">
              {responsibilities.slice(0, 3).map((r, i) => (
                <li key={i} className="line-clamp-2">{r}</li>
              ))}
              {responsibilities.length > 3 && (
                <li className="text-slate-400">...还有 {responsibilities.length - 3} 条</li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobIntro && (
        <SectionBlock title="职位描述">
          <p className="mb-1 text-xs text-slate-400">工作时间、待遇、福利等</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{jobIntro}</p>
        </SectionBlock>
      )}
      {responsibilities.length > 0 && (
        <SectionBlock title="岗位职责">
          <p className="mb-1 text-xs text-slate-400">这个岗位要做什么</p>
          <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
            {responsibilities.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        </SectionBlock>
      )}
      {requirements.length > 0 && (
        <SectionBlock title="任职要求" defaultOpen={false}>
          <p className="mb-1 text-xs text-slate-400">这个岗位要怎样的人</p>
          <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
            {requirements.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        </SectionBlock>
      )}
    </div>
  );
}
