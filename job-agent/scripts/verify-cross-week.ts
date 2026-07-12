import mammoth from "mammoth";
import {
  normalizeProjectName,
  parseWeeklyReportProjects,
} from "../src/lib/weekly-report-parser";

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
    console.error("FAIL: R2 should include —— actual completion from 计划 line", r2?.highlights);
    process.exit(1);
  }

  const offline = wk27projects.find((p) => p.name.includes("线下WBR"));
  if (!offline || !(offline.highlights ?? []).some((h) => h.includes("已交接"))) {
    console.error("FAIL: 未达成 should use content after status/arrow", offline?.highlights);
    process.exit(1);
  }

  console.log("OK: cross-week merge + 计划/卡点 filter + status parsing verified");
}

main();
