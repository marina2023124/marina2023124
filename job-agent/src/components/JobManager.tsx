"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Sparkles,
  ImagePlus,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowDownAZ,
  ArrowUpAZ,
  SlidersHorizontal,
  Link2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { JobPosting, JobStatus } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { parseJobDescription } from "@/lib/jd-parser";
import { jobToEditableText, mergeParsedJob } from "@/lib/job-merge";
import { extractTextFromImage, isImageFile } from "@/lib/ocr";
import { BossImportGuide, BOSS_DEMO_TEXT } from "@/components/BossImportGuide";
import { JobSourceBadge } from "@/components/JobSourceBadge";
import { CommuteInfo } from "@/components/CommuteInfo";
import { JobCard } from "@/components/JobCard";
import { JobDetailSections } from "@/components/JobDetailSections";
import { JobInterestRating } from "@/components/JobInterestRating";
import { assembleJobDescription } from "@/lib/job-sections";
import {
  applyJobListPrefs,
  getJobIndustryOptions,
  loadJobListPrefs,
  saveJobListPrefs,
  type JobListPrefs,
  type JobSortField,
} from "@/lib/job-list";
import { importedDraftToText, type ImportedJobDraft } from "@/lib/job-importers";
import { JOB_SOURCE_LABELS, resolveJobSource, type JobSource } from "@/lib/job-source";
import { Button, Card, Input, Textarea, Select, Badge, EmptyState } from "./ui";

const sortFieldOptions: { value: JobSortField; label: string }[] = [
  { value: "createdAt", label: "添加时间" },
  { value: "salary", label: "薪资" },
  { value: "industry", label: "行业" },
  { value: "title", label: "职位" },
  { value: "experienceYears", label: "工作年限" },
  { value: "interestRating", label: "意愿度" },
];

const interestFilterOptions = [
  { value: "0", label: "全部意愿度" },
  { value: "1", label: "1 星及以上" },
  { value: "2", label: "2 星及以上" },
  { value: "3", label: "3 星及以上" },
  { value: "4", label: "4 星及以上" },
  { value: "5", label: "5 星" },
];

function JobListToolbar({
  prefs,
  totalCount,
  visibleCount,
  industryOptions,
  onChange,
}: {
  prefs: JobListPrefs;
  totalCount: number;
  visibleCount: number;
  industryOptions: string[];
  onChange: (prefs: JobListPrefs) => void;
}) {
  const updateFilters = (patch: Partial<JobListPrefs["filters"]>) => {
    onChange({ ...prefs, filters: { ...prefs.filters, ...patch } });
  };

  const toggleSortOrder = () => {
    onChange({ ...prefs, sortOrder: prefs.sortOrder === "asc" ? "desc" : "asc" });
  };

  return (
    <Card className="border-indigo-100 bg-gradient-to-r from-slate-50 to-indigo-50/40">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
            <span>
              显示 <strong className="text-slate-900">{visibleCount}</strong> / {totalCount} 个岗位
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="min-w-[140px]"
              options={sortFieldOptions.map((opt) => ({ value: opt.value, label: `排序：${opt.label}` }))}
              value={prefs.sortField}
              onChange={(e) => onChange({ ...prefs, sortField: e.target.value as JobSortField })}
            />
            <Button variant="secondary" size="sm" onClick={toggleSortOrder} title={prefs.sortOrder === "asc" ? "升序" : "降序"}>
              {prefs.sortOrder === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              {prefs.sortOrder === "asc" ? "升序" : "降序"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            placeholder="搜索职位、公司、地点…"
            value={prefs.filters.query ?? ""}
            onChange={(e) => updateFilters({ query: e.target.value })}
          />
          <Select
            options={[
              { value: "", label: "全部行业" },
              ...industryOptions.map((industry) => ({ value: industry, label: industry })),
            ]}
            value={prefs.filters.industry ?? ""}
            onChange={(e) => updateFilters({ industry: e.target.value || undefined })}
          />
          <Select
            options={[{ value: "", label: "全部状态" }, ...statusOptions]}
            value={prefs.filters.status ?? ""}
            onChange={(e) => updateFilters({ status: (e.target.value || undefined) as JobStatus | undefined })}
          />
          <Select
            options={interestFilterOptions}
            value={String(prefs.filters.minInterest ?? 0)}
            onChange={(e) => updateFilters({ minInterest: Number(e.target.value) || undefined })}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              placeholder="最低年限"
              value={prefs.filters.minExperience ?? ""}
              onChange={(e) =>
                updateFilters({
                  minExperience: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <Input
              type="number"
              min={0}
              placeholder="最高年限"
              value={prefs.filters.maxExperience ?? ""}
              onChange={(e) =>
                updateFilters({
                  maxExperience: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

const statusOptions: { value: JobStatus; label: string }[] = [
  { value: "saved", label: "已收藏" },
  { value: "applied", label: "已投递" },
  { value: "interview", label: "面试中" },
  { value: "rejected", label: "已拒绝" },
  { value: "offer", label: "已获 Offer" },
];

function SmartJobInput({
  initial,
  onSave,
  onCancel,
}: {
  initial?: JobPosting;
  onSave: (job: JobPosting) => void;
  onCancel: () => void;
}) {
  const [rawInput, setRawInput] = useState(() =>
    initial ? jobToEditableText(initial) : ""
  );
  const [preview, setPreview] = useState<JobPosting | null>(initial || null);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(!!initial);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const sourceOptions = (Object.entries(JOB_SOURCE_LABELS) as [JobSource, string][]).map(
    ([value, label]) => ({ value, label })
  );

  const runParse = useCallback((text: string) => {
    const parsed = parseJobDescription(text);
    setPreview((prev) => {
      const merged = mergeParsedJob(parsed, prev, initial);
      return {
        ...(prev || initial || {}),
        ...merged,
        id: prev?.id || initial?.id || generateId(),
        title: merged.title || prev?.title || initial?.title || "",
        company: merged.company || prev?.company || initial?.company || "",
        status: prev?.status || initial?.status || "saved",
        createdAt: prev?.createdAt || initial?.createdAt || new Date().toISOString(),
        industry: prev?.industry ?? initial?.industry,
        source: merged.source ?? prev?.source ?? initial?.source,
        interestRating: prev?.interestRating ?? initial?.interestRating,
        preferredSkills: merged.preferredSkills || prev?.preferredSkills || initial?.preferredSkills || [],
        requirements: merged.requirements || [],
        responsibilities: merged.responsibilities || [],
        jobIntro: merged.jobIntro,
      } as JobPosting;
    });
  }, [initial]);

  const handleUrlImport = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setParsing(true);
    try {
      const res = await fetch("/api/jobs/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { draft?: ImportedJobDraft; error?: string };
      if (!res.ok || !body.draft) {
        throw new Error(body.error || "链接导入失败");
      }
      const draft = body.draft;
      const text = importedDraftToText(draft);
      setRawInput(text);
      setPreview({
        id: initial?.id || generateId(),
        title: draft.title || "",
        company: draft.company || "",
        location: draft.location,
        workAddress: draft.workAddress,
        salary: draft.salary,
        experienceYears: draft.experienceYears,
        industry: draft.industry,
        source: draft.source,
        url: draft.url,
        jobIntro: draft.jobIntro,
        responsibilities: draft.responsibilities ?? [],
        requirements: draft.requirements ?? [],
        description: draft.description || "",
        preferredSkills: draft.preferredSkills ?? [],
        status: initial?.status || "saved",
        createdAt: initial?.createdAt || new Date().toISOString(),
        interestRating: initial?.interestRating,
      });
      setShowDetails(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "链接导入失败");
    } finally {
      setParsing(false);
    }
  };

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
      title: preview.title || "未知岗位",
      jobIntro: preview.jobIntro?.trim() || undefined,
      responsibilities: preview.responsibilities ?? [],
      requirements: preview.requirements ?? [],
      source: preview.source || resolveJobSource({ url: preview.url }),
      description: assembleJobDescription(preview) || rawInput.trim(),
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
            {initial ? `编辑岗位：${initial.title}` : "智能添加岗位"}
          </h3>
          <p className="text-sm text-slate-500">
            {initial
              ? `${initial.company} · 可直接修改下方字段后保存`
              : "粘贴 JD 文字或上传截图，自动识别关键信息"}
          </p>
        </div>
      </div>

      <BossImportGuide
        onPasteDemo={() => {
          setRawInput(BOSS_DEMO_TEXT);
        }}
      />

      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-semibold text-slate-900">从链接导入（企业官网 / 小红书招聘等）</p>
        </div>
        <p className="mb-3 text-xs text-slate-600">
          粘贴岗位详情页链接，系统自动识别渠道并抓取 JD。已支持小红书招聘；BOSS 请继续用书签导入。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="https://job.xiaohongshu.com/social/position/18746"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />
          <Button onClick={handleUrlImport} disabled={!importUrl.trim() || parsing} className="shrink-0">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            从链接导入
          </Button>
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-emerald-900">识别结果</h4>
              {preview.source && <JobSourceBadge source={preview.source} url={preview.url} />}
            </div>
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
            <div className="col-span-2"><span className="text-slate-500">工作地址：</span><span className="text-slate-800">{preview.workAddress || "—"}</span></div>
            <div><span className="text-slate-500">薪资：</span><span className="text-slate-800">{preview.salary || "—"}</span></div>
            <div><span className="text-slate-500">经验：</span><span className="text-slate-800">{preview.experienceYears != null ? `${preview.experienceYears}年` : "—"}</span></div>
            <div><span className="text-slate-500">行业：</span><span className="text-slate-800">{preview.industry || "—"}</span></div>
            <div><span className="text-slate-500">技能：</span><span className="text-slate-800">{preview.preferredSkills.length} 项</span></div>
          </div>

          <CommuteInfo workAddress={preview.workAddress} />

          <div className="mb-4 rounded-xl border border-indigo-100 bg-white/70 p-4">
            <JobDetailSections job={preview} />
          </div>

          {preview.preferredSkills.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {preview.preferredSkills.map((s) => (
                <Badge key={s} color="indigo">{s}</Badge>
              ))}
            </div>
          )}

          {showDetails && (
            <div className="space-y-3 border-t border-emerald-200 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="岗位名称" value={preview.title} onChange={(e) => updatePreview({ title: e.target.value })} />
                <Input label="公司名称" value={preview.company} onChange={(e) => updatePreview({ company: e.target.value })} />
                <Input label="城市/区域" value={preview.location || ""} onChange={(e) => updatePreview({ location: e.target.value })} />
                <Input label="工作地址" value={preview.workAddress || ""} onChange={(e) => updatePreview({ workAddress: e.target.value })} className="col-span-2" />
                <Input label="薪资" value={preview.salary || ""} onChange={(e) => updatePreview({ salary: e.target.value })} />
                <Input label="经验（年）" type="number" value={preview.experienceYears ?? ""} onChange={(e) => updatePreview({ experienceYears: e.target.value ? Number(e.target.value) : undefined })} />
                <Input label="行业" value={preview.industry || ""} onChange={(e) => updatePreview({ industry: e.target.value })} />
                <Select
                  label="信息来源"
                  options={sourceOptions}
                  value={preview.source || "manual"}
                  onChange={(e) => updatePreview({ source: e.target.value as JobSource })}
                />
                <Input label="链接" value={preview.url || ""} onChange={(e) => updatePreview({ url: e.target.value })} className="sm:col-span-2" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">个人意愿度</label>
                <JobInterestRating
                  value={preview.interestRating ?? 0}
                  onChange={(rating) => updatePreview({ interestRating: rating || undefined })}
                />
              </div>
              <Textarea
                label="职位描述（工时、福利等）"
                rows={4}
                value={preview.jobIntro || ""}
                onChange={(e) => updatePreview({ jobIntro: e.target.value })}
              />
              <Textarea
                label="岗位职责（每行一条）"
                rows={5}
                value={(preview.responsibilities || []).join("\n")}
                onChange={(e) =>
                  updatePreview({
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
                value={(preview.requirements || []).join("\n")}
                onChange={(e) =>
                  updatePreview({
                    requirements: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Select
                label="状态"
                options={statusOptions}
                value={preview.status}
                onChange={(e) => updatePreview({ status: e.target.value as JobStatus })}
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave}>{initial ? "保存修改" : "确认添加"}</Button>
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [listPrefs, setListPrefs] = useState<JobListPrefs>(() => loadJobListPrefs());
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveJobListPrefs(listPrefs);
  }, [listPrefs]);

  useEffect(() => {
    if (!showAddForm) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showAddForm]);

  const industryOptions = useMemo(() => getJobIndustryOptions(data.jobs), [data.jobs]);
  const visibleJobs = useMemo(
    () => applyJobListPrefs(data.jobs, listPrefs),
    [data.jobs, listPrefs]
  );

  const handleAddSave = (job: JobPosting) => {
    addJob(job);
    setShowAddForm(false);
  };

  if (data.jobs.length === 0 && !showAddForm) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="还没有添加岗位"
        description="粘贴一段 JD 或上传招聘截图，系统会自动识别岗位、公司、薪资和技能要求"
        action={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" /> 智能添加岗位
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {showAddForm ? (
        <div ref={formRef} className="scroll-mt-6">
          <SmartJobInput
            onSave={handleAddSave}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddForm(true)}>
            <Sparkles className="h-4 w-4" /> 智能添加岗位
          </Button>
        </div>
      )}

      {!showAddForm && data.jobs.length > 0 && (
        <JobListToolbar
          prefs={listPrefs}
          totalCount={data.jobs.length}
          visibleCount={visibleJobs.length}
          industryOptions={industryOptions}
          onChange={setListPrefs}
        />
      )}

      <div className="grid gap-4">
        {!showAddForm && data.jobs.length > 0 && visibleJobs.length === 0 && (
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8" />}
            title="没有符合筛选条件的岗位"
            description="试试放宽行业、意愿度或年限筛选，或清空搜索关键词"
          />
        )}
        {visibleJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isEditing={editingJobId === job.id}
            onEdit={() => setEditingJobId(job.id)}
            onCancelEdit={() => setEditingJobId(null)}
            onSave={(updated) => {
              updateJob(updated);
              setEditingJobId(null);
            }}
            onDelete={() => deleteJob(job.id)}
            onRate={(rating) => updateJob({ ...job, interestRating: rating || undefined })}
          />
        ))}
      </div>
    </div>
  );
}
