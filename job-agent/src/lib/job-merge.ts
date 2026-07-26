import type { JobPosting } from "./types";
import type { ParsedJobDraft } from "./jd-parser";
import { assembleJobDescription } from "./job-sections";
import { getJobSourceLabel, resolveJobSource } from "./job-source";

const UNKNOWN_TITLE = "未知岗位";
const UNKNOWN_COMPANY = "未知公司";

export function isUnknownTitle(title?: string): boolean {
  return !title || title === UNKNOWN_TITLE;
}

export function isUnknownCompany(company?: string): boolean {
  return !company || company === UNKNOWN_COMPANY;
}

/** 编辑岗位时还原完整粘贴文本（含薪资、地址等头部） */
export function jobToEditableText(job: JobPosting): string {
  const lines: string[] = [];

  if (job.url) lines.push(`来源：${job.url}`, "");
  if (job.title && !isUnknownTitle(job.title)) lines.push(`岗位：${job.title}`);
  if (job.salary) lines.push(`薪资：${job.salary}`);
  if (job.location) lines.push(`地点：${job.location}`);
  if (job.experienceYears != null && job.experienceYears >= 0) {
    lines.push(`经验：${job.experienceYears}年`);
  }
  if (job.industry) lines.push(`行业：${job.industry}`);
  if (job.source) lines.push(`渠道：${getJobSourceLabel(job.source)}`);
  if (job.company && !isUnknownCompany(job.company)) lines.push(`公司：${job.company}`);
  if (job.workAddress) lines.push(`工作地址：${job.workAddress}`);

  if (lines.length > 0) lines.push("");

  const structured = assembleJobDescription(job);
  if (structured) {
    lines.push(structured);
  } else if (job.description?.trim()) {
    lines.push(job.description.trim());
  }

  return lines.join("\n").trim();
}

export function mergeParsedJob(
  parsed: ParsedJobDraft,
  prev: JobPosting | null,
  initial?: JobPosting
): Partial<JobPosting> {
  const base = prev || initial;

  return {
    title: isUnknownTitle(parsed.title) ? base?.title || "" : parsed.title,
    company: isUnknownCompany(parsed.company) ? base?.company || "" : parsed.company,
    location: parsed.location ?? base?.location,
    workAddress: parsed.workAddress ?? base?.workAddress,
    salary: parsed.salary ?? base?.salary,
    experienceYears: parsed.experienceYears ?? base?.experienceYears,
    industry: parsed.industry ?? base?.industry,
    source: parsed.source ?? base?.source ?? resolveJobSource({ url: parsed.url ?? base?.url }),
    interestRating: base?.interestRating,
    url: parsed.url ?? base?.url,
    jobIntro: parsed.jobIntro ?? base?.jobIntro,
    responsibilities:
      parsed.responsibilities && parsed.responsibilities.length > 0
        ? parsed.responsibilities
        : base?.responsibilities || [],
    description: parsed.description || base?.description || "",
    requirements:
      parsed.requirements.length > 0 ? parsed.requirements : base?.requirements || [],
    preferredSkills:
      parsed.preferredSkills.length > 0
        ? parsed.preferredSkills
        : base?.preferredSkills || [],
  };
}
