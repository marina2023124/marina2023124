"use client";

import { useState } from "react";
import { ExternalLink, Edit2, Trash2, X, Check } from "lucide-react";
import type { JobPosting, JobStatus } from "@/lib/types";
import { CommuteInfo } from "@/components/CommuteInfo";
import { JobDetailSections } from "@/components/JobDetailSections";
import { JobInterestRating } from "@/components/JobInterestRating";
import { assembleJobDescription } from "@/lib/job-sections";
import { getJobIndustry } from "@/lib/job-list";
import { Badge, Button, Card, Input, Select, Textarea } from "./ui";

const statusOptions: { value: JobStatus; label: string }[] = [
  { value: "saved", label: "已收藏" },
  { value: "applied", label: "已投递" },
  { value: "interview", label: "面试中" },
  { value: "rejected", label: "已拒绝" },
  { value: "offer", label: "已获 Offer" },
];

const statusColor: Record<JobStatus, "slate" | "indigo" | "amber" | "red" | "green"> = {
  saved: "slate",
  applied: "indigo",
  interview: "amber",
  rejected: "red",
  offer: "green",
};

function cloneJob(job: JobPosting): JobPosting {
  return {
    ...job,
    responsibilities: [...(job.responsibilities ?? [])],
    requirements: [...(job.requirements ?? [])],
    preferredSkills: [...(job.preferredSkills ?? [])],
  };
}

function JobCardEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: JobPosting;
  onChange: (patch: Partial<JobPosting>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border-2 border-indigo-300 bg-indigo-50/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-900">正在编辑</p>
        <div className="flex gap-1">
          <Button size="sm" onClick={onSave}>
            <Check className="h-4 w-4" /> 保存
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" /> 取消
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="岗位名称" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        <Input label="公司名称" value={draft.company} onChange={(e) => onChange({ company: e.target.value })} />
        <Input label="城市/区域" value={draft.location || ""} onChange={(e) => onChange({ location: e.target.value })} />
        <Input label="薪资" value={draft.salary || ""} onChange={(e) => onChange({ salary: e.target.value })} />
        <Input
          label="经验（年）"
          type="number"
          value={draft.experienceYears ?? ""}
          onChange={(e) =>
            onChange({ experienceYears: e.target.value ? Number(e.target.value) : undefined })
          }
        />
        <Input label="行业" value={draft.industry || ""} onChange={(e) => onChange({ industry: e.target.value })} />
        <Input
          label="工作地址"
          value={draft.workAddress || ""}
          onChange={(e) => onChange({ workAddress: e.target.value })}
          className="sm:col-span-2"
        />
        <Input label="链接" value={draft.url || ""} onChange={(e) => onChange({ url: e.target.value })} className="sm:col-span-2" />
        <Select
          label="状态"
          options={statusOptions}
          value={draft.status}
          onChange={(e) => onChange({ status: e.target.value as JobStatus })}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">个人意愿度</label>
        <JobInterestRating
          value={draft.interestRating ?? 0}
          onChange={(rating) => onChange({ interestRating: rating || undefined })}
        />
      </div>

      <Textarea
        label="职位描述（工时、福利、标签等）"
        rows={3}
        value={draft.jobIntro || ""}
        onChange={(e) => onChange({ jobIntro: e.target.value })}
      />
      <Textarea
        label="岗位职责（每行一条）"
        rows={5}
        value={(draft.responsibilities || []).join("\n")}
        onChange={(e) =>
          onChange({
            responsibilities: e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          })
        }
      />
      <Textarea
        label="任职要求（每行一条）"
        rows={5}
        value={(draft.requirements || []).join("\n")}
        onChange={(e) =>
          onChange({
            requirements: e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          })
        }
      />

      <CommuteInfo workAddress={draft.workAddress} />
    </div>
  );
}

export function JobCard({
  job,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onRate,
}: {
  job: JobPosting;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (job: JobPosting) => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
}) {
  const [draft, setDraft] = useState(() => cloneJob(job));

  const statusLabel = statusOptions.find((s) => s.value === job.status)?.label || job.status;
  const industry = getJobIndustry(job);

  const handleStartEdit = () => {
    setDraft(cloneJob(job));
    onEdit();
  };

  const handleCancel = () => {
    setDraft(cloneJob(job));
    onCancelEdit();
  };

  const handleSave = () => {
    if (!draft.title.trim()) {
      alert("请填写岗位名称");
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      company: draft.company.trim() || "未知公司",
      jobIntro: draft.jobIntro?.trim() || undefined,
      responsibilities: draft.responsibilities ?? [],
      requirements: draft.requirements ?? [],
      description: assembleJobDescription(draft) || draft.description,
    });
  };

  if (isEditing) {
    return (
      <Card className="ring-2 ring-indigo-300">
        <JobCardEditor
          draft={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
            <Badge color={statusColor[job.status]}>{statusLabel}</Badge>
            {industry !== "未分类" && <Badge color="slate">{industry}</Badge>}
          </div>
          <p className="text-sm text-indigo-600">{job.company}</p>
          <div className="mt-2">
            <JobInterestRating
              value={job.interestRating ?? 0}
              onChange={onRate}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {job.location && <span>{job.location}</span>}
            {job.salary && <span>{job.salary}</span>}
            {job.experienceYears != null && job.experienceYears > 0 && (
              <span>{job.experienceYears}年经验</span>
            )}
          </div>
          <CommuteInfo workAddress={job.workAddress} />
          <JobDetailSections job={job} compact />
          {job.preferredSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.preferredSkills.slice(0, 8).map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
              {job.preferredSkills.length > 8 && (
                <Badge>+{job.preferredSkills.length - 8}</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={handleStartEdit}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="编辑岗位"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="删除岗位"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
