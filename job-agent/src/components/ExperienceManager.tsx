"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, X, Check, Loader2, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { WorkExperience, Education, Project, Skill, SkillLevel } from "@/lib/types";
import { generateId, parseSkillsFromText, formatDate, calcYearsBetween, isFutureYearMonth, sanitizeWorkDate, getProjectWorkSummary, getProjectWorkItems, parseWorkLines, formatProjectDateRange, sortProjectsByTime, sanitizeProfileProjects } from "@/lib/utils";
import { canonicalProjectName } from "@/lib/project-match";
import { filterSkillTags, extractSkillTagsFromExperience, isValidSkillTag, sanitizeProfileSkills } from "@/lib/skill-tags";
import { groupProjectsByWorkExperience } from "@/lib/project-work-link";
import dynamic from "next/dynamic";
import { Button, Card, Input, Textarea, Select, Badge } from "./ui";

const SmartExperienceImport = dynamic(
  () => import("@/components/SmartExperienceImport").then((m) => m.SmartExperienceImport),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-6 text-sm text-slate-500">
        加载智能导入模块...
      </div>
    ),
  }
);

const skillLevelOptions = [
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "熟练" },
  { value: "advanced", label: "精通" },
  { value: "expert", label: "专家" },
];

function WorkExperienceSection() {
  const { data, setProfile } = useApp();
  const [editing, setEditing] = useState<WorkExperience | null>(null);
  const [showForm, setShowForm] = useState(false);

  const save = (exp: WorkExperience) => {
    const exists = data.profile.workExperiences.find((e) => e.id === exp.id);
    const updated = exists
      ? data.profile.workExperiences.map((e) => (e.id === exp.id ? exp : e))
      : [exp, ...data.profile.workExperiences];
    setProfile({ ...data.profile, workExperiences: updated });
    setEditing(null);
    setShowForm(false);
  };

  const remove = (id: string) => {
    setProfile({
      ...data.profile,
      workExperiences: data.profile.workExperiences.filter((e) => e.id !== id),
    });
  };

  return (
    <Card title="工作经历">
      <div className="space-y-4">
        {data.profile.workExperiences.map((exp) => {
          const startDate = sanitizeWorkDate(exp.startDate);
          const endDate = exp.endDate ? sanitizeWorkDate(exp.endDate) : undefined;
          const durationYears = calcYearsBetween(startDate, endDate);
          const startLooksWrong = isFutureYearMonth(exp.startDate);
          const skillTags = extractSkillTagsFromExperience(exp);
          const linkedProjects = sortProjectsByTime(
            data.profile.projects.filter((project) => project.workExperienceId === exp.id)
          );

          return (
          <div key={exp.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                <p className="text-sm text-indigo-600">{exp.company}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(startDate)} — {endDate ? formatDate(endDate) : "至今"}
                  {durationYears > 0 && ` · 约 ${durationYears} 年`}
                  {exp.location && ` · ${exp.location}`}
                </p>
                {startLooksWrong && (
                  <p className="mt-1 text-xs text-amber-700">
                    开始日期晚于当前时间，请检查是否为 2024/2025 误写成 2026
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(exp); setShowForm(true); }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => remove(exp.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {exp.description && <p className="mt-2 text-sm text-slate-600">{exp.description}</p>}
            {exp.achievements.length > 0 && (
              <ul className="mt-2 space-y-1">
                {exp.achievements.map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 before:mr-2 before:content-['•']">{a}</li>
                ))}
              </ul>
            )}
            {skillTags.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">相关技能</p>
                <div className="flex flex-wrap gap-1.5">
                  {skillTags.map((s) => <Badge key={s} color="indigo">{s}</Badge>)}
                </div>
              </div>
            )}
            {linkedProjects.length > 0 && (
              <div className="mt-3 rounded-lg bg-violet-50/60 p-3">
                <p className="mb-2 text-xs font-medium text-violet-800">
                  期间项目（{linkedProjects.length}）
                </p>
                <ul className="space-y-1">
                  {linkedProjects.slice(0, 6).map((project) => (
                    <li key={project.id} className="text-sm text-violet-900">
                      {project.name}
                      {formatProjectDateRange(project) && (
                        <span className="ml-2 text-xs text-violet-600">
                          {formatProjectDateRange(project)}
                        </span>
                      )}
                    </li>
                  ))}
                  {linkedProjects.length > 6 && (
                    <li className="text-xs text-violet-600">…另有 {linkedProjects.length - 6} 个项目</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        );
        })}

        {showForm ? (
          <ExperienceForm
            initial={editing || undefined}
            onSave={save}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        ) : (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> 添加工作经历
          </Button>
        )}
      </div>
    </Card>
  );
}

function ExperienceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: WorkExperience;
  onSave: (exp: WorkExperience) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<WorkExperience>(
    initial || {
      id: generateId(),
      company: "",
      title: "",
      startDate: "",
      description: "",
      achievements: [],
      skills: [],
    }
  );
  const [achievementInput, setAchievementInput] = useState("");
  const [skillsInput, setSkillsInput] = useState(form.skills.join(", "));

  const handleSave = () => {
    if (!form.company || !form.title) return;
    onSave({ ...form, skills: filterSkillTags(parseSkillsFromText(skillsInput)) });
  };

  return (
    <div className="space-y-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 p-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="公司名称 *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <Input label="职位名称 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="开始日期" type="month" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <Input label="结束日期（留空=至今）" type="month" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })} />
        <Input label="工作地点" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} className="col-span-2" />
      </div>
      <Textarea label="工作描述" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述你的主要职责..." />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">关键成就（STAR 法则，量化成果）</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={achievementInput}
            onChange={(e) => setAchievementInput(e.target.value)}
            placeholder="如：重构核心模块，页面加载速度提升 60%"
            onKeyDown={(e) => {
              if (e.key === "Enter" && achievementInput.trim()) {
                setForm({ ...form, achievements: [...form.achievements, achievementInput.trim()] });
                setAchievementInput("");
              }
            }}
          />
          <Button size="sm" onClick={() => {
            if (achievementInput.trim()) {
              setForm({ ...form, achievements: [...form.achievements, achievementInput.trim()] });
              setAchievementInput("");
            }
          }}>添加</Button>
        </div>
        {form.achievements.length > 0 && (
          <ul className="mt-2 space-y-1">
            {form.achievements.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <Check className="h-3 w-3 text-emerald-500" /> {a}
                <button onClick={() => setForm({ ...form, achievements: form.achievements.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Input label="使用技能（逗号分隔）" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="React, TypeScript, Node.js" />
      <div className="flex gap-2">
        <Button onClick={handleSave}>保存</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

function SkillsSection() {
  const { data, setProfile } = useApp();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<SkillLevel>("intermediate");

  const addSkill = () => {
    const trimmed = name.trim();
    if (!trimmed || !isValidSkillTag(trimmed)) return;
    const skill: Skill = { id: generateId(), name: trimmed, level };
    setProfile({ ...data.profile, skills: [...data.profile.skills, skill] });
    setName("");
  };

  const removeSkill = (id: string) => {
    setProfile({ ...data.profile, skills: data.profile.skills.filter((s) => s.id !== id) });
  };

  const levelLabel = (l: SkillLevel) => skillLevelOptions.find((o) => o.value === l)?.label || l;

  return (
    <Card title="技能清单">
      <div className="mb-4 flex flex-wrap gap-2">
        {sanitizeProfileSkills(data.profile.skills).map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
            {s.name}
            <span className="text-xs text-indigo-400">({levelLabel(s.level)})</span>
            <button onClick={() => removeSkill(s.id)} className="ml-1 text-indigo-400 hover:text-red-500"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="技能名称" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Select options={skillLevelOptions} value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)} className="w-28" />
        <Button onClick={addSkill}><Plus className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}

function ProjectCard({
  project,
  onRemove,
  nested = false,
}: {
  project: Project;
  onRemove: (id: string) => void;
  nested?: boolean;
}) {
  const normalized = {
    ...project,
    description: project.description ?? "",
    highlights: project.highlights ?? [],
    technologies: project.technologies ?? [],
  };
  const workSummary = getProjectWorkSummary(normalized);
  const workItems = getProjectWorkItems(normalized);

  return (
    <div
      className={
        nested
          ? "rounded-lg border border-slate-200 bg-white p-4"
          : "mb-3 rounded-lg border border-slate-200 p-4"
      }
    >
      <div className="flex justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-slate-900">{canonicalProjectName(project.name)}</h4>
          {(project.tags ?? []).map((tag) => (
            <Badge key={tag} color="amber">{tag}</Badge>
          ))}
        </div>
        <button
          onClick={() => onRemove(project.id)}
          className="text-slate-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {project.description && <p className="mt-1 text-sm text-slate-500">{project.description}</p>}
      {formatProjectDateRange(project) && (
        <p className="mt-1 text-sm text-indigo-700">{formatProjectDateRange(project)}</p>
      )}
      {(workSummary || workItems.length > 0) && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">具体工作</p>
          {workSummary && (
            <p className="text-sm leading-relaxed text-slate-800">{workSummary}</p>
          )}
          {workItems.length > 0 && (
            <div>
              <p className="text-xs text-slate-400">任务明细</p>
              <ul className="mt-1 space-y-1">
                {workItems.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slate-700">
                    <span className="shrink-0 text-slate-400">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {(normalized.technologies ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {normalized.technologies.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
      )}
    </div>
  );
}

function ProjectsSection() {
  const { data, setProfile } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [workInput, setWorkInput] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  const summarizeAllProjects = async () => {
    if (!data.profile.projects.length) return;
    setSummarizing(true);
    setSummarizeError(null);
    try {
      const statusRes = await fetch("/api/llm/status");
      const statusBody = (await statusRes.json()) as { configured?: boolean; liveValid?: boolean; hint?: string };
      if (!statusBody.configured || statusBody.liveValid === false) {
        throw new Error(statusBody.hint ?? "未配置 DeepSeek");
      }

      const res = await fetch("/api/llm/summarize-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: data.profile.projects }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summaries?: Record<string, string>;
      };
      if (!res.ok || !body.ok || !body.summaries) {
        throw new Error(body.error ?? "AI 总结失败");
      }

      setProfile({
        ...data.profile,
        projects: data.profile.projects.map((project) =>
          body.summaries![project.id]
            ? { ...project, workSummary: body.summaries![project.id] }
            : project
        ),
      });
    } catch (err) {
      setSummarizeError(err instanceof Error ? err.message : "AI 总结失败");
    } finally {
      setSummarizing(false);
    }
  };

  const removeProject = (id: string) => {
    setProfile({
      ...data.profile,
      projects: data.profile.projects.filter((project) => project.id !== id),
    });
  };

  const projectGroups = groupProjectsByWorkExperience(
    data.profile.projects,
    data.profile.workExperiences
  );

  const addProject = () => {
    if (!form.name) return;
    const highlights = parseWorkLines(workInput);
    const project: Project = {
      id: generateId(),
      name: form.name,
      description: form.description || "",
      technologies: parseSkillsFromText(form.technologies?.join(", ") || ""),
      highlights,
      workSummary: getProjectWorkSummary({
        name: form.name,
        description: form.description || "",
        highlights,
      }),
      url: form.url,
      startDate: form.startDate,
      endDate: form.endDate,
      workExperienceId: form.workExperienceId,
    };
    const projects = sanitizeProfileProjects(
      [project, ...data.profile.projects],
      data.profile.workExperiences
    );
    setProfile({
      ...data.profile,
      projects,
    });
    setForm({});
    setWorkInput("");
    setShowForm(false);
  };

  return (
    <Card title="项目经验">
      {data.profile.projects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={summarizing} onClick={summarizeAllProjects}>
            {summarizing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 总结中…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> AI 智能总结全部项目
              </>
            )}
          </Button>
          {summarizeError && <p className="text-xs text-red-600">{summarizeError}</p>}
        </div>
      )}
      {projectGroups.length === 0 && !showForm && (
        <p className="mb-4 text-sm text-slate-500">暂无项目，可手动添加或从周报导入。</p>
      )}
      <div className="space-y-5">
        {projectGroups.map((group) => (
          <div key={group.workExperienceId ?? group.label} className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
            <div className="mb-3 border-b border-violet-100 pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-600">所属工作</p>
              <h3 className="mt-1 text-base font-semibold text-violet-950">{group.label}</h3>
              {group.workExperience && (
                <p className="mt-1 text-xs text-violet-700">
                  {formatDate(sanitizeWorkDate(group.workExperience.startDate))}
                  {" — "}
                  {group.workExperience.endDate
                    ? formatDate(sanitizeWorkDate(group.workExperience.endDate))
                    : "至今"}
                  {" · "}
                  {group.projects.length} 个项目
                </p>
              )}
              {!group.workExperience && (
                <p className="mt-1 text-xs text-violet-700">{group.projects.length} 个项目</p>
              )}
            </div>
            <div className="space-y-3">
              {group.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRemove={removeProject}
                  nested
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {showForm ? (
        <div className="space-y-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 p-4">
          <Input label="项目名称" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="项目信息（行业、品类、方法等）" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="教育 · 小学语文 · 定性+共创 · 2406303" />
          <Textarea
            label="具体工作（每行一条）"
            value={workInput}
            onChange={(e) => setWorkInput(e.target.value)}
            rows={4}
            placeholder={"深访家长需求\n撰写研究报告\n协助焦点小组"}
          />
          <Input label="研究方法/技能（逗号分隔）" onChange={(e) => setForm({ ...form, technologies: parseSkillsFromText(e.target.value) as unknown as string[] })} />
          {data.profile.workExperiences.length > 0 && (
            <Select
              label="所属工作（可选，留空则按时间自动匹配）"
              value={form.workExperienceId || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  workExperienceId: e.target.value || undefined,
                })
              }
              options={[
                { value: "", label: "自动匹配" },
                ...data.profile.workExperiences.map((exp) => ({
                  value: exp.id,
                  label: `${exp.company} · ${exp.title}`,
                })),
              ]}
            />
          )}
          <div className="flex gap-2">
            <Button onClick={addProject}>保存</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setWorkInput(""); }}>取消</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> 添加项目</Button>
      )}
    </Card>
  );
}

function EducationSection() {
  const { data, setProfile } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Education>>({});

  const add = () => {
    if (!form.school || !form.degree) return;
    const edu: Education = {
      id: generateId(),
      school: form.school,
      degree: form.degree,
      field: form.field || "",
      startDate: form.startDate || "",
      endDate: form.endDate,
    };
    setProfile({ ...data.profile, educations: [edu, ...data.profile.educations] });
    setForm({});
    setShowForm(false);
  };

  return (
    <Card title="教育背景">
      {data.profile.educations.map((e) => (
        <div key={e.id} className="mb-3 flex justify-between rounded-lg border border-slate-200 p-4">
          <div>
            <h4 className="font-semibold text-slate-900">{e.school}</h4>
            <p className="text-sm text-slate-600">{e.degree} · {e.field}</p>
            <p className="text-xs text-slate-500">{formatDate(e.startDate)} — {e.endDate ? formatDate(e.endDate) : "至今"}</p>
          </div>
          <button onClick={() => setProfile({ ...data.profile, educations: data.profile.educations.filter((x) => x.id !== e.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {showForm ? (
        <div className="space-y-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="学校" value={form.school || ""} onChange={(e) => setForm({ ...form, school: e.target.value })} />
            <Input label="学位" value={form.degree || ""} onChange={(e) => setForm({ ...form, degree: e.target.value })} />
            <Input label="专业" value={form.field || ""} onChange={(e) => setForm({ ...form, field: e.target.value })} />
            <Input label="开始日期" type="month" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={add}>保存</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> 添加教育经历</Button>
      )}
    </Card>
  );
}

export function ProfileForm() {
  const { data, updateProfile } = useApp();

  return (
    <Card title="基本信息">
      <div className="grid grid-cols-2 gap-4">
        <Input label="姓名" value={data.profile.name} onChange={(e) => updateProfile({ name: e.target.value })} />
        <Input label="邮箱" type="email" value={data.profile.email} onChange={(e) => updateProfile({ email: e.target.value })} />
        <Input label="电话" value={data.profile.phone || ""} onChange={(e) => updateProfile({ phone: e.target.value })} />
        <Input label="目标岗位（逗号分隔）" value={data.profile.targetRoles.join(", ")} onChange={(e) => updateProfile({ targetRoles: parseSkillsFromText(e.target.value) })} />
        <Input label="目标行业（逗号分隔）" value={data.profile.targetIndustries.join(", ")} onChange={(e) => updateProfile({ targetIndustries: parseSkillsFromText(e.target.value) })} />
        <Input label="期望城市（逗号分隔）" value={data.profile.preferredLocations.join(", ")} onChange={(e) => updateProfile({ preferredLocations: parseSkillsFromText(e.target.value) })} />
      </div>
      <div className="mt-4">
        <Textarea label="职业摘要" rows={3} value={data.profile.summary} onChange={(e) => updateProfile({ summary: e.target.value })} placeholder="一句话概括你的职业定位和核心优势..." />
      </div>
    </Card>
  );
}

export function ExperienceManager() {
  return (
    <div className="space-y-6">
      <SmartExperienceImport />
      <ProfileForm />
      <WorkExperienceSection />
      <SkillsSection />
      <ProjectsSection />
      <EducationSection />
    </div>
  );
}
