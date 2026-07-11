"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { WorkExperience, Education, Project, Skill, SkillLevel } from "@/lib/types";
import { generateId, parseSkillsFromText, formatDate, calcYearsBetween, isFutureYearMonth, sanitizeWorkDate, getProjectWorkItems, parseWorkLines } from "@/lib/utils";
import { filterSkillTags, extractSkillTagsFromExperience, isValidSkillTag, sanitizeProfileSkills } from "@/lib/skill-tags";
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

function ProjectsSection() {
  const { data, setProfile } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [workInput, setWorkInput] = useState("");

  const addProject = () => {
    if (!form.name) return;
    const project: Project = {
      id: generateId(),
      name: form.name,
      description: form.description || "",
      technologies: parseSkillsFromText(form.technologies?.join(", ") || ""),
      highlights: parseWorkLines(workInput),
      url: form.url,
    };
    setProfile({ ...data.profile, projects: [project, ...data.profile.projects] });
    setForm({});
    setWorkInput("");
    setShowForm(false);
  };

  return (
    <Card title="项目经验">
      {data.profile.projects.map((p) => {
        const workItems = getProjectWorkItems(p);
        return (
          <div key={p.id} className="mb-3 rounded-lg border border-slate-200 p-4">
            <div className="flex justify-between">
              <h4 className="font-semibold text-slate-900">{p.name}</h4>
              <button onClick={() => setProfile({ ...data.profile, projects: data.profile.projects.filter((x) => x.id !== p.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
            {workItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500">具体工作</p>
                <ul className="mt-1.5 space-y-1">
                  {workItems.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-700">
                      <span className="shrink-0 text-slate-400">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {p.technologies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.technologies.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            )}
          </div>
        );
      })}
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
