import type { ParsedJobDraft } from "../jd-parser";
import { sectionsToDescription } from "../jd-sections";
import { extractExperienceYearsFromText } from "../job-experience";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function parseLiepinJobId(url: string): string | undefined {
  const m = url.match(/\/job\/(\d+)\.shtml/i);
  return m?.[1];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractHtmlSection(html: string, className: string, untilClass?: string): string {
  const startRe = new RegExp(`class="${className}"[^>]*>`, "i");
  const startMatch = startRe.exec(html);
  if (!startMatch) return "";

  const slice = html.slice(startMatch.index + startMatch[0].length);
  if (!untilClass) return stripHtml(slice);

  const endRe = new RegExp(`class="${untilClass}"`, "i");
  const endMatch = endRe.exec(slice);
  const end = endMatch ? endMatch.index : slice.length;
  return stripHtml(slice.slice(0, end));
}

function normalizeSalary(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/k/gi, "K");
}

function splitNumberedItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const numbered = trimmed
    .split(/\n?(?=\d+[、.．)\]]\s*)/)
    .map((part) => part.replace(/^\d+[、.．)\]]\s*/, "").trim())
    .filter((part) => part.length >= 4);

  if (numbered.length >= 2) return numbered;

  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.replace(/^[-•]\s*/, "").trim())
    .filter((part) => part.length >= 8);
}

function parseMetaDescription(html: string): {
  title?: string;
  company?: string;
  salary?: string;
  platformExperienceLabel?: string;
  education?: string;
} {
  const match = html.match(/name="description"\s+content="([^"]+)"/i);
  if (!match?.[1]) return {};

  const desc = decodeHtmlEntities(match[1]);
  const title = desc.match(/招聘(.+?)岗位/)?.[1]?.trim();
  const company = desc.match(/^(.+?)(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|天津|重庆)招聘/)?.[1]?.trim();
  const salary = desc.match(/薪资([^,]+)/)?.[1]?.trim();
  const platformExperienceLabel = desc.match(/(\d+\s*[-~至到]\s*\d+\s*年|\d+\s*年及以上|\d+\s*年以上)/)?.[1]?.trim();
  const education = desc.match(/(统招)?(?:本科|大专|硕士|博士)/)?.[0]?.trim();

  return {
    title,
    company,
    salary: salary ? normalizeSalary(salary) : undefined,
    platformExperienceLabel,
    education,
  };
}

function parseTitleTag(html: string): string | undefined {
  const match = html.match(/<title>【[^】]*?\s(.+?)招聘】/i);
  return match?.[1]?.trim();
}

function parseHeaderInfo(html: string): {
  title?: string;
  location?: string;
  salary?: string;
} {
  const header = extractHtmlSection(html, "job-detail-header-box", "job-intro-container");
  if (!header) return {};

  const lines = header
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines.find((line) => line.length >= 2 && !/^\d/.test(line) && !/k/i.test(line) && !line.includes("【"));
  const location = header.match(/【\s*([^】]+)\s*】/)?.[1]?.trim();
  const salary = header.match(/(\d+\s*[-~至到]\s*\d+\s*[Kk](?:\s*·\s*\d+\s*薪)?|\d+\s*[Kk](?:\s*·\s*\d+\s*薪)?|面议)/)?.[1];

  return {
    title: title || undefined,
    location,
    salary: salary ? normalizeSalary(salary) : undefined,
  };
}

function parseCompanyInfo(html: string): { company?: string; industry?: string } {
  const box = extractHtmlSection(html, "job-detail-company-box", "recommend-company-container");
  const lines = box
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const company = lines.find(
    (line) =>
      line.length >= 2 &&
      line.length <= 40 &&
      !/融资|人以上|互联网|查看|登录/.test(line)
  );

  const industry =
    lines.find((line) => /互联网|金融|教育|医疗|制造|消费|软件|游戏|广告|咨询/.test(line)) ||
    (lines.includes("互联网") ? "互联网" : undefined);

  return { company, industry: typeof industry === "string" ? industry : undefined };
}

function parseIntroSections(html: string): {
  jobIntro?: string;
  responsibilities: string[];
  requirements: string[];
  extraIntro?: string;
} {
  const introBlock = extractHtmlSection(html, "job-intro-container", "job-detail-company-box");
  if (!introBlock) {
    return { responsibilities: [], requirements: [] };
  }

  const cleaned = introBlock
    .replace(/^职位介绍\s*/i, "")
    .replace(/猎聘温馨提示[\s\S]*/i, "")
    .replace(/猜你喜欢[\s\S]*/i, "")
    .trim();

  const descMatch = cleaned.match(/职位描述[：:]\s*([\s\S]*?)(?=职位要求[：:]|$)/i);
  const reqMatch = cleaned.match(
    /职位要求[：:]\s*([\s\S]*?)(?=其他信息|公司简介|语言要求|行业要求|$)/i
  );
  const extraMatch = cleaned.match(/其他信息([\s\S]*?)(?=公司简介|$)/i);
  const companyIntroMatch = cleaned.match(/公司简介\s*([\s\S]*?)$/i);

  const responsibilities = splitNumberedItems(descMatch?.[1]?.trim() ?? "");
  const requirements = splitNumberedItems(reqMatch?.[1]?.trim() ?? "");

  const introParts = [
    extraMatch?.[1]?.trim(),
    companyIntroMatch?.[1]?.trim(),
  ].filter(Boolean);

  return {
    responsibilities,
    requirements,
    extraIntro: introParts.length ? introParts.join("\n\n") : undefined,
  };
}

function buildJobIntro(meta: ReturnType<typeof parseMetaDescription>, extraIntro?: string): string | undefined {
  const parts = [
    meta.education ? `学历：${meta.education}` : "",
    meta.platformExperienceLabel ? `平台标签：${meta.platformExperienceLabel}` : "",
    extraIntro ?? "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}

export function parseLiepinHtml(url: string, html: string): ParsedJobDraft {
  const meta = parseMetaDescription(html);
  const header = parseHeaderInfo(html);
  const companyInfo = parseCompanyInfo(html);
  const intro = parseIntroSections(html);

  const title = parseTitleTag(html) || header.title || meta.title || "";
  const company = companyInfo.company || meta.company || "";
  const salary = meta.salary || header.salary;
  const location = header.location?.split("-")[0]?.trim() || header.location;
  const workAddress = header.location;

  const dutyText = intro.responsibilities.join("\n");
  const qualificationText = intro.requirements.join("\n");
  const experienceYears = extractExperienceYearsFromText(qualificationText, dutyText);

  const jobIntro = buildJobIntro(meta, intro.extraIntro);
  const sections = {
    jobIntro: jobIntro ?? "",
    responsibilities: intro.responsibilities,
    requirements: intro.requirements,
  };

  const fallbackDescription = extractHtmlSection(html, "job-intro-container", "job-detail-company-box")
    .replace(/猎聘温馨提示[\s\S]*/i, "")
    .trim();

  return {
    title,
    company,
    location,
    workAddress,
    salary,
    experienceYears,
    platformExperienceLabel: meta.platformExperienceLabel,
    industry: companyInfo.industry || "互联网",
    url: url.trim(),
    jobIntro,
    responsibilities: intro.responsibilities,
    requirements: intro.requirements,
    description:
      sectionsToDescription(sections) ||
      fallbackDescription ||
      [dutyText, qualificationText].filter(Boolean).join("\n\n"),
    preferredSkills: [],
  };
}

export async function importLiepinJob(url: string, jobId: string): Promise<ParsedJobDraft> {
  const res = await fetch(`https://www.liepin.com/job/${encodeURIComponent(jobId)}.shtml`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.liepin.com/",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`猎聘页面请求失败 (${res.status})`);
  }

  const html = await res.text();
  if (html.length < 500 || !html.includes("job-intro-container")) {
    throw new Error("未能获取猎聘岗位详情，请复制 JD 文字粘贴导入");
  }

  return parseLiepinHtml(url, html);
}
