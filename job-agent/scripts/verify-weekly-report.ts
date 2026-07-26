import { parseWeeklyReportProjects, isWeeklyReportText } from "../src/lib/weekly-report-parser";
import { sanitizeProfileProjects } from "../src/lib/utils";
import type { Profile } from "../src/lib/types";

const profile: Profile = {
  name: "测试",
  email: "",
  summary: "",
  targetRoles: [],
  targetIndustries: [],
  preferredLocations: [],
  workExperiences: [
    {
      id: "work-1",
      company: "数说故事",
      title: "商业分析师",
      startDate: "2023-04",
      endDate: "2025-06",
      description: "",
      achievements: [],
      skills: [],
    },
    {
      id: "work-2",
      company: "某咨询公司",
      title: "研究顾问",
      startDate: "2021-07",
      endDate: "2023-03",
      description: "",
      achievements: [],
      skills: [],
    },
  ],
  educations: [],
  projects: [
    {
      id: "p1",
      name: "雀巢春节",
      projectId: "2406303",
      description: "食品",
      technologies: ["深度访谈"],
      highlights: ["完成 3 组深访"],
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      status: "ongoing",
    },
  ],
  skills: [],
};

const weeklyWithId = `2024.6.24-6.28 周报
本周工作
2406303 - 雀巢春节：完成 5 组深访，整理访谈纪要
2407101 - 小学语文教材：问卷投放与数据清洗`;

if (!isWeeklyReportText(weeklyWithId)) {
  console.error("FAIL: weekly text not detected");
  process.exit(1);
}

const updates = sanitizeProfileProjects(
  parseWeeklyReportProjects(weeklyWithId, profile.projects),
  profile.workExperiences
);

if (updates.length < 2) {
  console.error("FAIL: expected >=2 project updates", updates.length);
  process.exit(1);
}

const nestle = updates.find((p) => p.projectId === "2406303");
if (!nestle || !(nestle.highlights ?? []).some((h) => h.includes("5 组深访"))) {
  console.error("FAIL: nestle project not merged");
  process.exit(1);
}

if (nestle.workExperienceId !== "work-1") {
  console.error("FAIL: nestle should link to work-1, got", nestle.workExperienceId);
  process.exit(1);
}

const weeklySection = `LLM支持的业务需求&分类。

a)用研

本周项目
雀巢春节：完成 8 组深访，输出中期发现
小学语文教材：完成问卷清洗与初步分析`;

if (!isWeeklyReportText(weeklySection)) {
  console.error("FAIL: weekly section text not detected");
  process.exit(1);
}

const sectionUpdates = parseWeeklyReportProjects(weeklySection, profile.projects);
if (sectionUpdates.length < 2) {
  console.error("FAIL: expected >=2 projects from 本周项目 section", sectionUpdates.length);
  process.exit(1);
}

const nestleByName = sectionUpdates.find((p) => p.name.includes("雀巢"));
if (!nestleByName || !(nestleByName.highlights ?? []).some((h) => h.includes("8 组深访"))) {
  console.error("FAIL: nestle by name not parsed from 本周项目");
  process.exit(1);
}

console.log("OK: weekly report + 本周项目 section verified");

const wkOnly = `WK30

P-1 小猿AI学练机
P0 产品战略分析。已达成。访问28人，问卷200份
P0 小猿AI学练机。已达成。完成深访12组`;

const wkProjects = parseWeeklyReportProjects(wkOnly, profile.projects);
if (wkProjects.length < 2) {
  console.error("FAIL: WK30-only weekly should parse >=2 projects", wkProjects.length);
  process.exit(1);
}
if (!wkProjects.some((p) => p.name.includes("产品战略"))) {
  console.error("FAIL: WK30 should include 产品战略分析");
  process.exit(1);
}

console.log("OK: WK30 P0/P-1 direct paste verified");

const numberedFullwidth = `WK30
本周目标。
1） P-1 小猿AI学练计划。已达成。访问28人
2） P0 产品战略分析。已达成。问卷200份
3） P0 线下WBR`;

const fwProjects = parseWeeklyReportProjects(numberedFullwidth, profile.projects);
if (fwProjects.length < 3) {
  console.error("FAIL: fullwidth numbered parens should parse >=3 projects", fwProjects.length);
  process.exit(1);
}

console.log("OK: fullwidth numbered list verified");

const statusTags = `WK29
P0【新增高优】产品战略分析。已达成。问卷200份
P1【被动调整】评论智能体搭建。已达成。雷达图问卷迭代
内容：课程内容&呈现分析。已达成`;

const statusProjects = parseWeeklyReportProjects(statusTags, profile.projects);
const strategic = statusProjects.find((p) => p.name === "产品战略分析");
const agent = statusProjects.find((p) => p.name.includes("智能体"));
const contentStandalone = statusProjects.find((p) => p.name === "内容");

if (!strategic) {
  console.error("FAIL: 产品战略分析 should exist", statusProjects.map((p) => p.name));
  process.exit(1);
}
if (!(strategic.highlights ?? []).some((h) => /问卷|200/.test(h))) {
  console.error("FAIL: 产品战略分析应含问卷任务", strategic.highlights);
  process.exit(1);
}
if (!(strategic.highlights ?? []).some((h) => /课程内容|呈现分析|内容/.test(h))) {
  console.error("FAIL: 内容分支应合并进产品战略分析", strategic.highlights);
  process.exit(1);
}
if (contentStandalone) {
  console.error("FAIL: 内容不应作为独立项目");
  process.exit(1);
}
if (agent?.name.includes("被动调整") || agent?.name.includes("新增高优")) {
  console.error("FAIL: 项目名不应含状态标签", agent?.name);
  process.exit(1);
}
if (strategic.name.includes("新增高优")) {
  console.error("FAIL: 产品战略分析名不应含状态标签");
  process.exit(1);
}

console.log("OK: status tags stripped and 内容 merged into 产品战略分析");

const branchMerge = `WK29
P0 产品战略分析。已达成。战略问卷
软件：搜索精度分析、AI老师人设问卷
P1【被动调整】评论智能体搭建。已达成。雷达图迭代
P1 智能体搭建。已达成。电商评论agent搭建`;

const branchProjects = parseWeeklyReportProjects(branchMerge, [
  ...profile.projects,
  {
    id: "agent-existing",
    name: "智能体搭建",
    description: "",
    technologies: [],
    highlights: ["WK28 Codex搭建"],
    startDate: "2026-07-01",
    status: "ongoing" as const,
  },
]);
const strategic2 = branchProjects.find((p) => p.name === "产品战略分析");
const agentMerged = branchProjects.filter((p) => p.name === "智能体搭建");
const softwareStandalone = branchProjects.find((p) => p.name === "软件");

if (!strategic2 || !(strategic2.highlights ?? []).some((h) => /软件|搜索精度|AI老师/.test(h))) {
  console.error("FAIL: 软件应合并进产品战略分析", strategic2?.highlights);
  process.exit(1);
}
if (softwareStandalone) {
  console.error("FAIL: 软件不应作为独立项目");
  process.exit(1);
}
if (agentMerged.length !== 1) {
  console.error("FAIL: 评论智能体搭建与智能体搭建应合并为 1 个项目", branchProjects.map((p) => p.name));
  process.exit(1);
}
if (!(agentMerged[0]?.highlights ?? []).some((h) => /评论|雷达图|agent|电商/.test(h))) {
  console.error("FAIL: 合并后的智能体搭建应保留双方任务", agentMerged[0]?.highlights);
  process.exit(1);
}

console.log("OK: 软件归并产品战略分析，智能体项目合并");
