"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, ExternalLink } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { JobPosting, JobStatus } from "@/lib/types";
import { generateId, parseSkillsFromText } from "@/lib/utils";
import { extractSkillsFromJobDescription } from "@/lib/matching";
import { Button, Card, Input, Textarea, Select, Badge, EmptyState } from "./ui";

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

function JobForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: JobPosting;
  onSave: (job: JobPosting) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<JobPosting>(
    initial || {
      id: generateId(),
      title: "",
      company: "",
      description: "",
      requirements: [],
      preferredSkills: [],
      status: "saved",
      createdAt: new Date().toISOString(),
    }
  );
  const [reqInput, setReqInput] = useState(form.requirements.join("\n"));

  const handleDescriptionChange = (desc: string) => {
    const extracted = extractSkillsFromJobDescription(desc);
    setForm((prev) => ({
      ...prev,
      description: desc,
      preferredSkills: Array.from(new Set([...prev.preferredSkills, ...extracted])),
    }));
  };

  const handleSave = () => {
    if (!form.title || !form.company) return;
    onSave({
      ...form,
      requirements: reqInput.split("\n").map((r) => r.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        {initial ? "编辑岗位" : "添加岗位"}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Input label="岗位名称 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="公司名称 *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <Input label="工作地点" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Input label="薪资范围" value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="如 20-35K" />
        <Input label="经验要求（年）" type="number" value={form.experienceYears ?? ""} onChange={(e) => setForm({ ...form, experienceYears: e.target.value ? Number(e.target.value) : undefined })} />
        <Input label="链接" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
      </div>
      <Textarea
        label="岗位描述（粘贴 JD，自动提取技能）"
        rows={6}
        value={form.description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        placeholder="粘贴完整的岗位描述..."
      />
      <Textarea
        label="岗位要求（每行一条）"
        rows={4}
        value={reqInput}
        onChange={(e) => setReqInput(e.target.value)}
        placeholder="3年以上前端开发经验&#10;精通 React/Vue&#10;熟悉 TypeScript"
      />
      <Input
        label="技能关键词（逗号分隔，可自动提取）"
        value={form.preferredSkills.join(", ")}
        onChange={(e) => setForm({ ...form, preferredSkills: parseSkillsFromText(e.target.value) })}
      />
      {form.preferredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {form.preferredSkills.map((s) => (
            <Badge key={s} color="indigo">{s}</Badge>
          ))}
        </div>
      )}
      <Select
        label="状态"
        options={statusOptions}
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}
      />
      <div className="flex gap-2">
        <Button onClick={handleSave}>保存</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

export function JobManager() {
  const { data, addJob, updateJob, deleteJob } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);

  const handleSave = (job: JobPosting) => {
    if (editing) {
      updateJob(job);
    } else {
      addJob(job);
    }
    setShowForm(false);
    setEditing(null);
  };

  if (data.jobs.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={<Plus className="h-8 w-8" />}
        title="还没有添加岗位"
        description="添加你感兴趣的 JD，系统会自动提取技能要求并计算与你的匹配度"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> 添加第一个岗位
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <JobForm
          initial={editing || undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> 添加岗位
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {data.jobs.map((job) => {
          const statusLabel = statusOptions.find((s) => s.value === job.status)?.label || job.status;
          return (
            <Card key={job.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                    <Badge color={statusColor[job.status]}>{statusLabel}</Badge>
                  </div>
                  <p className="text-sm text-indigo-600">{job.company}</p>
                  <div className="mt-1 flex gap-4 text-xs text-slate-500">
                    {job.location && <span>{job.location}</span>}
                    {job.salary && <span>{job.salary}</span>}
                    {job.experienceYears && <span>{job.experienceYears}年经验</span>}
                  </div>
                  {job.description && (
                    <p className="mt-3 line-clamp-3 text-sm text-slate-600">{job.description}</p>
                  )}
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
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => { setEditing(job); setShowForm(true); }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteJob(job.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
