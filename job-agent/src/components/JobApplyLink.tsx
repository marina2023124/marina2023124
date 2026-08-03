"use client";

import { ExternalLink } from "lucide-react";
import type { JobPosting } from "@/lib/types";
import { Button } from "./ui";

export function JobApplyLink({
  job,
  variant = "button",
  className,
}: {
  job: Pick<JobPosting, "url" | "title" | "company">;
  variant?: "button" | "compact";
  className?: string;
}) {
  if (!job.url?.trim()) return null;

  const label = variant === "compact" ? "原链接" : "前往投递";

  if (variant === "compact") {
    return (
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        }
        title={`打开 ${job.company} · ${job.title} 原始 JD 页面`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </a>
    );
  }

  return (
    <a href={job.url} target="_blank" rel="noopener noreferrer" className={className}>
      <Button type="button" variant="secondary" size="sm" className="gap-1.5">
        <ExternalLink className="h-4 w-4" />
        {label}
      </Button>
    </a>
  );
}
