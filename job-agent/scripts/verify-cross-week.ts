import mammoth from "mammoth";
import {
  dedupeWeeklyHighlights,
  normalizeProjectName,
} from "../src/lib/project-name";
import { mergeWeeklyReportProjects } from "../src/lib/profile-merge";
import { sanitizeProfileProjects } from "../src/lib/utils";
import { parseWeeklyReportProjects } from "../src/lib/weekly-report-parser";
import type { Project } from "../src/lib/types";

const DOC =
  "/home/ubuntu/.cursor/projects/workspace/uploads/_________2026-07-11__c62c.docx";

async function main() {
  const { value } = await mammoth.extractRawText({ path: DOC });
  const wk24 = value.indexOf("WK24");
  const wk28 = value.indexOf("WK28");
  const multiWeek = value.slice(wk28, value.indexOf("WK23"));
  const projects = parseWeeklyReportProjects(multiWeek, []);

  const xts = projects.find((p) => p.name === "XTS决策链路");
  if (!xts) {
    console.error("FAIL: XTS决策链路 not found");
    process.exit(1);
  }
  if (xts.startDate !== "2026-06-08" || xts.endDate !== "2026-07-10") {
    console.error("FAIL: XTS should span WK24-28", xts.startDate, xts.endDate);
    process.exit(1);
  }
  if (xts.name.includes("已达成") || xts.name.includes("已推进")) {
    console.error("FAIL: XTS name should not contain status", xts.name);
    process.exit(1);
  }
  if ((xts.highlights ?? []).length < 3) {
    console.error("FAIL: XTS should merge highlights from multiple weeks", xts.highlights);
    process.exit(1);
  }
  if (!(xts.highlights ?? []).every((h) => /^WK\d{1,2}\b/.test(h))) {
    console.error("FAIL: XTS highlights should be labeled with WK prefix", xts.highlights);
    process.exit(1);
  }

  const agent = projects.find((p) => p.name === "智能体搭建");
  if (!agent || agent.startDate !== "2026-06-15" || agent.endDate !== "2026-07-10") {
    console.error("FAIL: 智能体搭建 cross-week merge", agent);
    process.exit(1);
  }

  if (projects.some((p) => p.name === "计划" || p.name === "卡点")) {
    console.error(
      "FAIL: 计划/卡点 should not be projects",
      projects.filter((p) => p.name === "计划" || p.name === "卡点")
    );
    process.exit(1);
  }

  if (projects.some((p) => /^P[0-3]/i.test(p.name))) {
    console.error("FAIL: project names should not contain P0/P1 prefix", projects.filter((p) => /^P[0-3]/i.test(p.name)).map((p) => p.name));
    process.exit(1);
  }

  const dupNames = projects
    .map((p) => normalizeProjectName(p.name))
    .filter((name, index, arr) => arr.indexOf(name) !== index);
  if (dupNames.length) {
    console.error("FAIL: duplicate normalized project names", dupNames);
    process.exit(1);
  }

  const wk27start = value.indexOf("WK27");
  const wk26start = value.indexOf("WK26");
  const wk27 = value.slice(wk27start, wk26start);
  const wk27projects = parseWeeklyReportProjects(wk27, []);
  const r2 = wk27projects.find((p) => p.name === "R2新品规划");
  if (
    !r2 ||
    !(r2.highlights ?? []).some((h) => h.includes("PSM&弹性&雷达图均收齐"))
  ) {
    console.error("FAIL: R2 should include plan actual from —— line", r2?.highlights);
    process.exit(1);
  }
  if (!(r2.highlights ?? []).some((h) => h.includes("产出在形式和内容合理性"))) {
    console.error("FAIL: R2 should include blocker content from 卡点 line", r2?.highlights);
    process.exit(1);
  }
  if (wk27projects.some((p) => p.name === "计划" || p.name === "卡点")) {
    console.error("FAIL: 计划/卡点 should not be projects");
    process.exit(1);
  }

  const junkProfile = {
    name: "测试",
    email: "",
    summary: "",
    targetRoles: [],
    targetIndustries: [],
    preferredLocations: [],
    workExperiences: [],
    educations: [],
    skills: [],
    projects: [
      {
        id: "r2",
        name: "R2新品规划",
        description: "",
        technologies: [],
        highlights: [],
        status: "ongoing" as const,
      },
      {
        id: "plan-junk",
        name: "计划",
        description: "WK27",
        technologies: [],
        highlights: [
          "计划：PSM&弹性打磨观点，雷达图周一收齐，思维拓展专项，预计周一二三访问约10位4k+预算用户。——PSM&弹性&雷达图均收齐，思维拓展/AI素养实际访问9位（2位R1+7位T6用户）。",
        ],
        status: "ongoing" as const,
      },
      {
        id: "blocker-junk",
        name: "卡点",
        description: "WK27",
        technologies: [],
        highlights: ["卡点：产出在形式和内容合理性上有一定不足，需多次迭代，造成返工"],
        status: "ongoing" as const,
      },
    ],
  };
  const absorbed = sanitizeProfileProjects(junkProfile.projects, []);
  if (absorbed.some((p) => p.name === "计划" || p.name === "卡点")) {
    console.error("FAIL: absorb should remove 计划/卡点 cards");
    process.exit(1);
  }
  const absorbedR2 = absorbed.find((p) => p.name === "R2新品规划");
  if (
    !absorbedR2 ||
    !(absorbedR2.highlights ?? []).some((h) => h.includes("PSM&弹性&雷达图均收齐")) ||
    !(absorbedR2.highlights ?? []).some((h) => h.includes("产出在形式和内容合理性"))
  ) {
    console.error("FAIL: junk 计划/卡点 should merge into R2", absorbedR2?.highlights);
    process.exit(1);
  }

  const offline = wk27projects.find((p) => p.name.includes("线下WBR"));
  if (!offline || !(offline.highlights ?? []).some((h) => h.includes("已交接"))) {
    console.error("FAIL: 未达成 should use content after status/arrow", offline?.highlights);
    process.exit(1);
  }

  console.log("OK: cross-week merge + 计划/卡点 filter + status parsing verified");

  const existing = [{
    id: "old-xts",
    name: "P0XTS决策链路，已达成",
    description: "WK26（2026-06-22～2026-06-26）",
    technologies: [],
    highlights: [
      "因本周优先S6退货访问，调整为周一二每天新增5个，共10个",
      "本周主要安排实习生参与分析&大模型搭建工作；共访问10个。",
    ],
    startDate: "2026-06-08",
    endDate: "2026-06-26",
    status: "ongoing" as const,
    tags: ["P1"],
  }];
  const remerged = parseWeeklyReportProjects(multiWeek, existing);
  const oldXts = remerged.find((p) => p.name === "XTS决策链路");
  if (!oldXts || !(oldXts.highlights ?? []).every((h) => /^WK\d{1,2}\b/.test(h))) {
    console.error("FAIL: full re-import should label all XTS highlights", oldXts?.highlights);
    process.exit(1);
  }
  if (remerged.some((p) => /^P[0-3]/i.test(p.name))) {
    console.error("FAIL: merged projects should not keep P0 in names");
    process.exit(1);
  }
  if (remerged.some((p) => (p.highlights ?? []).some((h) => /^P[0-3]/i.test(h) && /已达成/.test(h)))) {
    console.error("FAIL: noise highlights should be removed");
    process.exit(1);
  }

  const dupHighlights = [
    "周一投放，周三整理初步数据/视情况替换链接+投放ABtest问卷-回收100份，预期回收约1000份，周五同步进度",
    "暂不投放额外测试",
    "WK27 周一投放，周三整理初步数据/视情况替换链接+投放ABtest问卷-回收100份，预期回收约1000份，周五同步进度",
    "WK28 暂不投放额外测试",
  ];
  const deduped = dedupeWeeklyHighlights(dupHighlights);
  if (deduped.length !== 2) {
    console.error("FAIL: dedupeWeeklyHighlights", deduped);
    process.exit(1);
  }

  const oldProfile = {
    name: "测试",
    email: "",
    summary: "",
    targetRoles: [],
    targetIndustries: [],
    preferredLocations: [],
    workExperiences: [],
    educations: [],
    skills: [],
    projects: [{
      id: "hw-old",
      name: "硬件PSM",
      description: "WK27（2026-06-29～2026-07-03）",
      technologies: [],
      highlights: dupHighlights.slice(0, 2),
      startDate: "2026-06-29",
      endDate: "2026-07-03",
      status: "ongoing" as const,
      tags: ["P1"],
    }],
  };
  const incoming: Project[] = [{
    id: "hw-new",
    name: "硬件PSM",
    description: "WK28（2026-07-06～2026-07-10）",
    technologies: [],
    highlights: dupHighlights.slice(2),
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    status: "ongoing",
    tags: ["P1"],
  }];
  const applied = mergeWeeklyReportProjects(incoming, oldProfile);
  const hw = applied.projects.find((p) => p.name === "硬件PSM");
  if (!hw || (hw.highlights ?? []).length !== 2) {
    console.error("FAIL: apply merge should dedupe old+new highlights", hw?.highlights);
    process.exit(1);
  }
  if ((hw.highlights ?? []).some((h) => !/^WK\d{1,2}\b/.test(h))) {
    console.error("FAIL: merged hardware PSM should only keep WK-prefixed items", hw?.highlights);
    process.exit(1);
  }

  console.log("OK: highlight dedupe on merge verified");
}

main();
