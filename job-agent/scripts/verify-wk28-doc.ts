import mammoth from "mammoth";
import { parseWeeklyReportProjects } from "../src/lib/weekly-report-parser";

const DOC =
  "/home/ubuntu/.cursor/projects/workspace/uploads/_________2026-07-11__c62c.docx";

async function main() {
  const { value } = await mammoth.extractRawText({ path: DOC });

  const wk28start = value.indexOf("WK28");
  const wk27start = value.indexOf("WK27");
  const wk28text = value.slice(wk28start, wk27start);

  const projects = parseWeeklyReportProjects(wk28text, []);
  console.log("WK28 projects:", projects.length);
  for (const p of projects) {
    console.log(`- ${p.name} | ${p.startDate} ~ ${p.endDate}`);
  }

  const expected = [
    "线下WBR&线下调研",
    "产品战略分析",
    "高价品WBR",
    "R2新品规划",
    "内容PSM",
    "硬件PSM",
    "智能体搭建",
    "XTS决策链路",
  ];

  for (const name of expected) {
    if (!projects.some((p) => p.name.includes(name) || name.includes(p.name))) {
      console.error("MISSING:", name);
      process.exit(1);
    }
  }

  if (projects.some((p) => p.name === "P3项目")) {
    console.error("FAIL: P3项目 should not be imported as weekly project");
    process.exit(1);
  }

  if (projects.length !== 8) {
    console.error("FAIL: expected exactly 8 WK28 projects, got", projects.length);
    process.exit(1);
  }

  const first = projects[0];
  if (first.startDate !== "2026-07-06" || first.endDate !== "2026-07-10") {
    console.error("FAIL: WK28 dates", first.startDate, first.endDate);
    process.exit(1);
  }

  console.log("OK: WK28 docx weekly parse verified");
}

main();
