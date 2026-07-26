export type JobSource =
  | "boss"
  | "xiaohongshu"
  | "lagou"
  | "liepin"
  | "maimai"
  | "company_site"
  | "manual"
  | "other";

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  boss: "BOSS直聘",
  xiaohongshu: "小红书招聘",
  lagou: "拉勾网",
  liepin: "猎聘",
  maimai: "脉脉",
  company_site: "企业官网",
  manual: "手动录入",
  other: "其他渠道",
};

const SOURCE_URL_RULES: Array<{ source: JobSource; pattern: RegExp }> = [
  { source: "boss", pattern: /(?:zhipin\.com|bosszhipin)/i },
  { source: "xiaohongshu", pattern: /(?:job\.xiaohongshu\.com|xiaohongshu\.com\/.*(?:job|recruit|position))/i },
  { source: "lagou", pattern: /lagou\.com/i },
  { source: "liepin", pattern: /liepin\.com/i },
  { source: "maimai", pattern: /maimai\.cn/i },
];

/** 从 URL 识别岗位来源渠道 */
export function detectJobSourceFromUrl(url?: string): JobSource {
  if (!url?.trim()) return "manual";
  try {
    const normalized = url.trim();
    for (const rule of SOURCE_URL_RULES) {
      if (rule.pattern.test(normalized)) return rule.source;
    }
    return "company_site";
  } catch {
    return "other";
  }
}

/** 从粘贴文本中的「来源：」行识别渠道 */
export function detectJobSourceFromText(text: string): JobSource | undefined {
  const sourceLine = text.match(/^来源[：:]\s*(.+)$/m);
  if (!sourceLine?.[1]) return undefined;
  const value = sourceLine[1].trim();
  if (/^https?:\/\//i.test(value)) return detectJobSourceFromUrl(value);
  if (/boss|直聘|zhipin/i.test(value)) return "boss";
  if (/小红书|xiaohongshu/i.test(value)) return "xiaohongshu";
  if (/拉勾|lagou/i.test(value)) return "lagou";
  if (/猎聘|liepin/i.test(value)) return "liepin";
  if (/脉脉|maimai/i.test(value)) return "maimai";
  if (/官网|企业/i.test(value)) return "company_site";
  return "other";
}

export function getJobSourceLabel(source?: JobSource): string {
  if (!source) return JOB_SOURCE_LABELS.manual;
  return JOB_SOURCE_LABELS[source] ?? JOB_SOURCE_LABELS.other;
}

export function resolveJobSource(job: { source?: JobSource; url?: string }, fallbackText?: string): JobSource {
  if (job.source) return job.source;
  if (job.url) return detectJobSourceFromUrl(job.url);
  if (fallbackText) {
    const fromText = detectJobSourceFromText(fallbackText);
    if (fromText) return fromText;
  }
  return "manual";
}

export function extractSourceUrl(text: string): string | undefined {
  const m = text.match(/^来源[：:]\s*(https?:\/\/\S+)/m);
  return m?.[1]?.trim();
}
