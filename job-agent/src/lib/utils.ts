import { summarizeProjectFromMeta, summarizeProjectWork } from "./project-work-summary";
import { linkProjectsToWorkExperiences } from "./project-work-link";
import { normalizeProjectName, normalizeTaskHighlight, isNoiseTaskHighlight, dedupeWeeklyHighlights } from "./project-name";
import type { WorkExperience } from "./types";

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-");
  return `${year}年${month ? `${month}月` : ""}`;
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const [yearRaw, monthRaw] = dateStr.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw || "1");
  if (!Number.isFinite(year) || year < 1900 || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function toMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Resume OCR/import often misreads 2024 as 2026 — correct future work start years. */
export function sanitizeWorkYear(year: number): number {
  const currentYear = getCurrentYearMonth().year;
  if (year <= currentYear) return year;
  if (year - 2 <= currentYear) return year - 2;
  if (year - 1 <= currentYear) return year - 1;
  return year;
}

export function sanitizeWorkDate(dateStr: string): string {
  const ym = parseYearMonth(dateStr);
  if (!ym) return dateStr;
  const year = sanitizeWorkYear(ym.year);
  return `${year}-${String(ym.month).padStart(2, "0")}`;
}

/** Inclusive month span: Apr 2024 through Jul 2026 = 28 months. */
export function calcMonthsBetween(start: string, end?: string): number {
  const startYm = parseYearMonth(start);
  if (!startYm) return 0;

  const endYm = end ? parseYearMonth(end) : getCurrentYearMonth();
  if (!endYm) return 0;

  const startIdx = toMonthIndex(startYm.year, startYm.month);
  const endIdx = toMonthIndex(endYm.year, endYm.month);
  if (endIdx < startIdx) return 0;

  return endIdx - startIdx + 1;
}

export function calcYearsBetween(start: string, end?: string): number {
  return Math.round((calcMonthsBetween(start, end) / 12) * 10) / 10;
}

export function isFutureYearMonth(dateStr: string): boolean {
  const ym = parseYearMonth(dateStr);
  if (!ym) return false;
  const current = getCurrentYearMonth();
  return toMonthIndex(ym.year, ym.month) > toMonthIndex(current.year, current.month);
}

export function calcTotalExperienceYears(
  experiences: { startDate: string; endDate?: string }[]
): number {
  if (experiences.length === 0) return 0;

  const intervals = experiences
    .map((exp) => {
      const startYm = parseYearMonth(sanitizeWorkDate(exp.startDate));
      if (!startYm) return null;
      const endYm = exp.endDate
        ? parseYearMonth(sanitizeWorkDate(exp.endDate))
        : getCurrentYearMonth();
      if (!endYm) return null;

      const start = toMonthIndex(startYm.year, startYm.month);
      const end = toMonthIndex(endYm.year, endYm.month);
      if (end < start) return null;
      return { start, end };
    })
    .filter((iv): iv is { start: number; end: number } => iv !== null)
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) return 0;

  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end + 1) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  let totalMonths = 0;
  for (const interval of merged) {
    totalMonths += interval.end - interval.start + 1;
  }

  return Math.round((totalMonths / 12) * 10) / 10;
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

export function parseSkillsFromText(text: string): string[] {
  const separators = /[,，、;；|\n/]+/;
  return Array.from(new Set(text.split(separators).map((s) => s.trim()).filter(Boolean)));
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const PROJECT_META_METHOD_RE = /^(定性|定量|定性\+共创|定性\+定量|共创|workshop|用户研究)$/i;

/** Task rows from import — exclude metadata duplicated in description. */
export function getProjectWorkItems(project: {
  name: string;
  description: string;
  highlights: string[];
}): string[] {
  const metaParts = new Set(
    project.description.split("·").map((part) => part.trim()).filter(Boolean)
  );
  metaParts.add(project.name.trim());

  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of project.highlights) {
    const text = raw.trim();
    if (!text || text.length < 2) continue;
    if (metaParts.has(text)) continue;
    if (PROJECT_META_METHOD_RE.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text);
  }

  if (!items.length) {
    for (const raw of project.highlights) {
      const text = raw.trim();
      if (!text || text.length < 2 || text === project.name.trim()) continue;
      if (PROJECT_META_METHOD_RE.test(text)) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(text);
    }
  }

  return items;
}

/** Parse multiline work items for project highlights. */
export function parseWorkLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•●\d、.．)\]]\s*/, ""))
    .filter((line) => line.length >= 2);
}

/** One-sentence work summary from task highlights. */
export function getProjectWorkSummary(project: {
  name: string;
  description: string;
  highlights: string[];
  workSummary?: string;
  technologies?: string[];
}): string {
  const items = getProjectWorkItems(project);
  if (items.length) return summarizeProjectWork(items);
  if (project.workSummary?.trim()) return project.workSummary.trim();
  return summarizeProjectFromMeta(project);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseExcelSerialDate(value: unknown): Date | null {
  if (value === "" || value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 20000 && value < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value).trim();
  if (!text || /无明确|当日|周[一二三四五六日天]/i.test(text)) return null;
  const match = text.match(/(\d{4})[./年-](\d{1,2})(?:[./月-](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3] || "1");
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calcDurationDays(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate || !ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    return undefined;
  }
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  if (end < start) return undefined;
  return Math.round((end - start) / 86400000) + 1;
}

export function formatProjectDuration(days?: number): string {
  if (!days || days < 1) return "";
  if (days < 30) return `${days}天`;
  const months = Math.round((days / 30) * 10) / 10;
  return months >= 12 ? `约${Math.round((days / 365) * 10) / 10}年` : `约${months}个月`;
}

export function formatProjectDateRange(project: {
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  status?: "ongoing" | "completed";
}): string {
  if (!project.startDate) return "";
  const start = formatDate(project.startDate.slice(0, 7));

  if (project.status === "ongoing") {
    const latest = project.endDate ? formatDate(project.endDate.slice(0, 7)) : "";
    return latest && latest !== start
      ? `${start} — 进行中（最近 ${latest}）`
      : `${start} — 进行中`;
  }

  const end = project.endDate ? formatDate(project.endDate.slice(0, 7)) : "";
  const duration = formatProjectDuration(
    project.durationDays ?? calcDurationDays(project.startDate, project.endDate)
  );
  const range = end ? `${start} — ${end}` : start;
  return duration ? `${range} · 周期 ${duration}` : range;
}

export function minIsoDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export function maxIsoDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function projectTimeKey(project: {
  startDate?: string;
  endDate?: string;
  status?: "ongoing" | "completed";
  projectId?: string;
  description?: string;
}): string {
  if (project.endDate) return project.endDate;
  if (project.startDate) return project.startDate;
  const id = extractProjectId(project);
  if (id && /^\d{6,7}$/.test(id)) {
    const year = 2000 + Number(id.slice(0, 2));
    const month = Number(id.slice(2, 4)) || 1;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  return "";
}

const PROJECT_ID_TOKEN_RE = /^\d{6,7}$|^proposal$/i;

/** Extract project id from field or description tail (e.g. 2406303). */
export function extractProjectId(project: {
  projectId?: string;
  description?: string;
}): string | undefined {
  const direct = project.projectId?.trim();
  if (direct && PROJECT_ID_TOKEN_RE.test(direct)) return direct;

  const parts = (project.description || "").split("·").map((part) => part.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    if (PROJECT_ID_TOKEN_RE.test(parts[i])) return parts[i];
  }
  return undefined;
}

function projectIdSortValue(project: {
  projectId?: string;
  description?: string;
}): number {
  const id = extractProjectId(project);
  if (!id) return -1;
  if (/^proposal$/i.test(id)) return 0;
  const num = Number(id);
  return Number.isFinite(num) ? num : -1;
}

/** Sort projects by time — newest first; ongoing projects pinned to top. */
export function sortProjectsByTime<T extends {
  name: string;
  startDate?: string;
  endDate?: string;
  status?: "ongoing" | "completed";
  projectId?: string;
  description?: string;
}>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const aOngoing = a.status === "ongoing";
    const bOngoing = b.status === "ongoing";
    if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;

    const aKey = projectTimeKey(a);
    const bKey = projectTimeKey(b);
    if (aKey && bKey) {
      const byTime = bKey.localeCompare(aKey);
      if (byTime !== 0) return byTime;
    } else if (aKey !== bKey) {
      return aKey ? -1 : 1;
    }

    const byId = projectIdSortValue(b) - projectIdSortValue(a);
    if (byId !== 0) return byId;

    return a.name.localeCompare(b.name, "zh");
  });
}

/** Normalize project list: fill projectId, work summary, link work + sort by time. */
export function sanitizeProfileProjects<T extends {
  name: string;
  description: string;
  highlights: string[];
  technologies?: string[];
  tags?: string[];
  startDate?: string;
  endDate?: string;
  status?: "ongoing" | "completed";
  projectId?: string;
  workSummary?: string;
  workExperienceId?: string;
}>(
  projects: T[],
  workExperiences: WorkExperience[] = []
): T[] {
  const enriched = projects.map((project) => {
    const normalized = {
      ...project,
      name: normalizeProjectName(project.name),
      description: project.description || "",
      highlights: dedupeWeeklyHighlights(
        (project.highlights ?? [])
          .map((item) => normalizeTaskHighlight(item))
          .filter((item) => item && !isNoiseTaskHighlight(item))
      ),
      technologies: project.technologies ?? [],
      tags: project.tags ?? [],
      projectId: project.projectId || extractProjectId(project),
    };
    const summary = getProjectWorkSummary(normalized);
    return {
      ...normalized,
      workSummary: summary || project.workSummary,
    };
  });
  const linked = linkProjectsToWorkExperiences(enriched, workExperiences);
  return sortProjectsByTime(linked);
}
