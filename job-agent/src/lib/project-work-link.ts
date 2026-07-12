import type { WorkExperience } from "./types";
import { sanitizeWorkDate } from "./utils";

export interface ProjectWorkGroup<T extends { workExperienceId?: string; startDate?: string; endDate?: string; status?: string; name: string }> {
  workExperienceId?: string;
  label: string;
  workExperience?: WorkExperience;
  projects: T[];
}

function projectSortKey(project: { endDate?: string; startDate?: string }): string {
  return project.endDate || project.startDate || "";
}

function sortProjectsNewestFirst<T extends { endDate?: string; startDate?: string; status?: string; name: string }>(
  projects: T[]
): T[] {
  return [...projects].sort((a, b) => {
    const aOngoing = a.status === "ongoing";
    const bOngoing = b.status === "ongoing";
    if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;
    const byTime = projectSortKey(b).localeCompare(projectSortKey(a));
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name, "zh");
  });
}

/** Group projects under their affiliated work experience for hierarchical display */
export function groupProjectsByWorkExperience<
  T extends { workExperienceId?: string; startDate?: string; endDate?: string; status?: string; name: string },
>(projects: T[], workExperiences: WorkExperience[]): ProjectWorkGroup<T>[] {
  const buckets = new Map<string | undefined, T[]>();

  for (const project of projects) {
    const key = project.workExperienceId;
    const list = buckets.get(key) ?? [];
    list.push(project);
    buckets.set(key, list);
  }

  const groups: ProjectWorkGroup<T>[] = [];

  for (const exp of workExperiences) {
    const list = buckets.get(exp.id);
    if (!list?.length) continue;
    groups.push({
      workExperienceId: exp.id,
      label: formatWorkExperienceTag(exp),
      workExperience: exp,
      projects: sortProjectsNewestFirst(list),
    });
    buckets.delete(exp.id);
  }

  const orphanEntries = Array.from(buckets.entries()).filter(([, list]) => list.length > 0);
  orphanEntries.sort((a, b) => {
    const aKey = projectSortKey(a[1][0]);
    const bKey = projectSortKey(b[1][0]);
    return bKey.localeCompare(aKey);
  });

  for (const [key, list] of orphanEntries) {
    groups.push({
      workExperienceId: key,
      label: key ? getWorkExperienceLabel(key, workExperiences) ?? "其他工作" : "未关联工作",
      projects: sortProjectsNewestFirst(list),
    });
  }

  return groups;
}

function toMonthIndex(dateStr: string): number | null {
  const sanitized = sanitizeWorkDate(dateStr.slice(0, 7));
  const [yearRaw, monthRaw] = sanitized.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw || "1");
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return year * 12 + month;
}

function projectMonthIndex(project: { startDate?: string; endDate?: string }): number | null {
  const source = project.startDate || project.endDate;
  if (!source) return null;
  return toMonthIndex(source);
}

function experienceRange(exp: WorkExperience): { start: number; end: number } | null {
  const start = toMonthIndex(exp.startDate);
  if (start == null) return null;
  const end = exp.endDate ? toMonthIndex(exp.endDate) : toMonthIndex(new Date().toISOString().slice(0, 7));
  if (end == null) return null;
  return { start, end: Math.max(start, end) };
}

/** 项目启动月份是否落在某段工作经历区间内 */
export function workExperienceContainsProject(
  exp: WorkExperience,
  project: { startDate?: string; endDate?: string }
): boolean {
  const projectMonth = projectMonthIndex(project);
  if (projectMonth == null) return false;
  const range = experienceRange(exp);
  if (!range) return false;
  return projectMonth >= range.start && projectMonth <= range.end;
}

function overlapMonths(
  exp: WorkExperience,
  project: { startDate?: string; endDate?: string }
): number {
  const projectMonth = projectMonthIndex(project);
  if (projectMonth == null) return 0;
  const range = experienceRange(exp);
  if (!range) return 0;
  if (projectMonth < range.start || projectMonth > range.end) return 0;
  return 1;
}

/** 按项目时间自动匹配所属工作经历 */
export function findWorkExperienceForProject(
  project: { startDate?: string; endDate?: string },
  workExperiences: WorkExperience[]
): WorkExperience | undefined {
  if (!workExperiences.length) return undefined;

  const candidates = workExperiences
    .map((exp) => ({ exp, score: overlapMonths(exp, project) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aStart = toMonthIndex(a.exp.startDate) ?? 0;
      const bStart = toMonthIndex(b.exp.startDate) ?? 0;
      return bStart - aStart;
    });

  return candidates[0]?.exp;
}

export function formatWorkExperienceTag(exp: WorkExperience): string {
  return `${exp.company} · ${exp.title}`;
}

export function getWorkExperienceLabel(
  workExperienceId: string | undefined,
  workExperiences: WorkExperience[]
): string | undefined {
  if (!workExperienceId) return undefined;
  const exp = workExperiences.find((item) => item.id === workExperienceId);
  return exp ? formatWorkExperienceTag(exp) : undefined;
}

/** 为项目补全 workExperienceId（保留用户手动设置） */
export function linkProjectsToWorkExperiences<T extends { workExperienceId?: string; startDate?: string; endDate?: string }>(
  projects: T[],
  workExperiences: WorkExperience[]
): T[] {
  if (!workExperiences.length) return projects;

  return projects.map((project) => {
    if (project.workExperienceId) {
      const exp = workExperiences.find((item) => item.id === project.workExperienceId);
      if (exp && workExperienceContainsProject(exp, project)) return project;
      if (!project.startDate) return project;
    }

    const matched = findWorkExperienceForProject(project, workExperiences);
    if (!matched) return project;

    return {
      ...project,
      workExperienceId: matched.id,
    };
  });
}
