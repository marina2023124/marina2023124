import type { ParsedJobDraft } from "../jd-parser";
import type { JobSource } from "../job-source";
import { detectJobSourceFromUrl, getJobSourceLabel } from "../job-source";
import { parseJobDescription } from "../jd-parser";
import { importLiepinJob, parseLiepinJobId } from "./liepin";
import { importXiaohongshuJob, parseXiaohongshuPositionId } from "./xiaohongshu";
import { importBossJob, parseBossJobUrl } from "./boss";

export interface ImportedJobDraft extends ParsedJobDraft {
  source: JobSource;
  sourceLabel: string;
}

async function importGenericUrl(url: string): Promise<ParsedJobDraft> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`页面抓取失败 (${res.status})，请复制 JD 文字粘贴导入`);
  }

  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 80) {
    throw new Error("该页面为动态加载，无法直接抓取。请复制岗位详情文字粘贴，或使用对应平台专用导入方式");
  }

  const parsed = parseJobDescription(`来源：${url}\n\n${text.slice(0, 12000)}`);
  return { ...parsed, url: parsed.url || url };
}

/** 从 URL 导入岗位（支持小红书招聘、猎聘、BOSS 等；企业官网尝试 HTML 抓取） */
export async function importJobFromUrl(url: string): Promise<ImportedJobDraft> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("请输入有效的 http(s) 链接");
  }

  const source = detectJobSourceFromUrl(trimmed);

  let draft: ParsedJobDraft;
  if (source === "xiaohongshu") {
    const positionId = parseXiaohongshuPositionId(trimmed);
    if (!positionId) {
      throw new Error("无法识别小红书岗位 ID，请使用类似 https://job.xiaohongshu.com/social/position/18746 的链接");
    }
    draft = await importXiaohongshuJob(trimmed, positionId);
  } else if (source === "liepin") {
    const jobId = parseLiepinJobId(trimmed);
    if (!jobId) {
      throw new Error("无法识别猎聘岗位 ID，请使用类似 https://www.liepin.com/job/1984054575.shtml 的链接");
    }
    draft = await importLiepinJob(trimmed, jobId);
  } else if (source === "boss") {
    if (!parseBossJobUrl(trimmed)) {
      throw new Error("无法识别 BOSS 岗位链接，请使用 zhipin.com/job_detail/xxx.html 格式");
    }
    draft = await importBossJob(trimmed);
  } else {
    draft = await importGenericUrl(trimmed);
  }

  return {
    ...draft,
    source,
    sourceLabel: getJobSourceLabel(source),
  };
}

export function importedDraftToText(draft: ImportedJobDraft): string {
  const lines = [`来源：${draft.url || draft.sourceLabel}`, ""];
  if (draft.title) lines.push(`岗位：${draft.title}`);
  if (draft.salary) lines.push(`薪资：${draft.salary}`);
  if (draft.location) lines.push(`地点：${draft.location}`);
  if (draft.experienceYears != null) lines.push(`经验：${draft.experienceYears}年`);
  if (draft.platformExperienceLabel) lines.push(`平台标签：${draft.platformExperienceLabel}`);
  if (draft.company) lines.push(`公司：${draft.company}`);
  if (draft.industry) lines.push(`行业：${draft.industry}`);
  lines.push(`渠道：${draft.sourceLabel}`);
  lines.push("");
  if (draft.description?.trim()) {
    lines.push(draft.description.trim());
  }
  return lines.join("\n");
}
