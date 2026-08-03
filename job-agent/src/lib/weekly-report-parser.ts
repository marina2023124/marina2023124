import type { Project } from "./types";
import {
  extractBlockerContent,
  extractPlanActualContent,
  findProjectIndexForMetaLine,
  canonicalProjectName,
  isInvalidProjectName,
  projectsShouldMerge,
} from "./project-match";
import {
  isNoiseTaskHighlight,
  labelWeeklyTasks,
  mergeWeeklyHighlights,
  normalizeProjectName,
  normalizeTaskHighlight,
  PROJECT_STATUS_TAG_RE,
} from "./project-name";
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
  /^(本周项目|本周工作|本周完成|本周进展|本周任务|本周目标|进行中项目|项目进展)([：:。.\s]*)$/i;
const PROJECT_SECTION_INLINE_RE =
  /^(本周项目|本周工作|本周完成|本周进展|本周任务|本周目标)[：:]\s*(.+)$/i;
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
  /每个工作日.*汇报|^P[01]每个工作日|^P3项目[：:]|^P3项目$|^P[23](?:【[^】]+】)?\s*《|^R1已购|^S2\/6|^其他用户访问|^计划[：:]|^卡点[：:]|^方法策略|^业务价值|^资源支持|^目标达成|做对的方面|没有做对的方面|核心观点|接需求|SMARS|【执行待定】$|^快速集中精力|^CURSOR下周/;
const CONTINUATION_LINE_RE =
  /^周[一二三四五六日]|^→|^——|^①|^②|^③|^\d+[、.]/;
const STATUS_WORDS_RE =
  /已达成|未达成|已推进|已同步|未按时达成|EOD达成|持续推进/;
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
  /^(已达成|未达成|已推进|已同步|未按时达成|未调研|EOD达成|持续推进|原计划|计划[：:]|卡点[：:]|→|——)/;
const STATUS_INLINE_RE =
  /已达成|未达成|已推进|已同步|【被动调整】|【主动调整】|【新增高优】|【本周新增】|【紧急新增】/g;

function extractPriority(line: string): string | undefined {
  const normalized = normalizePriorityLine(line);
  const pMinus = normalized.match(/^P-(\d)/i);
  if (pMinus) return `P-${pMinus[1]}`;
  const match = normalized.match(/^(P[0-3])/i);
  return match?.[1]?.toUpperCase();
}

function stripPriorityPrefix(line: string): string {
  return normalizePriorityLine(line)
    .replace(/^P-\d(?:【[^】]+】)?\s*/i, "")
    .replace(/^P[0-3](?:【[^】]+】)?\s*/i, "")
    .replace(PROJECT_STATUS_TAG_RE, "")
    .trim();
}

function isPriorityProjectLine(line: string): boolean {
  return /^(P[0-3]|P-\d)/i.test(normalizePriorityLine(line));
}

function normalizePriorityLine(line: string): string {
  return line
    .replace(/^[PpＰ]([0-3])/i, (_, d) => `P${d}`)
    .replace(/^[PpＰ]-([0-9])/i, (_, d) => `P-${d}`)
    .replace(/^[PpＰ]－([0-9])/i, (_, d) => `P-${d}`);
}

function cleanWorkText(text: string): string {
  return text
    .replace(STATUS_INLINE_RE, "")
    .replace(/^原计划[^→。]*→\s*/i, "")
    .trim();
}

/** 从项目行正文提取当周实质工作：已达成记状态后内容，未达成取 → 后实际完成 */
function extractWorkFromBody(body: string): string[] {
  const arrow = body.match(/→\s*(.+)/);
  if (arrow) {
    const actual = cleanWorkText(arrow[1]);
    if (actual.length >= 4) return [actual];
  }

  if (/未达成/.test(body)) {
    const after = body.match(/未达成[，,。.]?\s*(.+)/);
    if (after) {
      const actual = cleanWorkText(after[1]);
      if (actual.length >= 4) return [actual];
    }
  }

  const achieved = body.match(
    new RegExp(`(?:${STATUS_WORDS_RE.source})[，,。.]?\\s*(.+)`, "i")
  );
  if (achieved) {
    const work = cleanWorkText(achieved[1]);
    if (work.length >= 4) return [work];
  }

  const parts = body.split(/[。.]/).map((p) => p.trim()).filter(Boolean);
  const items: string[] = [];
  for (const part of parts) {
    if (STATUS_SEGMENT_RE.test(part)) continue;
    if (/^→/.test(part)) continue;
    if (/^(被动调整|主动调整|新增高优|本周新增|紧急新增)/.test(part)) continue;

    const cleaned = cleanWorkText(
      part.replace(/^(已达成|未达成|已推进|已同步)[、，,。\s]*/i, "")
    );
    if (/^原计划/.test(cleaned) && (/→/.test(cleaned) || cleaned.length < 20)) continue;
    if (!cleaned || cleaned.length < 4) continue;
    if (
      /^(已更新|未调研|调整为|因.+暂停)/.test(cleaned) &&
      cleaned.length < 35 &&
      !/问卷|报告|雷达图|总结表|链接|数据|结果|版本|投放/.test(cleaned)
    ) {
      continue;
    }
    items.push(cleaned);
  }
  return items;
}

/** 从周报行提取实质工作内容，过滤「已达成」「原计划→」等动态记录 */
function extractSubstantiveWork(line: string, projectName: string): string[] {
  let body = stripPriorityPrefix(line);
  const normalizedName = normalizeProjectName(projectName);
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  body = body.replace(new RegExp(`^${escaped}\\s*[。.]?\\s*`), "");

  const fromBody = extractWorkFromBody(body);
  if (fromBody.length) return fromBody;

  if (CONTINUATION_LINE_RE.test(line)) {
    const cont = cleanWorkText(line.replace(/^——\s*/, ""));
    if (cont.length >= 6 && !STATUS_SEGMENT_RE.test(cont)) return [cont];
  }

  return [];
}

function parseProjectNameAndBody(line: string): { name: string; body: string } | null {
  const body = stripPriorityPrefix(line);
  if (!body || body.length < 2) return null;

  const commaStatus = body.match(
    new RegExp(`^(.+?)[，,]\\s*(${STATUS_WORDS_RE.source})[。.]\\s*(.*)$`, "i")
  );
  if (commaStatus) {
    return {
      name: normalizeProjectName(commaStatus[1].trim()),
      body: commaStatus[3].trim() || commaStatus[2],
    };
  }

  const periodStatus = body.match(
    new RegExp(`^(.+?)\\s*[。.]\\s*(${STATUS_WORDS_RE.source})\\s*[。.]\\s*(.+)$`, "i")
  );
  if (periodStatus) {
    return {
      name: normalizeProjectName(periodStatus[1].trim()),
      body: periodStatus[3].trim(),
    };
  }

  const barePeriod = body.match(/^(.+?)[。.](.+)$/);
  if (barePeriod) {
    const name = normalizeProjectName(barePeriod[1].trim());
    const tail = barePeriod[2].trim();
    if (STATUS_WORDS_RE.test(tail.split(/[。.]/)[0] ?? "")) {
      return { name, body: tail };
    }
    return { name, body: tail };
  }

  return { name: normalizeProjectName(body), body: "" };
}

function buildWeeklyEntry(line: string, projectName: string, priority?: string): WeeklyEntry {
  const normalizedName = normalizeProjectName(projectName);
  const tasks = extractSubstantiveWork(line, normalizedName);
  const tags = priority ? [priority] : [];
  return { projectName: normalizedName, priority, tags, tasks };
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

export function normalizeWeeklyText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\uFF0E/g, ".")
    .replace(/\uFF09/g, ")")
    .replace(/\uFF08/g, "(")
    .replace(/\uFF0C/g, ",")
    .replace(/\uFF1A/g, ":")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u3000/g, " ");
}

function cleanTaskLine(line: string): string {
  return normalizeWeeklyText(line)
    .trim()
    .replace(/^[-*•●]\s*/, "")
    .replace(/^\d+[、.．)\]）]\s*/, "")
    .replace(/^[（(]\d+[）)]\s*/, "")
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/, "")
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
  const normalizedLine = normalizePriorityLine(line);
  if (SKIP_PROJECT_LINE_RE.test(normalizedLine)) return null;
  if (/^P[23](?!-)/i.test(normalizedLine)) return null;

  const priority = extractPriority(normalizedLine);

  if (isPriorityProjectLine(normalizedLine)) {
    const parsed = parseProjectNameAndBody(normalizedLine);
    if (parsed && parsed.name.length >= 2 && parsed.name.length <= 40) {
      const entry = buildWeeklyEntry(normalizedLine, parsed.name, priority);
      if (!entry.tasks.length && parsed.body) {
        entry.tasks = extractWorkFromBody(parsed.body);
      }
      if (!entry.tasks.length && parsed.body.length >= 4) {
        entry.tasks = [cleanWorkText(parsed.body)];
      }
      if (!entry.tasks.length && parsed.name.length >= 2) {
        entry.tasks = [parsed.name];
      }
      if (entry.projectName && isInvalidProjectName(entry.projectName)) return null;
      return entry;
    }
  }

  if (!isPriorityProjectLine(normalizedLine)) {
    const bare = line.match(BARE_PROJECT_LINE_RE);
    if (bare) {
      const name = normalizeProjectName(bare[1].trim());
      if (
        name.length >= 2 &&
        name.length <= 32 &&
        !/^(做对的|没有做|分类|包括|方法|业务|资源|计划|卡点)/.test(name) &&
        (VERB_RE.test(line) || STATUS_WORDS_RE.test(line) || /→/.test(line))
      ) {
        return buildWeeklyEntry(line, name);
      }
    }
  }

  return null;
}

function tryParseNameTaskLine(line: string): WeeklyEntry | null {
  if (/^(计划|卡点)[：:]/.test(line)) return null;

  const priority = tryParsePriorityProjectLine(line);
  if (priority) return priority;

  if (/每个工作日|^[周\d]/.test(line)) return null;

  const colon = line.match(/^(.{2,30}?)[：:]\s*(.+)$/);
  if (colon && colon[2].length >= 2) {
    const name = colon[1].trim();
    if (!/^(本周|下周|分类|包括|项目|计划|卡点)/.test(name)) {
      const projectName = normalizeProjectName(name);
      if (isInvalidProjectName(projectName)) return null;
      return { projectName, tasks: [line] };
    }
  }

  const dash = line.match(/^(.{2,30}?)\s*[-–—]\s*(.+)$/);
  if (dash && dash[2].length >= 4 && VERB_RE.test(line)) {
    return { projectName: normalizeProjectName(dash[1].trim()), tasks: [line] };
  }

  const verbSplit = line.match(
    /^(.{2,24}?)(完成|进行|负责|撰写|访谈|投放|整理|交付|推进|清洗|输出|深访|开展|设计|开发|测试|优化).+/
  );
  if (verbSplit && verbSplit[1].length >= 4) {
    const name = normalizeProjectName(verbSplit[1].trim());
    if (!/本周|下周|分类|包括|^周[一二三四五六日]$|计划|卡点/.test(name)) {
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

function parseBlockEntries(
  text: string,
  week?: { start: string; end: string; label: string },
  priorWeekGoalNames: string[] = [],
  options?: { defaultInProjectSection?: boolean }
): WeeklyEntry[] {
  const entries: WeeklyEntry[] = [];
  let inProjectSection = options?.defaultInProjectSection ?? false;
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
    if (entry.projectName && isInvalidProjectName(entry.projectName)) {
      if (lastPushedIndex >= 0 && entry.tasks.length) {
        for (const task of entry.tasks) {
          if (!entries[lastPushedIndex].tasks.includes(task)) {
            entries[lastPushedIndex].tasks.push(task);
          }
        }
      }
      return;
    }
    flushCurrent();
    entries.push(withWeekContext(entry, week));
    lastPushedIndex = entries.length - 1;
  };

  const appendMetaToProject = (line: string, kind: "plan" | "blocker") => {
    const content =
      kind === "plan" ? extractPlanActualContent(line) : extractBlockerContent(line);
    if (!content) return false;

    let targetIdx = findProjectIndexForMetaLine(line, entries, lastPushedIndex);
    if (targetIdx < 0 && priorWeekGoalNames.length) {
      for (let i = entries.length - 1; i >= 0; i--) {
        const name = entries[i].projectName;
        if (name && priorWeekGoalNames.some((goal) => name.includes(goal) || goal.includes(name))) {
          if (kind === "blocker" || findProjectIndexForMetaLine(line, [entries[i]], 0) >= 0) {
            targetIdx = i;
            break;
          }
        }
      }
    }
    if (targetIdx < 0) return false;

    if (!entries[targetIdx].tasks.includes(content)) {
      entries[targetIdx].tasks.push(content);
    }
    return true;
  };

  const appendToLast = (line: string) => {
    const cleaned = line
      .replace(/^——\s*/, "")
      .replace(STATUS_INLINE_RE, "")
      .trim();
    if (!cleaned || STATUS_SEGMENT_RE.test(cleaned)) return false;
    if (/^(计划|卡点)[：:]/.test(cleaned)) return false;
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
    if (WK_HEADER_RE.test(line)) {
      if (!inProjectSection && options?.defaultInProjectSection) {
        inProjectSection = true;
      }
      continue;
    }

    if (!inProjectSection && isPriorityProjectLine(line)) {
      const priority = tryParsePriorityProjectLine(line);
      if (priority) {
        pushEntry(priority);
        continue;
      }
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

    if (/^本周目标[：:.。\s]*$|^下周目标[：:.。\s]*$/i.test(line)) {
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
      if (/^计划[：:]/.test(line)) {
        appendMetaToProject(line, "plan");
        continue;
      }
      if (/^卡点[：:]/.test(line)) {
        appendMetaToProject(line, "blocker");
        continue;
      }

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
        currentEntry = withWeekContext(
          { projectName: normalizeProjectName(line), tasks: [] },
          week
        );
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

/** 提取「下周目标」中的完整工作条目，用于衔接至下一周本周项目 */
function extractNextGoalEntries(sectionText: string): WeeklyEntry[] {
  const block = sectionText.match(
    /下周目标[：:.]?\s*([\s\S]*?)(?=\n\s*(?:资源支持|P3项目|方法策略|业务价值)|$)/i
  )?.[1];
  if (!block?.trim()) return [];

  const entries: WeeklyEntry[] = [];
  for (const rawLine of block.split("\n")) {
    const line = cleanTaskLine(rawLine);
    if (!line || line.length < 2 || SKIP_PROJECT_LINE_RE.test(line)) continue;

    const parsed = tryParsePriorityProjectLine(line);
    if (parsed?.projectName && !/^(每个工作日|计划|卡点)$/i.test(parsed.projectName)) {
      entries.push(parsed);
      continue;
    }

    const nameTask = tryParseNameTaskLine(line);
    if (nameTask?.projectName) {
      entries.push(nameTask);
    }
  }
  return entries;
}

/** 提取「下周目标」中的项目名称，用于理解跨周衔接（上周目标 → 本周项目） */
function extractNextGoalProjectNames(sectionText: string): string[] {
  const block = sectionText.match(
    /下周目标[：:.]?\s*([\s\S]*?)(?=\n\s*(?:资源支持|P3项目|方法策略|业务价值)|$)/i
  )?.[1];
  if (!block) return [];

  const names: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = cleanTaskLine(rawLine);
    if (!line || SKIP_PROJECT_LINE_RE.test(line)) continue;
    const parsed = tryParsePriorityProjectLine(line);
    if (parsed?.projectName && !/^(每个工作日|计划|卡点)$/i.test(parsed.projectName)) {
      names.push(normalizeProjectName(parsed.projectName));
    }
  }
  return Array.from(new Set(names));
}

function parseWeeklyEntries(text: string): WeeklyEntry[] {
  const normalized = normalizeWeeklyText(text);
  if (/\bWK\s*\d{1,2}\b/i.test(normalized)) {
    const year = extractReportYear(normalized);
    const all: WeeklyEntry[] = [];
    const sections = splitWeekSections(normalized);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const week = workWeekRange(year, section.week);
      const block = extractWeeklyProjectBlock(section.content);
      const stripped = section.content.replace(/^\s*WK\s*\d{1,2}\s*\n?/i, "").trim();
      const body = block ? `本周项目\n${block}` : stripped;
      const priorSection = sections[i + 1];
      const priorWeekGoalNames = priorSection
        ? extractNextGoalProjectNames(priorSection.content)
        : [];
      all.push(
        ...parseBlockEntries(body, week, priorWeekGoalNames, {
          defaultInProjectSection: !block,
        })
      );

      if (priorSection) {
        const priorGoals = extractNextGoalEntries(priorSection.content);
        for (const goal of priorGoals) {
          const labeled = withWeekContext(
            {
              ...goal,
              tasks: labelWeeklyTasks(goal.tasks, week.label),
            },
            week
          );
          all.push(labeled);
        }
      }
    }
    if (all.length) return all;
  }

  return parseBlockEntries(normalized);
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
  existingProjects: Project[],
  updates?: Map<string, Project>
): Project | undefined {
  const normalizedName = entry.projectName
    ? normalizeProjectName(entry.projectName).toLowerCase()
    : "";

  const matchByEntry = (project: Project) => {
    if (entry.projectId) {
      const currentId = project.projectId || extractProjectId(project);
      if (currentId === entry.projectId) return true;
    }
    if (normalizedName && entry.projectName) {
      return projectsShouldMerge(project.name, entry.projectName);
    }
    return false;
  };

  if (updates) {
    for (const project of Array.from(updates.values())) {
      if (matchByEntry(project)) return project;
    }
  }

  return existingProjects.find(matchByEntry);
}

function resolveMergeKey(
  entry: WeeklyEntry,
  existing: Project | undefined,
  updates: Map<string, Project>
): string {
  if (existing) {
    for (const [key, project] of Array.from(updates.entries())) {
      if (project.id === existing.id) return key;
    }
    return existing.id;
  }

  const normalizedName = entry.projectName
    ? normalizeProjectName(entry.projectName).toLowerCase()
    : "";

  if (entry.projectId) {
    for (const [key, project] of Array.from(updates.entries())) {
      const currentId = project.projectId || extractProjectId(project);
      if (currentId === entry.projectId) return key;
    }
    return `pending-id:${entry.projectId}`;
  }

  if (normalizedName && entry.projectName) {
    for (const [key, project] of Array.from(updates.entries())) {
      if (projectsShouldMerge(project.name, entry.projectName)) return key;
    }
  }

  return generateId();
}

function mergeTags(current: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...current, ...incoming]));
}

function mergeHighlights(current: string[], incoming: string[]): string[] {
  return mergeWeeklyHighlights(current, incoming);
}

/** 将解析出的周报条目合并为项目列表（规则引擎与 LLM 共用） */
export function mergeWeeklyEntriesToProjects(
  entries: WeeklyEntry[],
  sourceText: string,
  existingProjects: Project[] = []
): Project[] {
  if (!entries.length) return [];

  const normalized = normalizeWeeklyText(sourceText);
  const updates = new Map<string, Project>();

  for (const entry of entries) {
    const weekDates = extractWeekDates(normalized, entry);
    const existing = findExistingProject(entry, existingProjects, updates);
    const key = resolveMergeKey(entry, existing, updates);
    const projectName = entry.projectName
      ? canonicalProjectName(entry.projectName)
      : undefined;

    const cleanedTasks = entry.tasks
      .map((task) => normalizeTaskHighlight(task))
      .filter((task) => task && !isNoiseTaskHighlight(task));
    const labeledTasks = labelWeeklyTasks(cleanedTasks, entry.weekLabel);

    if (existing) {
      const current = updates.get(key) || {
        ...existing,
        name: canonicalProjectName(existing.name),
        highlights: [...(existing.highlights ?? [])],
        tags: [...(existing.tags ?? [])],
      };
      current.name = canonicalProjectName(current.name);
      current.highlights = mergeHighlights(current.highlights ?? [], labeledTasks);
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
      current.workSummary = summarizeProjectWork(
        getProjectWorkItems(current),
        current.name
      );
      updates.set(key, current);
      continue;
    }

    const weekNote = entry.weekLabel
      ? `${entry.weekLabel}（${weekDates.start ?? ""}～${weekDates.end ?? ""}）`
      : "";
    const created: Project = {
      id: generateId(),
      name:
        projectName ||
        (entry.projectId ? `项目 ${entry.projectId}` : entry.tasks[0]?.slice(0, 24) || "未命名项目"),
      description: entry.projectId
        ? `项目编号 ${entry.projectId}${weekNote ? `；${weekNote}` : ""}`
        : weekNote,
      projectId: entry.projectId,
      technologies: [],
      tags: entry.tags ?? [],
      highlights: labeledTasks,
      startDate: weekDates.start,
      endDate: weekDates.end,
      status: "ongoing",
      workSummary: summarizeProjectWork(
        entry.tasks,
        projectName || entry.projectName
      ),
    };
    updates.set(key, created);
  }

  return Array.from(updates.values());
}

export interface LlmWeeklyProjectDraft {
  name: string;
  priority?: string;
  tasks: string[];
}

export function projectsFromLlmWeeklyDrafts(
  items: LlmWeeklyProjectDraft[],
  sourceText: string,
  existingProjects: Project[] = []
): Project[] {
  const wkMatch = normalizeWeeklyText(sourceText).match(/\bWK\s*(\d{1,2})\b/i);
  const weekLabel = wkMatch ? `WK${wkMatch[1]}` : undefined;
  const weekRange =
    wkMatch != null
      ? workWeekRange(extractReportYear(sourceText), Number(wkMatch[1]))
      : undefined;

  const entries: WeeklyEntry[] = items
    .filter((item) => item.name?.trim())
    .map((item) => ({
      projectName: normalizeProjectName(item.name.trim()),
      priority: item.priority?.toUpperCase(),
      tags: item.priority ? [item.priority.toUpperCase()] : [],
      tasks: item.tasks.filter(Boolean),
      weekLabel,
      weekStart: weekRange?.start,
      weekEnd: weekRange?.end,
    }));

  return mergeWeeklyEntriesToProjects(entries, sourceText, existingProjects);
}

/** 从周报/工作记录提取项目更新，用于合并到已有项目列表 */
export function parseWeeklyReportProjects(
  text: string,
  existingProjects: Project[] = []
): Project[] {
  const normalized = normalizeWeeklyText(text);
  if (!normalized.trim()) return [];

  const entries = parseWeeklyEntries(normalized);
  return mergeWeeklyEntriesToProjects(entries, normalized, existingProjects);
}

export { normalizeProjectName, labelWeeklyTasks, mergeWeeklyHighlights, normalizeTaskHighlight, dedupeWeeklyHighlights } from "./project-name";

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
    if (/\bWK\s*\d{1,2}\b/i.test(sourceText) && entryCount === 0) {
      return "未识别到项目：WK 周报请使用 P0/P1/P-1 项目行，或添加「本周项目」标题";
    }
    return `未从周报中识别到项目条目（扫描 ${entryCount} 行）`;
  }
  return `识别 ${entryCount} 条工作记录 · 更新/新增 ${projects.length} 个项目${weekHint}`;
}
