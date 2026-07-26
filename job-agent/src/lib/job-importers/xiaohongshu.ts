import type { ParsedJobDraft } from "../jd-parser";
import { extractJobSections, sectionsToDescription } from "../jd-sections";
import { xhsWorkExperienceToLabel } from "../job-experience";

const API_ROOT = "https://job.xiaohongshu.com";

interface XhsPositionDetail {
  positionId?: number;
  positionName?: string;
  positionType?: string;
  duty?: string;
  qualification?: string;
  workplace?: string;
  workExperience?: string;
  education?: string | null;
  recruitType?: string;
  jobProjectName?: string;
}

interface XhsApiResponse {
  statusCode?: number;
  alertMsg?: string;
  data?: XhsPositionDetail;
}

function extractExperienceYearsFromText(...texts: Array<string | undefined>): number | undefined {
  for (const text of texts) {
    if (!text?.trim()) continue;
    const range = text.match(/(\d+)\s*[-~至到]\s*(\d+)\s*年/);
    if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
    const single = text.match(/(\d+)\s*年(?:及以上|以上|\+)?(?:工作)?经验/);
    if (single) return Number(single[1]);
  }
  return undefined;
}

export function parseXiaohongshuPositionId(url: string): string | undefined {
  const m = url.match(/(?:social|campus)\/position\/(\d+)/i) || url.match(/positionId=(\d+)/i);
  return m?.[1];
}

function splitSectionText(text: string, kind: "responsibilities" | "requirements"): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const header = kind === "responsibilities" ? "岗位职责" : "任职要求";
  const sections = extractJobSections(`${header}\n${trimmed.replace(/^【[^】]+】\s*/gm, "").trim()}`);
  const items = kind === "responsibilities" ? sections.responsibilities : sections.requirements;
  if (items.length >= 2) return items;

  const numbered = trimmed
    .split(/\n(?=\d+[、.．)\]]\s)/)
    .map((part) => part.replace(/^\d+[、.．)\]]\s*/, "").trim())
    .filter((part) => part.length >= 4);

  if (numbered.length >= 2) return numbered;

  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.replace(/^[-•]\s*/, "").trim())
    .filter((part) => part.length >= 8);
}

function buildIntro(detail: XhsPositionDetail): string | undefined {
  const parts = [
    detail.positionType ? `方向：${detail.positionType}` : "",
    detail.jobProjectName ? `项目：${detail.jobProjectName}` : "",
    detail.education ? `学历：${detail.education}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}

function resolveExperienceYears(
  detail: XhsPositionDetail,
  duty: string,
  qualification: string
): number | undefined {
  const fromText = extractExperienceYearsFromText(qualification, duty);
  if (fromText != null) return fromText;
  // 小红书 API 的 workExperience 是平台筛选项，JD 正文未写时不写入年限
  return undefined;
}

export async function importXiaohongshuJob(url: string, positionId: string): Promise<ParsedJobDraft> {
  const channel = /\/campus\//i.test(url) ? "campus" : "social";
  const referer = `${API_ROOT}/${channel}/position/${positionId}`;

  const res = await fetch(
    `${API_ROOT}/websiterecruit/position/queryPositionDetail?positionId=${encodeURIComponent(positionId)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    throw new Error(`小红书招聘接口请求失败 (${res.status})`);
  }

  const body = (await res.json()) as XhsApiResponse;
  if (body.statusCode !== 200 || !body.data) {
    throw new Error(body.alertMsg || "未能获取小红书岗位详情");
  }

  const detail = body.data;
  const duty = (detail.duty ?? "").trim();
  const qualification = (detail.qualification ?? "").trim();
  const responsibilities = splitSectionText(duty, "responsibilities");
  const requirements = splitSectionText(qualification, "requirements");
  const jobIntro = buildIntro(detail);
  const experienceYears = resolveExperienceYears(detail, duty, qualification);
  const platformExperienceLabel = xhsWorkExperienceToLabel(detail.workExperience);

  const sections = {
    jobIntro: jobIntro ?? "",
    responsibilities,
    requirements,
  };

  return {
    title: detail.positionName?.trim() || "用户研究",
    company: "小红书",
    location: detail.workplace?.split(/[，,]/)[0]?.trim(),
    workAddress: detail.workplace?.replace(/[，,]/g, " / "),
    experienceYears,
    platformExperienceLabel,
    industry: "互联网",
    url: url.trim(),
    jobIntro,
    responsibilities,
    requirements,
    description: sectionsToDescription(sections) || [duty, qualification].filter(Boolean).join("\n\n"),
    preferredSkills: [],
  };
}
