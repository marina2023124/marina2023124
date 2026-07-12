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

const PROJECT_SECTION_HEADER_RE =
  /^(本周项目|本周工作|本周完成|本周进展|本周任务|进行中项目|项目进展)([：:。.\s]*)$/i;
const PROJECT_SECTION_INLINE_RE =
  /^(本周项目|本周工作|本周完成|本周进展|本周任务)[：:]\s*(.+)$/i;
const END_SECTION_RE =
  /^(下周计划|下周工作|下月计划|下周任务|备注|附件|工作总结|其他事项)([：:。.\s]*)$/i;
const CATEGORY_LABEL_RE = /^[a-zA-Z][）).、:：]\s*[\u4e00-\u9fa5A-Za-z]{1,16}$/;
const SKIP_META_RE = /^(姓名|部门|岗位|汇报人|日期|分类包括|LLM支持)/i;
const VERB_RE =
  /完成|进行|负责|撰写|访谈|问卷|调研|报告|投放|分析|总结|整理|交付|推进|开展|深访|焦点小组|清洗|输出|招募|测试|上线|优化|开发|设计|座谈|纪要|投放|运营|沉淀/;
const PROJECT_TITLE_ONLY_RE =
  /^[\u4e00-\u9fa5A-Za-z0-9（）()·/&+]{2,30}$/;

export function isWeeklyReportText(text: string): boolean {
  const sample = text.slice(0, 2000);
  return (
    /周报|本周工作|本周完成|本周进展|本周项目|周工作总结|本周任务|下周计划|Weekly\s*Report/i.test(
      sample
    ) ||
    (/本周|下周/.test(sample) && /\b\d{6,7}\b/.test(sample)) ||
    /本周项目[：:\s]/i.test(sample)
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

function tryParseStructuredLine(line: string): WeeklyEntry | null {
  const structured = line.match(PROJECT_LINE_RE) || line.match(PROJECT_ID_TASK_RE);
  if (!structured) return null;

  const projectId = structured[1].toLowerCase() === "proposal" ? "proposal" : structured[1];
  const tail = structured[2].trim();
  return {
    projectId,
    projectName: extractNameFromTail(tail),
    tasks: [tail],
  };
}

function tryParseNameTaskLine(line: string): WeeklyEntry | null {
  const colon = line.match(/^(.{2,30}?)[：:]\s*(.+)$/);
  if (colon && colon[2].length >= 2) {
    const name = colon[1].trim();
    if (!/^(本周|下周|分类|包括|项目)/.test(name)) {
      return { projectName: name, tasks: [line] };
    }
  }

  const dash = line.match(/^(.{2,30}?)\s*[-–—]\s*(.+)$/);
  if (dash && dash[2].length >= 4 && VERB_RE.test(line)) {
    return { projectName: dash[1].trim(), tasks: [line] };
  }

  const verbSplit = line.match(
    /^(.{2,24}?)(完成|进行|负责|撰写|访谈|投放|整理|交付|推进|清洗|输出|深访|开展|设计|开发|测试|优化).+/
  );
  if (verbSplit && verbSplit[1].length >= 2) {
    const name = verbSplit[1].trim();
    if (!/本周|下周|分类|包括|用研|算法|智能体/.test(name) || name.length >= 4) {
      return { projectName: name, tasks: [line] };
    }
  }

  return null;
}

function tryParseInlineIdLine(line: string): WeeklyEntry | null {
  const inlineId = line.match(/\b(\d{6,7}|proposal)\b/i);
  if (
    inlineId &&
    VERB_RE.test(line)
  ) {
    const projectId =
      inlineId[1].toLowerCase() === "proposal" ? "proposal" : inlineId[1];
    return {
      projectId,
      tasks: [line],
    };
  }
  return null;
}

function parseWeeklyEntries(text: string): WeeklyEntry[] {
  const entries: WeeklyEntry[] = [];
  let inProjectSection = false;
  let currentEntry: WeeklyEntry | null = null;

  const flushCurrent = () => {
    if (currentEntry && currentEntry.tasks.length > 0) {
      entries.push(currentEntry);
    }
    currentEntry = null;
  };

  const pushEntry = (entry: WeeklyEntry) => {
    flushCurrent();
    entries.push(entry);
  };

  for (const rawLine of text.split("\n")) {
    const line = cleanTaskLine(rawLine);
    if (!line || line.length < 2) continue;
    if (SKIP_META_RE.test(line)) {
      flushCurrent();
      continue;
    }
    if (CATEGORY_LABEL_RE.test(line)) {
      flushCurrent();
      continue;
    }

    if (END_SECTION_RE.test(line)) {
      flushCurrent();
      inProjectSection = false;
      continue;
    }

    const inlineSection = line.match(PROJECT_SECTION_INLINE_RE);
    if (inlineSection) {
      flushCurrent();
      inProjectSection = true;
      const remainder = inlineSection[2].trim();
      if (remainder.length >= 4) {
        const structured = tryParseStructuredLine(remainder);
        if (structured) pushEntry(structured);
        else {
          const nameTask = tryParseNameTaskLine(remainder);
          if (nameTask) pushEntry(nameTask);
          else pushEntry({ tasks: [remainder] });
        }
      }
      continue;
    }

    if (PROJECT_SECTION_HEADER_RE.test(line)) {
      flushCurrent();
      inProjectSection = true;
      continue;
    }

    const structured = tryParseStructuredLine(line);
    if (structured) {
      pushEntry(structured);
      continue;
    }

    if (inProjectSection) {
      const nameTask = tryParseNameTaskLine(line);
      if (nameTask) {
        pushEntry(nameTask);
        continue;
      }

      if (PROJECT_TITLE_ONLY_RE.test(line) && !VERB_RE.test(line)) {
        flushCurrent();
        currentEntry = { projectName: line, tasks: [] };
        continue;
      }

      if (currentEntry?.projectName) {
        if (line.length >= 4) {
          currentEntry.tasks.push(line);
          continue;
        }
      }

      if (VERB_RE.test(line) && line.length >= 6 && line.length <= 160) {
        pushEntry({ tasks: [line] });
        continue;
      }

      continue;
    }

    const inlineId = tryParseInlineIdLine(line);
    if (inlineId) {
      pushEntry(inlineId);
    }
  }

  flushCurrent();
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
  if (!projects.length) {
    if (/本周项目/i.test(sourceText) && entryCount === 0) {
      return "未识别到项目：请把具体项目写在「本周项目」标题下方（项目名：本周任务）";
    }
    return `未从周报中识别到项目条目（扫描 ${entryCount} 行）`;
  }
  return `识别 ${entryCount} 条工作记录 · 更新/新增 ${projects.length} 个项目`;
}
