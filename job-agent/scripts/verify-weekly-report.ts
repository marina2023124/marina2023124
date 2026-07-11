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

const weekly = `2024.6.24-6.28 周报
本周工作
2406303 - 雀巢春节：完成 5 组深访，整理访谈纪要
2407101 - 小学语文教材：问卷投放与数据清洗`;

if (!isWeeklyReportText(weekly)) {
  console.error("FAIL: weekly text not detected");
  process.exit(1);
}

const updates = sanitizeProfileProjects(
  parseWeeklyReportProjects(weekly, profile.projects),
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

console.log("OK: weekly report + work link verified");
