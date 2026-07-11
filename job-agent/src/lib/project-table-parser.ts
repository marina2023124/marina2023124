import type { Project } from "./types";
import { generateId } from "./utils";
import { extractMethodSkillTags } from "./skill-tags";

const PROJECT_ID_RE = /^\d{6,7}$|^proposal$|^培训\s*workshop$/i;
const METHOD_RE = /定性|定量|共创|workshop|案头|培训/i;

function parseRowCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.includes("\t")) {
    return trimmed.split("\t").map((c) => c.trim());
  }

  if (trimmed.includes("|")) {
    const cells = trimmed.split("|").map((c) => c.trim());
    if (cells.length && cells[0] === "") cells.shift();
    if (cells.length && cells[cells.length - 1] === "") cells.pop();
    return cells;
  }

  return [];
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.includes("|") || t.includes("\t") || /\b\d{6,7}\b/.test(t);
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c) || c === "");
}

function isSeparatorLine(line: string): boolean {
  const t = line.trim();
  return t.includes("---") && (t.includes("|") || t.includes("\t"));
}

function findProjectIdIndex(cells: string[]): number {
  return cells.findIndex((c) => PROJECT_ID_RE.test(c.trim()));
}

function isHeaderRow(cells: string[]): boolean {
  const text = cells.join(" ");
  return /项目编号/.test(text) && /项目名/.test(text);
}

function detectColumnMap(headerCells: string[]): Partial<Record<"industry" | "category" | "method" | "id" | "name" | "task", number>> {
  const map: Partial<Record<"industry" | "category" | "method" | "id" | "name" | "task", number>> = {};
  headerCells.forEach((cell, i) => {
    if (/^行业$/.test(cell) || (cell.includes("行业") && !cell.includes("项目"))) map.industry = i;
    if (/^品类$/.test(cell) || cell === "品类") map.category = i;
    if (/项目编号|编号/.test(cell)) map.id = i;
    if (/项目名/.test(cell)) map.name = i;
    if (/^任务$/.test(cell) || cell === "任务") map.task = i;
    if (/定性|定量|方法/.test(cell) && map.method === undefined) map.method = i;
  });
  return map;
}

function firstMeaningfulCell(cells: string[]): string | null {
  for (const c of cells) {
    const t = c.trim();
    if (t.length >= 2 && !/^-+$/.test(t) && !PROJECT_ID_RE.test(t)) return t;
  }
  return null;
}

function isIndustryWord(cell: string): boolean {
  return /^(教育|食品|互联网|宠物|保健品|服饰|文旅|电器|母婴)/.test(cell);
}

interface DraftProject {
  key: string;
  industry: string;
  category: string;
  method: string;
  projectId: string;
  name: string;
  tasks: string[];
}

function addTask(project: DraftProject, task: string) {
  const t = task.trim();
  if (!t || t.length < 2) return;
  if (t === project.name) return;
  if (project.tasks.includes(t)) return;
  project.tasks.push(t);
}

function finalizeProject(draft: DraftProject): Project {
  const meta = [draft.industry, draft.category, draft.method, draft.projectId]
    .filter(Boolean)
    .join(" · ");
  const description = meta || "";
  const highlights = draft.tasks.slice(0, 15);
  // 技能仅从行业/方法字段提取，不扫描任务明细（避免 Spring concept、Go 等误判）
  const technologies = extractMethodSkillTags(
    [draft.method, draft.category].filter(Boolean).join(" ")
  );

  return {
    id: generateId(),
    name: draft.name,
    description,
    technologies,
    highlights: highlights.length ? highlights : [draft.method || "用户研究"].filter(Boolean),
  };
}

function upsertProject(projects: DraftProject[], draft: DraftProject): DraftProject {
  const existing = projects.find((p) => p.key === draft.key);
  if (existing) {
    for (const t of draft.tasks) addTask(existing, t);
    return existing;
  }
  projects.push(draft);
  return draft;
}

function createProjectFromCells(
  cells: string[],
  idIdx: number,
  columnMap: ReturnType<typeof detectColumnMap> | null
): DraftProject | null {
  const id = cells[idIdx]?.trim();
  if (!id || !PROJECT_ID_RE.test(id)) return null;

  const nameIdx = columnMap?.name ?? idIdx + 1;
  const name = cells[nameIdx]?.trim() || cells[idIdx + 1]?.trim() || "";
  if (!name || name.length < 2) return null;

  const industry =
    columnMap?.industry !== undefined
      ? cells[columnMap.industry]?.trim() || ""
      : cells[0]?.trim() || "";
  const category =
    columnMap?.category !== undefined
      ? cells[columnMap.category]?.trim() || ""
      : cells[1]?.trim() || "";
  const method =
    columnMap?.method !== undefined
      ? cells[columnMap.method]?.trim() || ""
      : cells[idIdx - 1]?.trim() || "";

  return {
    key: `${id}::${name}`,
    industry: isIndustryWord(industry) ? industry : "",
    category:
      category && !METHOD_RE.test(category) && !PROJECT_ID_RE.test(category) ? category : "",
    method: METHOD_RE.test(method) ? method : "",
    projectId: id,
    name,
    tasks: [],
  };
}

function parseTableRows(lines: string[]): DraftProject[] {
  const projects: DraftProject[] = [];
  let current: DraftProject | null = null;
  let columnMap: ReturnType<typeof detectColumnMap> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!isTableLine(line) || isSeparatorLine(line)) continue;

    const cells = parseRowCells(line);
    if (!cells.length || isSeparatorRow(cells)) continue;

    if (isHeaderRow(cells)) {
      columnMap = detectColumnMap(cells);
      current = null;
      continue;
    }

    const idIdx = columnMap?.id ?? findProjectIdIndex(cells);
    const hasProjectId =
      idIdx >= 0 && idIdx < cells.length && PROJECT_ID_RE.test(cells[idIdx]?.trim() || "");

    if (hasProjectId) {
      const draft = createProjectFromCells(cells, idIdx, columnMap);
      if (!draft) continue;

      current = upsertProject(projects, draft);

      const taskIdx = columnMap?.task;
      if (taskIdx !== undefined) {
        const headerTask = cells[taskIdx]?.trim();
        if (headerTask) addTask(current, headerTask);
      } else {
        const tailTask = cells.slice(idIdx + 2).find((c) => c.trim().length >= 2);
        if (tailTask) addTask(current, tailTask);
      }
      continue;
    }

    if (!current) continue;

    const task = firstMeaningfulCell(cells);
    if (task) addTask(current, task);
  }

  return projects;
}

/** Fallback: scan lines for embedded project ids when table structure is irregular. */
function parseLooseProjectLines(lines: string[]): DraftProject[] {
  const projects: DraftProject[] = [];
  let current: DraftProject | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 8) continue;

    const idMatch = line.match(/(?:^|[|\t\s])(\d{6,7}|proposal)(?:[|\t\s])/i);
    if (idMatch) {
      const id = idMatch[1];
      const idPos = line.indexOf(id);
      const after = line.slice(idPos + id.length).split(/[|\t]/).map((s) => s.trim()).filter(Boolean);
      const before = line.slice(0, idPos).split(/[|\t]/).map((s) => s.trim()).filter(Boolean);
      const name = after[0] || "";
      if (name.length >= 2) {
        const draft: DraftProject = {
          key: `${id}::${name}`,
          industry: before.find(isIndustryWord) || "",
          category: "",
          method: before.find((c) => METHOD_RE.test(c)) || "",
          projectId: id,
          name,
          tasks: [],
        };
        current = upsertProject(projects, draft);
        if (after[1]) addTask(current, after[1]);
      }
      continue;
    }

    if (!current) continue;
    const task = line.replace(/^[|\t\s]+/, "").split(/[|\t]/)[0]?.trim();
    if (task && task.length >= 2 && !PROJECT_ID_RE.test(task) && !isIndustryWord(task)) {
      addTask(current, task);
    }
  }

  return projects;
}

/** Parse project task tables (Markdown | or Excel TSV paste). */
export function parseProjectsFromMarkdownTables(text: string): Project[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const tableLines = lines.filter((l) => isTableLine(l.trim()));

  const draftMap = new Map<string, DraftProject>();

  for (const d of parseTableRows(tableLines)) {
    const existing = draftMap.get(d.key);
    if (existing) {
      for (const t of d.tasks) addTask(existing, t);
    } else {
      draftMap.set(d.key, d);
    }
  }

  for (const d of parseLooseProjectLines(lines)) {
    const existing = draftMap.get(d.key);
    if (existing) {
      for (const t of d.tasks) addTask(existing, t);
    } else {
      draftMap.set(d.key, d);
    }
  }

  return Array.from(draftMap.values()).map(finalizeProject);
}

export function hasProjectTableFormat(text: string): boolean {
  return /项目编号|项目名|\d{6,7}/.test(text);
}

export function countLikelyProjectRows(text: string): number {
  const matches = text.match(/\b\d{6,7}\b/g);
  return matches ? new Set(matches).size : 0;
}
