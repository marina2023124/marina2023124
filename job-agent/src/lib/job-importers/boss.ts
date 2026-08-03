import type { ParsedJobDraft } from "../jd-parser";
import { parseJobDescription } from "../jd-parser";
import {
  extractBossSalaryFromHtml,
  parseBossJobPath,
} from "../boss-page-resolver";

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
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

export function parseBossJobUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    return parseBossJobPath(parsed.pathname);
  } catch {
    const match = url.match(/\/job_detail\/([^.?#/]+)\.html/i);
    return match?.[1];
  }
}

/** 从 BOSS 岗位链接导入（移动端分享链接后可用；薪资可能因反爬不完整） */
export async function importBossJob(url: string): Promise<ParsedJobDraft> {
  const trimmed = url.trim();
  if (!parseBossJobUrl(trimmed)) {
    throw new Error("无法识别 BOSS 岗位链接，请使用 job_detail 详情页链接");
  }

  const res = await fetch(trimmed, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://www.zhipin.com/",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`BOSS 页面抓取失败 (${res.status})，请复制 JD 文字粘贴导入`);
  }

  const html = await res.text();
  if (html.length < 200) {
    throw new Error("BOSS 页面内容为空，请复制 JD 文字粘贴导入");
  }

  const salaryHint = extractBossSalaryFromHtml(html);
  const pageText = htmlToText(html);
  const parsed = parseJobDescription(
    `来源：${trimmed}\n\nBOSS直聘\n${pageText.slice(0, 15000)}`
  );

  return {
    ...parsed,
    url: trimmed,
    source: "boss",
    salary: parsed.salary || salaryHint || undefined,
  };
}
