import type { Project } from "./types";
import { generateId } from "./utils";
import { extractSkillTagsFromText } from "./skill-tags";

const PROJECT_ID_RE = /^\d{6,7}$|^proposal$/i;
const METHOD_RE = /定性|定量|共创|workshop|案头|培训/i;

function parseTableCells(line: string): string[] {
  if (!line.includes("|")) return [];
  const cells = line.split("|").map((c) => c.trim());
  if (cells.length && cells[0] === "") cells.shift();
  if (cells.length && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c) || c === "");
}

function isSeparatorLine(line: string): boolean {
  const t = line.trim();
  return t.includes("---") && t.includes("|");
}

function findProjectIdIndex(cells: string[]): number {
  return cells.findIndex((c) => PROJECT_ID_RE.test(c.trim()));
}

function detectColumnMap(headerCells: string[]): Partial<Record<"industry" | "category" | "method" | "id" | "name" | "task", number>> {
  const map: Partial<Record<"industry" | "category" | "method" | "id" | "name" | "task", number>> = {};
  headerCells.forEach((cell, i) => {
    if (/行业/.test(cell)) map.industry = i;
    if (/品类/.test(cell)) map.category = i;
    if (/项目编号|编号/.test(cell)) map.id = i;
    if (/项目名/.test(cell)) map.name = i;
    if (/任务/.test(cell)) map.task = i;
    if (/定性|定量|方法|研究/.test(cell) && map.method === undefined) map.method = i;
  });
  return map;
}

function firstMeaningfulCell(cells: string[]): string | null {
  for (const c of cells) {
    const t = c.trim();
    if (t.length >= 2 && !/^-+$/.test(t)) return t;
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
  if (project.tasks.includes(t)) return;
  project.tasks.push(t);
}

function finalizeProject(draft: DraftProject): Project {
  const meta = [draft.industry, draft.category, draft.method, draft.projectId]
    .filter(Boolean)
    .join(" · ");
  const description = meta ? `${meta}` : "";
  const highlights = draft.tasks.slice(0, 12);
  const body = [description, ...highlights].join("\n");

  return {
    id: generateId(),
    name: draft.name,
    description,
    technologies: extractSkillTagsFromText(body),
    highlights: highlights.length ? highlights : [draft.method || "用户研究"].filter(Boolean),
  };
}

function parseTableRows(lines: string[]): DraftProject[] {
  const projects: DraftProject[] = [];
  let current: DraftProject | null = null;
  let columnMap: ReturnType<typeof detectColumnMap> | null = null;
  let headerlessMode = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.includes("|") || isSeparatorLine(line)) continue;

    const cells = parseTableCells(line);
    if (!cells.length || isSeparatorRow(cells)) continue;

    const headerLike = cells.some((c) => /项目名|项目编号|^行业$|^品类$|^任务$/.test(c));
    if (headerLike && cells.some((c) => /项目/.test(c))) {
      columnMap = detectColumnMap(cells);
      headerlessMode = false;
      current = null;
      continue;
    }

    const idIdx = columnMap?.id ?? findProjectIdIndex(cells);
    const hasProjectId = idIdx >= 0 && idIdx < cells.length && PROJECT_ID_RE.test(cells[idIdx]?.trim() || "");

    if (hasProjectId) {
      const id = cells[idIdx].trim();
      const nameIdx = columnMap?.name ?? idIdx + 1;
      const name = cells[nameIdx]?.trim() || cells[idIdx + 1]?.trim() || "";
      if (!name || name.length < 2) continue;

      const industry = columnMap?.industry !== undefined ? cells[columnMap.industry]?.trim() || "" : cells[0]?.trim() || "";
      const category = columnMap?.category !== undefined ? cells[columnMap.category]?.trim() || "" : cells[1]?.trim() || "";
      const method =
        columnMap?.method !== undefined
          ? cells[columnMap.method]?.trim() || ""
          : cells[idIdx - 1]?.trim() || "";

      const key = `${id}::${name}`;
      const existing = projects.find((p) => p.key === key);
      if (existing) {
        current = existing;
      } else {
        current = {
          key,
          industry: isIndustryWord(industry) ? industry : "",
          category: category && !METHOD_RE.test(category) && !PROJECT_ID_RE.test(category) ? category : "",
          method: METHOD_RE.test(method) ? method : "",
          projectId: id,
          name,
          tasks: [],
        };
        projects.push(current);
      }

      const taskIdx = columnMap?.task ?? cells.length - 1;
      const headerTask = cells[taskIdx]?.trim();
      if (headerTask && headerTask !== name && headerTask.length >= 2) {
        addTask(current, headerTask);
      }
      continue;
    }

    if (!current) {
      // No header table: try first row as project if it contains id
      const idx = findProjectIdIndex(cells);
      if (idx >= 0) {
        headerlessMode = true;
        const id = cells[idx].trim();
        const name = cells[idx + 1]?.trim() || "";
        if (!name) continue;
        current = {
          key: `${id}::${name}`,
          industry: isIndustryWord(cells[0] || "") ? cells[0] : "",
          category: cells[1] || "",
          method: METHOD_RE.test(cells[idx - 1] || "") ? cells[idx - 1] : "",
          projectId: id,
          name,
          tasks: [],
        };
        projects.push(current);
        const maybeTask = cells[idx + 2] || cells[cells.length - 1];
        if (maybeTask && maybeTask !== name) addTask(current, maybeTask);
      }
      continue;
    }

    const task = firstMeaningfulCell(cells);
    if (task && task !== current.name && !PROJECT_ID_RE.test(task)) {
      addTask(current, task);
    }
  }

  if (headerlessMode && projects.length === 0) {
    // fallback handled above
  }

  return projects;
}

/** Parse markdown tables with columns like 行业|品类|项目编号|项目名|任务 */
export function parseProjectsFromMarkdownTables(text: string): Project[] {
  if (!text.includes("|")) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const tableLines = lines.filter((l) => l.includes("|"));
  if (tableLines.length < 2) return [];

  const drafts = parseTableRows(tableLines);
  return drafts.map(finalizeProject);
}

export function hasProjectTableFormat(text: string): boolean {
  if (!text.includes("|")) return false;
  return /项目名|项目编号|\d{6,7}/.test(text);
}
