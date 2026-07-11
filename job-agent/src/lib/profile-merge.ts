import type { Education, Profile, Project, Skill, WorkExperience } from "./types";
import type { ParsedProfileDraft } from "./resume-parser";
import { sanitizeProfileSkills } from "./skill-tags";

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

function mergeProjects(existing: Project[], incoming: Project[]): Project[] {
  const result = [...existing];

  for (const item of incoming) {
    const index = result.findIndex((project) => project.name === item.name);
    if (index < 0) {
      result.push(item);
      continue;
    }

    const current = result[index];
    const highlights = [...current.highlights];
    for (const highlight of item.highlights) {
      if (!highlights.includes(highlight)) highlights.push(highlight);
    }

    result[index] = {
      ...current,
      description: current.description || item.description,
      technologies: Array.from(new Set([...current.technologies, ...item.technologies])),
      highlights,
    };
  }

  return result;
}

export function mergeParsedProfile(parsed: ParsedProfileDraft, base: Profile): Profile {
  return {
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
    projects: mergeProjects(base.projects, parsed.projects),
    skills: sanitizeProfileSkills(
      mergeArray(base.skills, parsed.skills, dedupeSkill)
    ),
  };
}
