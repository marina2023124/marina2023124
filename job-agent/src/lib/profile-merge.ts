import type { Education, Profile, Project, Skill, WorkExperience } from "./types";
import { normalizeProjectName } from "./weekly-report-parser";
import type { ParsedProfileDraft } from "./resume-parser";
import { sanitizeProfileSkills } from "./skill-tags";
import { calcDurationDays, maxIsoDate, minIsoDate, getProjectWorkItems, sanitizeProfileProjects, extractProjectId } from "./utils";
import { summarizeProjectWork } from "./project-work-summary";

function dedupeWork(a: WorkExperience, b: WorkExperience): boolean {
  return (
    a.company === b.company &&
    a.title === b.title &&
    a.startDate === b.startDate
  );
}

function dedupeEdu(a: Education, b: Education): boolean {
  return a.school === b.school && a.degree === b.degree;
}

function dedupeSkill(a: Skill, b: Skill): boolean {
  return a.name.toLowerCase() === b.name.toLowerCase();
}

function mergeArray<T>(existing: T[], incoming: T[], isDup: (a: T, b: T) => boolean): T[] {
  const result = [...existing];
  for (const item of incoming) {
    if (!result.some((e) => isDup(e, item))) result.push(item);
  }
  return result;
}

function mergeProjects(
  existing: Project[],
  incoming: Project[],
  workExperiences: WorkExperience[] = []
): Project[] {
  const result = [...existing];

  for (const item of incoming) {
    const index = result.findIndex((project) => {
      const currentId = project.projectId || extractProjectId(project);
      const incomingId = item.projectId || extractProjectId(item);
      if (incomingId && currentId) return currentId === incomingId;
      if (item.projectId && project.projectId) return project.projectId === item.projectId;
      return normalizeProjectName(project.name) === normalizeProjectName(item.name);
    });
    if (index < 0) {
      result.push(item);
      continue;
    }

    const current = result[index];
    let highlights: string[];
    const currentHighlights = current.highlights ?? [];
    const itemHighlights = item.highlights ?? [];
    if (!currentHighlights.length && itemHighlights.length) {
      highlights = [...itemHighlights];
    } else {
      highlights = [...currentHighlights];
      for (const highlight of itemHighlights) {
        if (!highlights.includes(highlight)) highlights.push(highlight);
      }
    }

    const startDate = minIsoDate(current.startDate, item.startDate);
    const endDate = maxIsoDate(current.endDate, item.endDate);
    const status: Project["status"] =
      current.status === "ongoing" || item.status === "ongoing" ? "ongoing" : "completed";
    const mergedProject: Project = {
      ...current,
      description: current.description || item.description,
      technologies: Array.from(new Set([...current.technologies, ...item.technologies])),
      tags: Array.from(new Set([...(current.tags ?? []), ...(item.tags ?? [])])),
      highlights,
      projectId: current.projectId || item.projectId,
      startDate,
      endDate,
      status,
      durationDays:
        status === "ongoing" ? undefined : calcDurationDays(startDate, endDate) ?? current.durationDays,
    };
    mergedProject.workSummary = summarizeProjectWork(getProjectWorkItems(mergedProject));

    result[index] = mergedProject;
  }

  return sanitizeProfileProjects(result, workExperiences);
}

export function mergeWeeklyReportProjects(
  weeklyProjects: Project[],
  base: Profile
): Profile {
  if (!weeklyProjects.length) return base;
  return {
    ...base,
    projects: sanitizeProfileProjects(
      mergeProjects(base.projects, weeklyProjects, base.workExperiences),
      base.workExperiences
    ),
  };
}

export function mergeParsedProfile(parsed: ParsedProfileDraft, base: Profile): Profile {
  const merged: Profile = {
    ...base,
    name: parsed.name?.trim() || base.name,
    email: parsed.email?.trim() || base.email,
    phone: parsed.phone?.trim() || base.phone,
    summary: parsed.summary?.trim() || base.summary,
    targetRoles:
      parsed.targetRoles && parsed.targetRoles.length > 0
        ? parsed.targetRoles
        : base.targetRoles,
    targetIndustries:
      parsed.targetIndustries && parsed.targetIndustries.length > 0
        ? parsed.targetIndustries
        : base.targetIndustries,
    preferredLocations:
      parsed.preferredLocations && parsed.preferredLocations.length > 0
        ? parsed.preferredLocations
        : base.preferredLocations,
    workExperiences: mergeArray(base.workExperiences, parsed.workExperiences, dedupeWork),
    educations: mergeArray(base.educations, parsed.educations, dedupeEdu),
    projects: mergeProjects(base.projects, parsed.projects, base.workExperiences),
    skills: sanitizeProfileSkills(
      mergeArray(base.skills, parsed.skills, dedupeSkill)
    ),
  };

  return {
    ...merged,
    projects: sanitizeProfileProjects(merged.projects, merged.workExperiences),
  };
}
