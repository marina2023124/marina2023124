"use client";

import { useCallback, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  ImagePlus,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { JobPosting, JobStatus } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { parseJobDescription } from "@/lib/jd-parser";
import { extractTextFromImage, isImageFile } from "@/lib/ocr";
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

function SmartJobInput({
  initial,
  onSave,
  onCancel,
}: {
  initial?: JobPosting;
  onSave: (job: JobPosting) => void;
  onCancel: () => void;
}) {
  const [rawInput, setRawInput] = useState(initial?.description || "");
  const [preview, setPreview] = useState<JobPosting | null>(initial || null);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(!!initial);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runParse = useCallback((text: string) => {
    const parsed = parseJobDescription(text);
    setPreview((prev) => ({
      id: prev?.id || initial?.id || generateId(),
      title: parsed.title || prev?.title || "",
      company: parsed.company || prev?.company || "",
      location: parsed.location ?? prev?.location,
      salary: parsed.salary ?? prev?.salary,
      experienceYears: parsed.experienceYears ?? prev?.experienceYears,
      url: parsed.url ?? prev?.url,
      description: parsed.description,
      requirements: parsed.requirements.length > 0 ? parsed.requirements : prev?.requirements || [],
      preferredSkills: parsed.preferredSkills.length > 0 ? parsed.preferredSkills : prev?.preferredSkills || [],
      status: prev?.status || initial?.status || "saved",
      createdAt: prev?.createdAt || initial?.createdAt || new Date().toISOString(),
    }));
  }, [initial]);

  const handleSmartParse = async () => {
    if (!rawInput.trim()) return;
    setParsing(true);
    try {
      runParse(rawInput);
      setShowDetails(true);
    } finally {
      setParsing(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!isImageFile(file)) {
      alert("请上传图片文件（PNG、JPG 等）");
      return;
    }
    setImagePreview(URL.createObjectURL(file));
    setParsing(true);
    setOcrProgress("正在识别截图文字...");
    try {
      const text = await extractTextFromImage(file);
      if (!text.trim()) {
        alert("未能从图片中识别到文字，请尝试更清晰的截图或直接粘贴文字");
        return;
      }
      setRawInput(text);
      runParse(text);
      setShowDetails(true);
      setOcrProgress(null);
    } catch {
      alert("图片识别失败，请直接粘贴 JD 文字");
    } finally {
      setParsing(false);
      setOcrProgress(null);
    }
  };

  const handleSave = () => {
    if (!preview?.title) {
      alert("未能识别岗位名称，请手动补充");
      setShowDetails(true);
      return;
    }
    onSave({
      ...preview,
      company: preview.company || "未知公司",
      description: rawInput || preview.description,
    });
  };

  const updatePreview = (patch: Partial<JobPosting>) => {
    setPreview((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="space-y-5 rounded-xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {initial ? "编辑岗位" : "智能添加岗位"}
          </h3>
          <p className="text-sm text-slate-500">粘贴 JD 文字或上传截图，自动识别关键信息</p>
        </div>
      </div>

      {/* 文字输入 */}
      <Textarea
        label="粘贴岗位描述"
        rows={8}
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={"直接粘贴招聘网站的 JD，例如：\n\n字节跳动 · 高级前端工程师\n北京 | 30-50K | 3-5年\n\n【岗位职责】\n1. 负责...\n\n【任职要求】\n1. 精通 React/TypeScript\n2. 3年以上前端经验"}
      />

      {/* 截图上传 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">或上传 JD 截图</label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleImageUpload(file);
          }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="预览" className="mb-3 max-h-40 rounded-lg object-contain" />
          ) : (
            <ImagePlus className="mb-2 h-8 w-8 text-slate-400" />
          )}
          <p className="text-sm text-slate-600">点击或拖拽上传招聘截图</p>
          <p className="mt-1 text-xs text-slate-400">支持 PNG、JPG，自动 OCR 识别文字</p>
          {ocrProgress && (
            <p className="mt-2 flex items-center gap-2 text-sm text-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin" /> {ocrProgress}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </div>
      </div>

      <Button onClick={handleSmartParse} disabled={!rawInput.trim() || parsing} className="w-full">
        {parsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 识别中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> 智能识别
          </>
        )}
      </Button>

      {/* 识别结果预览 */}
      {preview && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold text-emerald-900">识别结果</h4>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              {showDetails ? "收起" : "调整细节"}
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-slate-500">岗位：</span><span className="font-medium text-slate-900">{preview.title || "—"}</span></div>
            <div><span className="text-slate-500">公司：</span><span className="font-medium text-slate-900">{preview.company || "—"}</span></div>
            <div><span className="text-slate-500">地点：</span><span className="text-slate-800">{preview.location || "—"}</span></div>
            <div><span className="text-slate-500">薪资：</span><span className="text-slate-800">{preview.salary || "—"}</span></div>
            <div><span className="text-slate-500">经验：</span><span className="text-slate-800">{preview.experienceYears != null ? `${preview.experienceYears}年` : "—"}</span></div>
            <div><span className="text-slate-500">技能：</span><span className="text-slate-800">{preview.preferredSkills.length} 项</span></div>
          </div>

          {preview.preferredSkills.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {preview.preferredSkills.map((s) => (
                <Badge key={s} color="indigo">{s}</Badge>
              ))}
            </div>
          )}

          {preview.requirements.length > 0 && (
            <ul className="mb-4 space-y-1 text-sm text-slate-600">
              {preview.requirements.slice(0, 5).map((r, i) => (
                <li key={i} className="before:mr-2 before:content-['•']">{r}</li>
              ))}
              {preview.requirements.length > 5 && (
                <li className="text-slate-400">...还有 {preview.requirements.length - 5} 条要求</li>
              )}
            </ul>
          )}

          {showDetails && (
            <div className="space-y-3 border-t border-emerald-200 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="岗位名称" value={preview.title} onChange={(e) => updatePreview({ title: e.target.value })} />
                <Input label="公司名称" value={preview.company} onChange={(e) => updatePreview({ company: e.target.value })} />
                <Input label="工作地点" value={preview.location || ""} onChange={(e) => updatePreview({ location: e.target.value })} />
                <Input label="薪资" value={preview.salary || ""} onChange={(e) => updatePreview({ salary: e.target.value })} />
                <Input label="经验（年）" type="number" value={preview.experienceYears ?? ""} onChange={(e) => updatePreview({ experienceYears: e.target.value ? Number(e.target.value) : undefined })} />
                <Input label="链接" value={preview.url || ""} onChange={(e) => updatePreview({ url: e.target.value })} />
              </div>
              <Select
                label="状态"
                options={statusOptions}
                value={preview.status}
                onChange={(e) => updatePreview({ status: e.target.value as JobStatus })}
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave}>确认添加</Button>
            <Button variant="ghost" onClick={onCancel}>取消</Button>
          </div>
        </div>
      )}

      {!preview && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>取消</Button>
        </div>
      )}
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
        icon={<Sparkles className="h-8 w-8" />}
        title="还没有添加岗位"
        description="粘贴一段 JD 或上传招聘截图，系统会自动识别岗位、公司、薪资和技能要求"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> 智能添加岗位
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <SmartJobInput
          initial={editing || undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Sparkles className="h-4 w-4" /> 智能添加岗位
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
                    {job.experienceYears != null && job.experienceYears > 0 && (
                      <span>{job.experienceYears}年经验</span>
                    )}
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
