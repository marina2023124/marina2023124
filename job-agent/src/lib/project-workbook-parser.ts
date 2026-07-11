import type { Project } from "./types";
import {
  calcDurationDays,
  generateId,
  parseExcelSerialDate,
  toIsoDateString,
} from "./utils";
import { extractMethodSkillTags } from "./skill-tags";

export interface WorkbookSheet {
  name: string;
  rows: unknown[][];
}

const PROJECT_ID_RE = /^\d{6,7}$|^proposal$|^培训\s*workshop$/i;
const METHOD_RE = /定性|定量|共创|workshop|案头|培训/i;
const INDUSTRY_RE = /^(教育|食品|互联网|宠物|保健品|服饰|文旅|电器|母婴)/;

interface WorkbookDraftProject {
  key: string;
  projectId: string;
  name: string;
  industry: string;
  category: string;
  method: string;
  tasks: string[];
  dates: Date[];
  status: "ongoing" | "completed";
}

type ColumnKey =
  | "industry"
  | "category"
  | "method"
  | "id"
  | "name"
  | "task"
  | "start"
  | "end"
  | "ddl";

function cellValue(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  const value = row[index];
  if (value == null) return "";
  return String(value).trim();
}

function detectColumns(header: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  header.forEach((cell, index) => {
    const text = cell.trim();
    if (!text) return;
    if (text === "行业" || (text.includes("行业") && !text.includes("项目"))) map.industry = index;
    if (text === "品类") map.category = index;
    if (text === "方法" || /定性|定量/.test(text)) map.method = index;
    if (/项目编号|编号/.test(text)) map.id = index;
    if (/项目名/.test(text)) map.name = index;
    if (text === "任务") map.task = index;
    if (text === "启动日期") map.start = index;
    if (text === "完成日期") map.end = index;
    if (text === "DDL") map.ddl = index;
  });
  return map;
}

function addTask(project: WorkbookDraftProject, task: string) {
  const text = task.trim();
  if (!text || text.length < 2 || text === project.name) return;
  if (!project.tasks.includes(text)) project.tasks.push(text);
}

function addDates(project: WorkbookDraftProject, row: unknown[], columns: Partial<Record<ColumnKey, number>>) {
  for (const key of ["start", "end", "ddl"] as const) {
    const index = columns[key];
    if (index === undefined) continue;
    const date = parseExcelSerialDate(row[index]);
    if (date) project.dates.push(date);
  }
}

function upsertDraft(map: Map<string, WorkbookDraftProject>, draft: WorkbookDraftProject): WorkbookDraftProject {
  const existing = map.get(draft.key);
  if (!existing) {
    map.set(draft.key, draft);
    return draft;
  }
  if (!existing.industry && draft.industry) existing.industry = draft.industry;
  if (!existing.category && draft.category) existing.category = draft.category;
  if (!existing.method && draft.method) existing.method = draft.method;
  if (!existing.projectId && draft.projectId) existing.projectId = draft.projectId;
  for (const task of draft.tasks) addTask(existing, task);
  existing.dates.push(...draft.dates);
  if (draft.status === "ongoing") existing.status = "ongoing";
  return existing;
}

function finalizeWorkbookProject(draft: WorkbookDraftProject): Project {
  const meta = [draft.industry, draft.category, draft.method, draft.projectId]
    .filter(Boolean)
    .join(" · ");
  const sortedDates = draft.dates.sort((a, b) => a.getTime() - b.getTime());
  const startDate = sortedDates[0] ? toIsoDateString(sortedDates[0]) : undefined;
  const endDate = sortedDates.length
    ? toIsoDateString(sortedDates[sortedDates.length - 1])
    : undefined;
  const durationDays = calcDurationDays(startDate, endDate);

  return {
    id: generateId(),
    name: draft.name,
    description: meta,
    technologies: extractMethodSkillTags([draft.method, draft.category].filter(Boolean).join(" ")),
    highlights: draft.tasks.length ? draft.tasks : [draft.method || "用户研究"].filter(Boolean),
    projectId: draft.projectId || undefined,
    startDate,
    endDate,
    durationDays: draft.status === "ongoing" ? undefined : durationDays,
    status: draft.status,
  };
}

function parseSheetRows(sheetName: string, rows: unknown[][], map: Map<string, WorkbookDraftProject>) {
  if (!rows.length) return;

  const header = rows[0].map((cell) => String(cell ?? "").trim());
  const columns = detectColumns(header);
  const status: "ongoing" | "completed" = /ongoing|进行中/i.test(sheetName) ? "ongoing" : "completed";
  let current: WorkbookDraftProject | null = null;

  for (const rawRow of rows.slice(1)) {
    const row = Array.isArray(rawRow) ? rawRow : [];
    const projectId = cellValue(row, columns.id ?? -1);
    const name = cellValue(row, columns.name ?? -1);
    const hasProjectId = Boolean(projectId && PROJECT_ID_RE.test(projectId));

    if (hasProjectId && name) {
      const key = `${projectId}::${name}`;
      const draft: WorkbookDraftProject = {
        key,
        projectId,
        name,
        industry: "",
        category: "",
        method: "",
        tasks: [],
        dates: [],
        status,
      };
      current = upsertDraft(map, draft);
    } else if (name) {
      const key = `sheet::${sheetName}::${name}`;
      if (!map.has(key)) {
        const draft: WorkbookDraftProject = {
          key,
          projectId: "",
          name,
          industry: "",
          category: "",
          method: "",
          tasks: [],
          dates: [],
          status,
        };
        current = upsertDraft(map, draft);
      } else {
        current = map.get(key)!;
      }
    }

    if (!current) continue;

    const industry = cellValue(row, columns.industry ?? -1);
    const category = cellValue(row, columns.category ?? -1);
    const method = cellValue(row, columns.method ?? -1);
    if (industry && (INDUSTRY_RE.test(industry) || industry.includes("教育"))) current.industry = industry;
    if (category && !METHOD_RE.test(category) && !PROJECT_ID_RE.test(category)) current.category = category;
    if (method && METHOD_RE.test(method)) current.method = method;

    const task = cellValue(row, columns.task ?? -1);
    if (task) addTask(current, task);
    addDates(current, row, columns);
  }
}

function mergeDraftProjects(a: WorkbookDraftProject, b: WorkbookDraftProject): WorkbookDraftProject {
  const merged: WorkbookDraftProject = {
    key: a.projectId ? a.key : b.projectId ? b.key : a.key,
    projectId: a.projectId || b.projectId,
    name: a.name,
    industry: a.industry || b.industry,
    category: a.category || b.category,
    method: a.method || b.method,
    tasks: [...a.tasks],
    dates: [...a.dates, ...b.dates],
    status: a.status === "ongoing" || b.status === "ongoing" ? "ongoing" : "completed",
  };
  for (const task of b.tasks) addTask(merged, task);
  return merged;
}

/** Parse 【个人项目管理】style workbook with multiple sheets. */
export function parseProjectsFromWorkbook(sheets: WorkbookSheet[]): Project[] {
  const map = new Map<string, WorkbookDraftProject>();

  for (const sheet of sheets) {
    parseSheetRows(sheet.name, sheet.rows, map);
  }

  const byName = new Map<string, WorkbookDraftProject>();
  for (const draft of Array.from(map.values())) {
    const nameKey = draft.name.trim();
    const existing = byName.get(nameKey);
    byName.set(nameKey, existing ? mergeDraftProjects(existing, draft) : draft);
  }

  return Array.from(byName.values())
    .sort((a, b) => {
      const aTime = a.dates[0]?.getTime() ?? 0;
      const bTime = b.dates[0]?.getTime() ?? 0;
      return aTime - bTime;
    })
    .map(finalizeWorkbookProject);
}

export function isPersonalProjectWorkbook(sheets: WorkbookSheet[]): boolean {
  if (!sheets.length) return false;
  const headerText = sheets
    .flatMap((sheet) => (sheet.rows[0] ? sheet.rows[0].map((cell) => String(cell ?? "")) : []))
    .join(" ");
  return /项目编号/.test(headerText) && /项目名/.test(headerText) && /启动日期/.test(headerText);
}
