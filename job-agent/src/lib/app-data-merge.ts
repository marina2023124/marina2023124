import type { AppData, ChatMessage, JobPosting, Profile } from "./types";
import { mergeProjects } from "./profile-merge";
import { sanitizeProfileSkills } from "./skill-tags";
import { sanitizeProfileProjects } from "./utils";

function dedupeWork(a: Profile["workExperiences"][0], b: Profile["workExperiences"][0]): boolean {
  return a.company === b.company && a.title === b.title && a.startDate === b.startDate;
}

function dedupeEdu(a: Profile["educations"][0], b: Profile["educations"][0]): boolean {
  return a.school === b.school && a.degree === b.degree;
}

function dedupeSkill(a: Profile["skills"][0], b: Profile["skills"][0]): boolean {
  return a.name.toLowerCase() === b.name.toLowerCase();
}

function mergeArray<T>(existing: T[], incoming: T[], isDup: (a: T, b: T) => boolean): T[] {
  const result = [...existing];
  for (const item of incoming) {
    if (!result.some((entry) => isDup(entry, item))) result.push(item);
  }
  return result;
}

function mergeProfiles(base: Profile, incoming: Profile): Profile {
  const workExperiences = mergeArray(base.workExperiences, incoming.workExperiences, dedupeWork);
  const projects = mergeProjects(base.projects, incoming.projects, workExperiences);
  const merged: Profile = {
    name: base.name || incoming.name,
    email: base.email || incoming.email,
    phone: base.phone || incoming.phone,
    summary: base.summary || incoming.summary,
    targetRoles: Array.from(new Set([...base.targetRoles, ...incoming.targetRoles])),
    targetIndustries: Array.from(new Set([...base.targetIndustries, ...incoming.targetIndustries])),
    preferredLocations: Array.from(new Set([...base.preferredLocations, ...incoming.preferredLocations])),
    expectedSalary: base.expectedSalary ?? incoming.expectedSalary,
    workExperiences,
    educations: mergeArray(base.educations, incoming.educations, dedupeEdu),
    projects,
    skills: sanitizeProfileSkills(mergeArray(base.skills, incoming.skills, dedupeSkill)),
  };

  return {
    ...merged,
    projects: sanitizeProfileProjects(merged.projects, merged.workExperiences),
  };
}

function mergeJobs(base: JobPosting[], incoming: JobPosting[]): JobPosting[] {
  const byId = new Map<string, JobPosting>();
  for (const job of [...base, ...incoming]) {
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, job);
      continue;
    }
    const existingTime = Date.parse(existing.createdAt || "0");
    const incomingTime = Date.parse(job.createdAt || "0");
    byId.set(job.id, incomingTime >= existingTime ? job : existing);
  }
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0")
  );
}

function mergeChatHistory(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...base, ...incoming]) {
    byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(a.timestamp || "0") - Date.parse(b.timestamp || "0")
  );
}

/** 合并网页与小程序两份 AppData（以 primary 为主，secondary 补缺） */
export function mergeAppData(primary: AppData, secondary: AppData): AppData {
  return {
    profile: mergeProfiles(primary.profile, secondary.profile),
    jobs: mergeJobs(primary.jobs, secondary.jobs),
    chatHistory: mergeChatHistory(primary.chatHistory, secondary.chatHistory),
  };
}

function countAppDataItems(data: AppData): number {
  return (
    data.jobs.length +
    data.profile.workExperiences.length +
    data.profile.projects.length +
    data.profile.skills.length +
    data.chatHistory.length
  );
}

/** 绑定合并：优先保留内容更丰富的一份作为主数据 */
export function mergeAppDataForLink(webData: AppData, wechatData: AppData): AppData {
  const webCount = countAppDataItems(webData);
  const wechatCount = countAppDataItems(wechatData);
  if (webCount >= wechatCount) {
    return mergeAppData(webData, wechatData);
  }
  return mergeAppData(wechatData, webData);
}
