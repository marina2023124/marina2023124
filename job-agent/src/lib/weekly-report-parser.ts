import type { Project } from "./types";
import {
  extractProjectId,
  generateId,
  maxIsoDate,
  minIsoDate,
  parseExcelSerialDate,
  toIsoDateString,
} from "./utils";
import { summarizeProjectWork } from "./project-work-summary";
import { getProjectWorkItems } from "./utils";

const PROJECT_LINE_RE =
  /^(\d{6,7}|proposal)\s*[-–—:|：/]\s*(.+)$/i;
const PROJECT_ID_TASK_RE = /^(\d{6,7}|proposal)\s+(.+)$/i;
const WEEK_RANGE_RE =
  /(\d{4})[./年-](\d{1,2})[./月-]?(\d{1,2})?\s*[-–—~至到]\s*(?:(\d{4})[./年-])?(\d{1,2})[./月-]?(\d{1,2})?/;
const SINGLE_WEEK_RE =
  /(\d{4})[./年-](\d{1,2})[./月-](\d{1,2})?\s*(?:周报|周工作|Weekly)/i;

export function isWeeklyReportText(text: string): boolean {
  const sample = text.slice(0, 2000);
  return (
    /周报|本周工作|本周完成|本周进展|周工作总结|本周任务|下周计划|Weekly\s*Report/i.test(sample) ||
    (/本周|下周/.test(sample) && /\b\d{6,7}\b/.test(sample))
  );
}

interface WeeklyEntry {
  projectId?: string;
  projectName?: string;
  tasks: string[];
}

function cleanTaskLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*•●]\s*/, "")
    .replace(/^\d+[、.．)\]]\s*/, "")
    .replace(/^[（(]\d+[）)]\s*/, "")
    .trim();
}

function isSectionHeader(line: string): boolean {
  return /^(本周工作|本周完成|本周进展|本周任务|下周计划|工作总结|周报|项目进展|进行中项目|备注)[：:]?\s*$/i.test(
    line
  );
}

function extractNameFromTail(tail: string): string | undefined {
  const cleaned = tail
    .replace(/[：:].+$/, "")
    .replace(/完成|进行|负责|推进|开展.+$/, "")
    .trim();
  if (cleaned.length >= 2 && cleaned.length <= 40 && !/完成|访谈|问卷|报告/.test(cleaned)) {
    return cleaned;
  }
  return undefined;
}

function parseWeeklyEntries(text: string): WeeklyEntry[] {
  const entries: WeeklyEntry[] = [];

  for (const rawLine of text.split("\n")) {
    const line = cleanTaskLine(rawLine);
    if (!line || line.length < 4 || isSectionHeader(line)) continue;
    if (/^(姓名|部门|岗位|汇报人|日期)[：:]/i.test(line)) continue;

    const structured = line.match(PROJECT_LINE_RE) || line.match(PROJECT_ID_TASK_RE);
    if (structured) {
      const projectId = structured[1].toLowerCase() === "proposal" ? "proposal" : structured[1];
      const tail = structured[2].trim();
      entries.push({
        projectId,
        projectName: extractNameFromTail(tail),
        tasks: [tail],
      });
      continue;
    }

    const inlineId = line.match(/\b(\d{6,7}|proposal)\b/i);
    if (
      inlineId &&
      /完成|进行|负责|撰写|访谈|问卷|调研|报告|投放|分析|总结|整理|交付|推进|开展|深访|焦点小组/i.test(line)
    ) {
      const projectId =
        inlineId[1].toLowerCase() === "proposal" ? "proposal" : inlineId[1];
      entries.push({
        projectId,
        tasks: [line],
      });
    }
  }

  return entries;
}

function extractWeekDates(text: string): { start?: string; end?: string } {
  const range = text.match(WEEK_RANGE_RE);
  if (range) {
    const startYear = Number(range[1]);
    const startMonth = Number(range[2]);
    const startDay = Number(range[3] || "1");
    const endYear = range[4] ? Number(range[4]) : startYear;
    const endMonth = Number(range[5] || range[2]);
    const endDay = Number(range[6] || startDay);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { start: toIsoDateString(start), end: toIsoDateString(end) };
    }
  }

  const single = text.match(SINGLE_WEEK_RE);
  if (single) {
    const date = new Date(Number(single[1]), Number(single[2]) - 1, Number(single[3] || "1"));
    if (!Number.isNaN(date.getTime())) {
      const iso = toIsoDateString(date);
      return { start: iso, end: iso };
    }
  }

  const firstDate = parseExcelSerialDate(text.slice(0, 120));
  if (firstDate) {
    const iso = toIsoDateString(firstDate);
    return { start: iso, end: iso };
  }

  return {};
}

function findExistingProject(
  entry: WeeklyEntry,
  existingProjects: Project[]
): Project | undefined {
  if (entry.projectId) {
    const byId = existingProjects.find(
      (project) =>
        project.projectId === entry.projectId ||
        extractProjectId(project) === entry.projectId
    );
    if (byId) return byId;
  }

  if (entry.projectName) {
    const byName = existingProjects.find(
      (project) =>
        project.name === entry.projectName ||
        project.name.includes(entry.projectName!) ||
        entry.projectName!.includes(project.name)
    );
    if (byName) return byName;
  }

  return undefined;
}

function mergeHighlights(current: string[], incoming: string[]): string[] {
  const result = [...current];
  for (const task of incoming) {
    const normalized = task.trim();
    if (!normalized) continue;
    if (!result.some((item) => item === normalized || item.includes(normalized) || normalized.includes(item))) {
      result.push(normalized);
    }
  }
  return result;
}

/** 从周报/工作记录提取项目更新，用于合并到已有项目列表 */
export function parseWeeklyReportProjects(
  text: string,
  existingProjects: Project[] = []
): Project[] {
  if (!text.trim()) return [];

  const entries = parseWeeklyEntries(text);
  if (!entries.length) return [];

  const weekDates = extractWeekDates(text);
  const updates = new Map<string, Project>();

  for (const entry of entries) {
    const existing = findExistingProject(entry, existingProjects);
    const key = existing?.id || entry.projectId || entry.projectName || entry.tasks[0];

    if (existing) {
      const current = updates.get(key) || {
        ...existing,
        highlights: [...(existing.highlights ?? [])],
      };
      current.highlights = mergeHighlights(current.highlights ?? [], entry.tasks);
      current.startDate = minIsoDate(current.startDate, weekDates.start);
      current.endDate = maxIsoDate(current.endDate, weekDates.end);
      current.status = "ongoing";
      current.workSummary = summarizeProjectWork(getProjectWorkItems(current));
      updates.set(key, current);
      continue;
    }

    const created: Project = {
      id: generateId(),
      name: entry.projectName || (entry.projectId ? `项目 ${entry.projectId}` : entry.tasks[0].slice(0, 24)),
      description: entry.projectId ? `项目编号 ${entry.projectId}` : "",
      projectId: entry.projectId,
      technologies: [],
      highlights: entry.tasks,
      startDate: weekDates.start,
      endDate: weekDates.end,
      status: "ongoing",
      workSummary: summarizeProjectWork(entry.tasks),
    };
    updates.set(key, created);
  }

  return Array.from(updates.values());
}

export function summarizeWeeklyReportParse(projects: Project[], sourceText: string): string {
  const entryCount = parseWeeklyEntries(sourceText).length;
  if (!projects.length) return `未从周报中识别到项目条目（扫描 ${entryCount} 行）`;
  return `识别 ${entryCount} 条工作记录 · 更新/新增 ${projects.length} 个项目`;
}
