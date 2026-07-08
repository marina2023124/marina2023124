import type { JobPosting } from "./types";
import { extractJobSections, sectionsToDescription } from "./jd-sections";

/** 将结构化字段合并为完整描述（兼容匹配/导出） */
export function assembleJobDescription(job: {
  jobIntro?: string;
  responsibilities?: string[];
  requirements?: string[];
  description?: string;
}): string {
  const built = sectionsToDescription({
    jobIntro: job.jobIntro || "",
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
  });
  if (built) return built;
  return job.description?.trim() || "";
}

/** 从旧版合并 description 中尝试拆出各版块 */
export function splitJobDescription(description: string): {
  jobIntro?: string;
  responsibilities?: string[];
  requirements?: string[];
} {
  return extractJobSections(description);
}

/** 获取用于展示的结构化岗位内容（兼容旧数据） */
export function getJobSections(job: JobPosting): {
  jobIntro?: string;
  responsibilities: string[];
  requirements: string[];
} {
  const hasStructured =
    !!job.jobIntro?.trim() ||
    (job.responsibilities?.length ?? 0) > 0 ||
    (job.requirements?.length ?? 0) > 0;

  if (hasStructured) {
    const fromDescription =
      job.description && (!job.jobIntro || !(job.responsibilities?.length))
        ? extractJobSections(job.description)
        : null;

    return {
      jobIntro: job.jobIntro?.trim() || fromDescription?.jobIntro || undefined,
      responsibilities:
        job.responsibilities?.length
          ? job.responsibilities
          : fromDescription?.responsibilities || [],
      requirements:
        job.requirements?.length
          ? job.requirements
          : fromDescription?.requirements || [],
    };
  }

  if (job.description) {
    const split = extractJobSections(job.description);
    return {
      jobIntro: split.jobIntro || undefined,
      responsibilities: split.responsibilities,
      requirements: split.requirements.length ? split.requirements : job.requirements || [],
    };
  }

  return {
    jobIntro: undefined,
    responsibilities: [],
    requirements: job.requirements || [],
  };
}
