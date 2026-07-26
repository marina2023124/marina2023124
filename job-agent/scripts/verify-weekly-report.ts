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
