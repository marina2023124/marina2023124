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
const WK_HEADER_RE = /^WK\s*(\d{1,2})\s*$/i;
const REPORT_DATE_RE = /周报[（(](\d{4})-(\d{2})-(\d{2})/;

const PROJECT_SECTION_HEADER_RE =
  /^(本周项目|本周工作|本周完成|本周进展|本周任务|进行中项目|项目进展)([：:。.\s]*)$/i;
const PROJECT_SECTION_INLINE_RE =
  /^(本周项目|本周工作|本周完成|本周进展|本周任务)[：:]\s*(.+)$/i;
const END_SECTION_RE =
  /^(下周计划|下周工作|下月计划|下周任务|下周目标|方法策略|业务价值|资源支持|备注|附件|工作总结|其他事项|目标达成|团队Token|《.+》读书笔记)([：:。.\s]*)$/i;
const CATEGORY_LABEL_RE = /^[a-zA-Z][）).、:：]\s*[\u4e00-\u9fa5A-Za-z]{1,16}$/;
const SKIP_META_RE =
  /^(姓名|部门|岗位|汇报人|日期|分类包括|LLM支持|成员|当月用量|todo|愿景|目标。)/i;
const VERB_RE =
  /完成|进行|负责|撰写|访谈|问卷|调研|报告|投放|分析|总结|整理|交付|推进|开展|深访|焦点小组|清洗|输出|招募|测试|上线|优化|开发|设计|座谈|纪要|运营|沉淀|搭建|同步|达成|更新|安排|访问|汇报|推进/;
const PROJECT_TITLE_ONLY_RE =
  /^[\u4e00-\u9fa5A-Za-z0-9（）()·/&+]{2,30}$/;
const SKIP_PROJECT_LINE_RE =
  /每个工作日.*汇报|^P[01]每个工作日|^P3项目[：:]|^P3项目$|^P[23](?:【[^】]+】)?\s*《|^R1已购|^S2\/6|^其他用户访问|^计划[：:]|^方法策略|^业务价值|^资源支持|^目标达成|做对的方面|没有做对的方面|核心观点|接需求|SMARS|【执行待定】$/;
const CONTINUATION_LINE_RE = /^周[一二三四五六日]|^→|^①|^②|^③|^\d+[、.]/;
const BARE_PROJECT_LINE_RE =
  /^([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5&+／/（）()·\s]{1,30}?)[。.](.+)$/;

export function isWeeklyReportText(text: string): boolean {
  const sample = text.slice(0, 4000);
  return (
    /周报|本周工作|本周完成|本周进展|本周项目|周工作总结|本周任务|下周计划|Weekly\s*Report/i.test(
      sample
    ) ||
    /\bWK\s*\d{1,2}\b/i.test(sample) ||
    (/本周|下周/.test(sample) && /\b\d{6,7}\b/.test(sample)) ||
    /本周项目[：:\s]/i.test(sample)
  );
}

interface WeeklyEntry {
  projectId?: string;
  projectName?: string;
  priority?: string;
  tags?: string[];
  tasks: string[];
  weekStart?: string;
  weekEnd?: string;
  weekLabel?: string;
}

const STATUS_SEGMENT_RE =
  /^(已达成|未达成|已推进|已同步|未按时达成|未调研|未达成|EOD达成|持续推进|原计划|计划[：:]|→|——)/;
const STATUS_INLINE_RE =
  /已达成|未达成|已推进|已同步|【被动调整】|【主动调整】|【新增高优】|【本周新增】|【紧急新增】|【被动调整】/g;

function extractPriority(line: string): string | undefined {
  const match = line.match(/^(P[0-3])/i);
  return match?.[1]?.toUpperCase();
}

/** 从周报行提取实质工作内容，过滤「已达成」「原计划→」等动态记录 */
function extractSubstantiveWork(line: string, projectName: string): string[] {
  let body = line.replace(/^P[0-3](?:【[^】]+】)?\s*/i, "").trim();
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  body = body.replace(new RegExp(`^${escaped}\\s*[。.]?\\s*`), "");

  const parts = body.split(/[。.]/).map((p) => p.trim()).filter(Boolean);
  const items: string[] = [];

  for (const part of parts) {
    if (STATUS_SEGMENT_RE.test(part)) continue;
    if (/^→/.test(part)) continue;
    if (/^(被动调整|主动调整|新增高优|本周新增|紧急新增)/.test(part)) continue;

    const cleaned = part
      .replace(/^(已达成|未达成|已推进|已同步)[、，,。\s]*/i, "")
      .replace(STATUS_INLINE_RE, "")
      .trim();

    if (/^原计划/.test(cleaned) && (/→/.test(cleaned) || cleaned.length < 20)) continue;
    if (!cleaned || cleaned.length < 4) continue;
    if (/^(已更新|未调研|调整为|因.+暂停)/.test(cleaned) && cleaned.length < 35) continue;

    items.push(cleaned);
  }

  if (items.length === 0 && CONTINUATION_LINE_RE.test(line)) {
    const cont = line.replace(STATUS_INLINE_RE, "").trim();
    if (cont.length >= 6 && !STATUS_SEGMENT_RE.test(cont)) items.push(cont);
  }

  return items;
}

function buildWeeklyEntry(line: string, projectName: string, priority?: string): WeeklyEntry {
  const tasks = extractSubstantiveWork(line, projectName);
  const tags = priority ? [priority] : [];
  return { projectName, priority, tags, tasks };
}

/** ISO 工作周：周一～周五，如 WK28 2026 = 7.6-7.10 */
export function workWeekRange(
  year: number,
  week: number
): { start: string; end: string; label: string } {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - day + 1);
  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    start: toIsoDateString(monday),
    end: toIsoDateString(friday),
    label: `WK${week}`,
  };
}

function extractReportYear(text: string): number {
  const titled = text.match(REPORT_DATE_RE);
  if (titled) return Number(titled[1]);
  const dated = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dated) return Number(dated[1]);
  return new Date().getFullYear();
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
    tasks: [line],
  };
}

function tryParsePriorityProjectLine(line: string): WeeklyEntry | null {
  if (SKIP_PROJECT_LINE_RE.test(line)) return null;
  if (/^P[23]/i.test(line)) return null;

  const priority = extractPriority(line);
  const priorityLine = line.match(/^P[0-3](?:【[^】]+】)?\s*(.+?)[。.](.+)$/);
  if (priorityLine) {
    const name = priorityLine[1].trim();
    if (name.length >= 2 && name.length <= 40) {
      return buildWeeklyEntry(line, name, priority);
    }
  }

  if (!/^P[0-3]/i.test(line)) {
    const bare = line.match(BARE_PROJECT_LINE_RE);
    if (bare) {
      const name = bare[1].trim();
      if (
        name.length >= 2 &&
        name.length <= 32 &&
        !/^(做对的|没有做|分类|包括|方法|业务|资源)/.test(name) &&
        (VERB_RE.test(line) || /已达成|已推进|已同步|原计划|→/.test(line))
      ) {
        return buildWeeklyEntry(line, name);
      }
    }
  }

  return null;
}

function tryParseNameTaskLine(line: string): WeeklyEntry | null {
  const priority = tryParsePriorityProjectLine(line);
  if (priority) return priority;

  if (/每个工作日|^[周\d]/.test(line)) return null;

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
  if (verbSplit && verbSplit[1].length >= 4) {
    const name = verbSplit[1].trim();
    if (!/本周|下周|分类|包括|^周[一二三四五六日]$/.test(name)) {
      return { projectName: name, tasks: [line] };
    }
  }

  return null;
}

function tryParseInlineIdLine(line: string): WeeklyEntry | null {
  const inlineId = line.match(/\b(\d{6,7}|proposal)\b/i);
  if (inlineId && VERB_RE.test(line)) {
    const projectId =
      inlineId[1].toLowerCase() === "proposal" ? "proposal" : inlineId[1];
    return {
      projectId,
      tasks: [line],
    };
  }
  return null;
}

function withWeekContext(
  entry: WeeklyEntry,
  week?: { start: string; end: string; label: string }
): WeeklyEntry {
  if (!week) return entry;
  return {
    ...entry,
    weekStart: week.start,
    weekEnd: week.end,
    weekLabel: week.label,
  };
}

function parseBlockEntries(text: string, week?: { start: string; end: string; label: string }): WeeklyEntry[] {
  const entries: WeeklyEntry[] = [];
  let inProjectSection = false;
  let currentEntry: WeeklyEntry | null = null;
  let lastPushedIndex = -1;

  const flushCurrent = () => {
    if (currentEntry && (currentEntry.projectName || currentEntry.tasks.length > 0)) {
      entries.push(withWeekContext(currentEntry, week));
      lastPushedIndex = entries.length - 1;
    }
    currentEntry = null;
  };

  const pushEntry = (entry: WeeklyEntry) => {
    flushCurrent();
    entries.push(withWeekContext(entry, week));
    lastPushedIndex = entries.length - 1;
  };

  const appendToLast = (line: string) => {
    const cleaned = line.replace(STATUS_INLINE_RE, "").trim();
    if (!cleaned || STATUS_SEGMENT_RE.test(cleaned)) return false;
    if (lastPushedIndex >= 0) {
      if (!entries[lastPushedIndex].tasks.includes(cleaned)) {
        entries[lastPushedIndex].tasks.push(cleaned);
      }
      return true;
    }
    if (currentEntry) {
      if (!currentEntry.tasks.includes(cleaned)) {
        currentEntry.tasks.push(cleaned);
      }
      return true;
    }
    return false;
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
    if (WK_HEADER_RE.test(line)) continue;

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
      const priority = tryParsePriorityProjectLine(line);
      if (priority) {
        pushEntry(priority);
        continue;
      }

      if (CONTINUATION_LINE_RE.test(line) && appendToLast(line)) {
        continue;
      }

      const nameTask = tryParseNameTaskLine(line);
      if (nameTask) {
        pushEntry(nameTask);
        continue;
      }

      if (PROJECT_TITLE_ONLY_RE.test(line) && !VERB_RE.test(line)) {
        flushCurrent();
        currentEntry = withWeekContext({ projectName: line, tasks: [] }, week);
        continue;
      }

      if (currentEntry?.projectName) {
        if (line.length >= 4) {
          currentEntry.tasks.push(line);
          continue;
        }
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

function splitWeekSections(text: string): Array<{ week: number; content: string }> {
  const sections: Array<{ week: number; content: string }> = [];
  const re = /(?:^|\n)WK\s*(\d{1,2})\s*(?:\n|$)/gi;
  const hits: Array<{ week: number; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const index = match[0].startsWith("\n") ? match.index + 1 : match.index;
    hits.push({ week: Number(match[1]), index });
  }
  if (!hits.length) return sections;

  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index - 1 : text.length;
    sections.push({ week: hits[i].week, content: text.slice(start, end) });
  }
  return sections;
}

function extractWeeklyProjectBlock(sectionText: string): string {
  const match = sectionText.match(
    /本周项目[：:.]?\s*([\s\S]*?)(?=\n\s*(?:P3项目|方法策略|业务价值|下周目标|下周计划|资源支持)|$)/i
  );
  return match?.[1]?.trim() ?? "";
}

function parseWeeklyEntries(text: string): WeeklyEntry[] {
  if (/\bWK\s*\d{1,2}\b/i.test(text)) {
    const year = extractReportYear(text);
    const all: WeeklyEntry[] = [];
    for (const section of splitWeekSections(text)) {
      const week = workWeekRange(year, section.week);
      const block = extractWeeklyProjectBlock(section.content);
      const body = block ? `本周项目\n${block}` : section.content;
      all.push(...parseBlockEntries(body, week));
    }
    if (all.length) return all;
  }

  return parseBlockEntries(text);
}

function extractWeekDates(text: string, entry?: WeeklyEntry): { start?: string; end?: string } {
  if (entry?.weekStart || entry?.weekEnd) {
    return { start: entry.weekStart, end: entry.weekEnd };
  }

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

  const wk = text.match(/\bWK\s*(\d{1,2})\b/i);
  if (wk) {
    const year = extractReportYear(text);
    const week = workWeekRange(year, Number(wk[1]));
    return { start: week.start, end: week.end };
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
    const normalized = entry.projectName.toLowerCase();
    const byName = existingProjects.find((project) => {
      const name = project.name.toLowerCase();
      return (
        name === normalized ||
        name.includes(normalized) ||
        normalized.includes(name)
      );
    });
    if (byName) return byName;
  }

  return undefined;
}

function mergeTags(current: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...current, ...incoming]));
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

  const updates = new Map<string, Project>();

  for (const entry of entries) {
    const weekDates = extractWeekDates(text, entry);
    const existing = findExistingProject(entry, existingProjects);
    const key = existing?.id || entry.projectId || entry.projectName || entry.tasks[0];

    if (existing) {
      const current = updates.get(key) || {
        ...existing,
        highlights: [...(existing.highlights ?? [])],
        tags: [...(existing.tags ?? [])],
      };
      current.highlights = mergeHighlights(current.highlights ?? [], entry.tasks);
      current.tags = mergeTags(current.tags, entry.tags);
      current.startDate = minIsoDate(current.startDate, weekDates.start);
      current.endDate = maxIsoDate(current.endDate, weekDates.end);
      current.status = "ongoing";
      if (entry.weekLabel && !current.description?.includes(entry.weekLabel)) {
        const weekNote = `${entry.weekLabel}（${weekDates.start ?? ""}～${weekDates.end ?? ""}）`;
        current.description = current.description
          ? `${current.description}；${weekNote}`
          : weekNote;
      }
      current.workSummary = summarizeProjectWork(getProjectWorkItems(current));
      updates.set(key, current);
      continue;
    }

    const weekNote = entry.weekLabel
      ? `${entry.weekLabel}（${weekDates.start ?? ""}～${weekDates.end ?? ""}）`
      : "";
    const created: Project = {
      id: generateId(),
      name: entry.projectName || (entry.projectId ? `项目 ${entry.projectId}` : entry.tasks[0]?.slice(0, 24) || "未命名项目"),
      description: entry.projectId
        ? `项目编号 ${entry.projectId}${weekNote ? `；${weekNote}` : ""}`
        : weekNote,
      projectId: entry.projectId,
      technologies: [],
      tags: entry.tags ?? [],
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
  const wkMatch = sourceText.match(/\bWK\s*(\d{1,2})\b/i);
  const weekHint = wkMatch
    ? ` · ${workWeekRange(extractReportYear(sourceText), Number(wkMatch[1])).label}`
    : "";

  if (!projects.length) {
    if (/本周项目/i.test(sourceText) && entryCount === 0) {
      return "未识别到项目：请确认「本周项目」下有 P0/P1 条目或「项目名。任务」格式";
    }
    return `未从周报中识别到项目条目（扫描 ${entryCount} 行）`;
  }
  return `识别 ${entryCount} 条工作记录 · 更新/新增 ${projects.length} 个项目${weekHint}`;
}
