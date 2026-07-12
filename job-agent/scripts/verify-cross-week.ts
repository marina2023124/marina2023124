import mammoth from "mammoth";
import {
  dedupeWeeklyHighlights,
  finalizeWeeklyHighlights,
  normalizeProjectName,
} from "../src/lib/project-name";
import { summarizeProjectWork, summaryLooksLikeRawDetail } from "../src/lib/project-work-summary";
import { mergeWeeklyReportProjects } from "../src/lib/profile-merge";
import { sanitizeProfileProjects } from "../src/lib/utils";
import { parseWeeklyReportProjects } from "../src/lib/weekly-report-parser";
import type { Project } from "../src/lib/types";

const DOC =
  "/home/ubuntu/.cursor/projects/workspace/uploads/_________2026-07-11__c62c.docx";

const AI_FIXTURE = `
周报（2026-06-26）
WK26
本周项目
P0AI功能需求。已更新雷达图问卷。
下周目标
P3项目

WK25
本周项目
P0AI功能需求。总结表更新后已投放问卷&更新结果。报告待打磨
下周目标
P0AI功能需求。报告打磨。

WK24
本周项目
P1AI功能需求，未达成。质量未达预期，原计划完成报告更新&汇报&问卷，实际已更新一版但未达汇报水准
下周目标
`;

function assertNoGenericSummary(name: string, summary?: string) {
  if (!summary || /负责\d+项用户研究任务/.test(summary)) {
    console.error(`FAIL: ${name} should have concrete workSummary`, summary);
    process.exit(1);
  }
}

function assertNoStatusInSummary(name: string, summary?: string) {
  if (
    !summary ||
    /未调研|已交接|暂不投放|实际达成|待调研/.test(summary)
  ) {
    console.error(`FAIL: ${name} summary should not contain status phrases`, summary);
    process.exit(1);
  }
}

function assertAbstractSummary(name: string, summary?: string) {
  assertNoGenericSummary(name, summary);
  assertNoStatusInSummary(name, summary);
  if (summaryLooksLikeRawDetail(summary ?? "")) {
    console.error(`FAIL: ${name} summary should abstract details, not copy them`, summary);
    process.exit(1);
  }
}

async function main() {
  const aiProjects = parseWeeklyReportProjects(AI_FIXTURE, []);
  const ai = aiProjects.find((p) => p.name === "AI功能需求");
  if (!ai) {
    console.error("FAIL: AI功能需求 not found in fixture");
    process.exit(1);
  }
  if ((ai.highlights ?? []).length < 4) {
    console.error("FAIL: AI功能需求 should have WK24-26 highlights + report polish", ai.highlights);
    process.exit(1);
  }
  if (!(ai.highlights ?? []).every((h) => /^WK\d{1,2}\b/.test(h))) {
    console.error("FAIL: AI highlights should all have WK prefix", ai.highlights);
    process.exit(1);
  }
  if (!(ai.highlights ?? []).some((h) => /报告打磨|报告待打磨/.test(h))) {
    console.error("FAIL: AI should include report polishing from next-goal carryover", ai.highlights);
    process.exit(1);
  }
  if (ai.startDate !== "2026-06-08" || ai.endDate !== "2026-06-26") {
    console.error("FAIL: AI date span", ai.startDate, ai.endDate);
    process.exit(1);
  }
  assertAbstractSummary("AI功能需求", ai.workSummary);

  const t6Summary = summarizeProjectWork(
    ["WK21 周三内访26个，周一/二每天访问10个，周三访6个"],
    "T6退货专项调研"
  );
  assertAbstractSummary("T6退货专项调研", t6Summary);
  if (!/深访|访问|退货/.test(t6Summary)) {
    console.error("FAIL: T6 summary should abstract visit work", t6Summary);
    process.exit(1);
  }

  const split = finalizeWeeklyHighlights([
    "WK25 总结表更新后已投放问卷&更新结果。报告待打磨",
  ]);
  if (split.length !== 2 || !split.every((h) => /^WK25\b/.test(h))) {
    console.error("FAIL: split combined WK25 highlights", split);
    process.exit(1);
  }

  const xtsSummary = summarizeProjectWork([
    "WK26 因本周优先S6退货访问，调整为周一二每天新增5个，共10个",
    "WK28 本周主要安排实习生参与分析&大模型搭建工作；共访问10个",
    "WK27 调整为3天访问，2天分析XTS差异；共访问15个",
    "WK25 实际达成8个，因为工作时间访问通过率低于全时段访问",
    "WK24 收尾访问，并基于20*3个用户访问结果更新种草-比选-决策链路报告",
  ]);
  assertAbstractSummary("XTS决策链路", xtsSummary);

  const wbrSummary = summarizeProjectWork([
    "WK28 已更新WBR，未调研",
    "WK27 已交接，待调研",
    "WK28 周一二更新WBR，周一下午线下调研",
  ]);
  assertAbstractSummary("线下WBR", wbrSummary);
  if (!/WBR/.test(wbrSummary) || !/线下调研/.test(wbrSummary)) {
    console.error("FAIL: WBR summary should mention WBR and offline research", wbrSummary);
    process.exit(1);
  }

  const psmSummary = summarizeProjectWork([
    "WK27 周一投放，周三整理初步数据/视情况替换链接+投放ABtest问卷-回收100份",
    "WK28 暂不投放额外测试",
  ]);
  assertAbstractSummary("硬件PSM", psmSummary);
  if (!/问卷投放/.test(psmSummary)) {
    console.error("FAIL: hardware PSM summary should mention questionnaire launch", psmSummary);
    process.exit(1);
  }

  const stale = sanitizeProfileProjects(
    [
      {
        id: "old",
        name: "产品战略分析",
        description: "WK22",
        technologies: [],
        highlights: ["WK22 完成竞品扫描"],
        startDate: "2026-05-18",
        endDate: "2026-05-22",
        status: "ongoing",
      },
      {
        id: "fresh",
        name: "XTS决策链路",
        description: "WK28",
        technologies: [],
        highlights: ["WK28 共访问10个"],
        startDate: "2026-07-06",
        endDate: "2026-07-10",
        status: "ongoing",
      },
    ] as Project[],
    []
  );
  const staleProject = stale.find((p) => p.name === "产品战略分析");
  if (!staleProject || staleProject.status !== ("completed" as const)) {
    console.error("FAIL: project 3+ weeks behind reference should be completed", staleProject);
    process.exit(1);
  }
  const freshProject = stale.find((p) => p.name === "XTS决策链路");
  if (!freshProject || freshProject.status !== "ongoing") {
    console.error("FAIL: current-week project should stay ongoing", freshProject);
    process.exit(1);
  }

  let value = "";
  try {
    const extracted = await mammoth.extractRawText({ path: DOC });
    value = extracted.value;
  } catch {
    console.log("SKIP: docx fixture unavailable, synthetic AI tests passed");
    console.log("OK: AI fixture + summary extraction verified");
    return;
  }
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
  assertAbstractSummary("XTS决策链路", xts.workSummary);

  const agent = projects.find((p) => p.name === "智能体搭建");
  if (!agent || agent.startDate !== "2026-06-15" || agent.endDate !== "2026-07-10") {
    console.error("FAIL: 智能体搭建 cross-week merge", agent);
    process.exit(1);
  }
  assertAbstractSummary("智能体搭建", agent.workSummary);

  const aiDoc = projects.find((p) => p.name === "AI功能需求");
  if (aiDoc) {
    if (!(aiDoc.highlights ?? []).every((h) => /^WK\d{1,2}\b/.test(h))) {
      console.error("FAIL: doc AI highlights need WK prefix", aiDoc.highlights);
      process.exit(1);
    }
    assertAbstractSummary("AI功能需求(doc)", aiDoc.workSummary);
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

  const dupProfile = sanitizeProfileProjects(
    [
      {
        id: "ai1",
        name: "AI功能需求",
        description: "WK25",
        technologies: [],
        highlights: ["WK25 总结表更新后已投放问卷&更新结果"],
        startDate: "2026-06-15",
        endDate: "2026-06-19",
        status: "ongoing" as const,
        tags: ["P0"],
      },
      {
        id: "ai2",
        name: "AI功能需求",
        description: "WK24",
        technologies: [],
        highlights: ["WK24 质量未达预期，原计划完成报告更新&汇报&问卷"],
        startDate: "2026-06-08",
        endDate: "2026-06-12",
        status: "ongoing" as const,
        tags: ["P1"],
      },
      {
        id: "r2a",
        name: "R2新品规划PSM+弹性测试",
        description: "WK25",
        technologies: [],
        highlights: ["WK25 本周已综合AI需求总结表"],
        startDate: "2026-06-15",
        endDate: "2026-06-19",
        status: "ongoing" as const,
        tags: ["P0"],
      },
      {
        id: "r2b",
        name: "R2新品规划PSM+弹性",
        description: "WK26",
        technologies: [],
        highlights: [],
        startDate: "2026-06-22",
        endDate: "2026-06-26",
        status: "ongoing" as const,
        tags: ["P0"],
      },
    ],
    []
  );
  if (dupProfile.filter((p) => p.name === "AI功能需求").length !== 1) {
    console.error("FAIL: duplicate AI功能需求 should merge to one", dupProfile.map((p) => p.name));
    process.exit(1);
  }
  if (dupProfile.filter((p) => p.name === "R2新品规划").length !== 1) {
    console.error("FAIL: R2 variants should merge to one", dupProfile.map((p) => p.name));
    process.exit(1);
  }
  const mergedAi = dupProfile.find((p) => p.name === "AI功能需求");
  if (!mergedAi?.tags?.includes("P0") || !mergedAi?.tags?.includes("P1")) {
    console.error("FAIL: merged AI should keep P0+P1 tags", mergedAi?.tags);
    process.exit(1);
  }

  console.log("OK: canonical project merge verified");
}

main();
