import type { JobPosting } from "./types";

/** 将结构化字段合并为完整描述（兼容匹配/导出） */
export function assembleJobDescription(job: {
  jobIntro?: string;
  responsibilities?: string[];
  requirements?: string[];
  description?: string;
}): string {
  if (job.description?.trim()) return job.description.trim();

  const parts: string[] = [];
  if (job.jobIntro?.trim()) {
    parts.push(`【职位描述】\n${job.jobIntro.trim()}`);
  }
  if (job.responsibilities?.length) {
    parts.push(
      `【岗位职责】\n${job.responsibilities.map((r, i) => `${i + 1}、${r}`).join("\n")}`
    );
  }
  if (job.requirements?.length) {
    parts.push(
      `【任职条件】\n${job.requirements.map((r, i) => `${i + 1}、${r}`).join("\n")}`
    );
  }
  return parts.join("\n\n");
}

/** 从旧版合并 description 中尝试拆出各版块 */
export function splitJobDescription(description: string): {
  jobIntro?: string;
  responsibilities?: string[];
  requirements?: string[];
} {
  const result: {
    jobIntro?: string;
    responsibilities?: string[];
    requirements?: string[];
  } = {};

  const introMatch = description.match(/【职位描述】\s*\n([\s\S]*?)(?=【|$)/);
  if (introMatch?.[1]) result.jobIntro = introMatch[1].trim();

  const dutyMatch = description.match(/【岗位职责】\s*\n([\s\S]*?)(?=【|$)/);
  if (dutyMatch?.[1]) {
    result.responsibilities = parseNumberedBlock(dutyMatch[1]);
  }

  const reqMatch = description.match(/【任职条件】\s*\n([\s\S]*?)(?=【|$)/);
  if (reqMatch?.[1]) {
    result.requirements = parseNumberedBlock(reqMatch[1]);
  }

  if (!result.jobIntro && !result.responsibilities?.length) {
    const plainIntro = description.match(/职位描述\s*\n([\s\S]*?)(?=岗位职责|任职条件|$)/);
    if (plainIntro?.[1]) result.jobIntro = plainIntro[1].trim();

    const plainDuty = description.match(/岗位职责[：:]?\s*\n([\s\S]*?)(?=任职条件|工作地址|$)/);
    if (plainDuty?.[1]) result.responsibilities = parseNumberedBlock(plainDuty[1]);
  }

  return result;
}

function parseNumberedBlock(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const cleaned = line.trim().replace(/^\d+[、.．)]\s*/, "").replace(/^[：:]\s*/, "");
    if (cleaned.length >= 4) items.push(cleaned);
  }
  return items;
}

/** 获取用于展示的结构化岗位内容（兼容旧数据） */
export function getJobSections(job: JobPosting): {
  jobIntro?: string;
  responsibilities: string[];
  requirements: string[];
} {
  let jobIntro = job.jobIntro;
  let responsibilities = job.responsibilities || [];
  let requirements = job.requirements || [];

  if (!jobIntro && !responsibilities.length && job.description) {
    const split = splitJobDescription(job.description);
    jobIntro = split.jobIntro;
    if (!responsibilities.length && split.responsibilities?.length) {
      responsibilities = split.responsibilities;
    }
    if (!requirements.length && split.requirements?.length) {
      requirements = split.requirements;
    }
  }

  if (!jobIntro && job.description && !responsibilities.length && !jobIntro) {
    jobIntro = job.description;
  }

  return { jobIntro, responsibilities, requirements };
}
