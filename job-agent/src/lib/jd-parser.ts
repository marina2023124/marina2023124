import { extractSkillsFromJobDescription } from "./matching";

export interface ParsedJobDraft {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  experienceYears?: number;
  url?: string;
  description: string;
  requirements: string[];
  preferredSkills: string[];
}

const CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都", "南京", "武汉", "西安",
  "苏州", "天津", "重庆", "长沙", "郑州", "青岛", "厦门", "合肥", "东莞",
  "佛山", "无锡", "宁波", "福州", "济南", "大连", "沈阳", "哈尔滨", "昆明",
  "南宁", "贵阳", "海口", "石家庄", "太原", "南昌", "长春", "兰州",
];

const TITLE_KEYWORDS = [
  "工程师", "经理", "总监", "专员", "主管", "开发", "架构师", "设计师",
  "产品", "运营", "分析", "顾问", "实习生", "负责人", "专家", "研究员",
  "Engineer", "Manager", "Developer", "Designer", "Analyst", "Lead", "Intern",
];

const TITLE_PATTERNS = [
  /(?:招聘|诚聘|急聘|岗位[：:]\s*|职位[：:]\s*|Job[：:]\s*)([^\n，,。]{2,30})/i,
  /([^\n]{2,25}(?:工程师|经理|总监|专员|主管|架构师|设计师|Developer|Engineer|Manager))/i,
];

const COMPANY_PATTERNS = [
  /(?:公司[：:]\s*|企业[：:]\s*|雇主[：:]\s*)([^\n，,。]{2,30})/,
  /^([^\n·\-—|]{2,20}(?:公司|集团|科技|网络|信息|有限|Inc|Ltd|Corp))/m,
  /([^\n]{2,20})\s*[·\-—|]\s*[^\n]{2,20}(?:工程师|经理|开发)/,
];

const SALARY_PATTERNS = [
  /(?:薪资|薪酬|月薪|工资|salary)[：:\s]*([^\n，,。]{3,25})/i,
  /(\d+\s*[-~至到]\s*\d+\s*[Kk万wW])/,
  /(\d+[Kk]\s*[-~至到]\s*\d+[Kk])/,
  /(\d+[-~至]\d+万(?:\/月)?)/,
  /(\d+-\d+K(?:\/月)?)/i,
];

const EXP_PATTERNS = [
  /(?:经验|工作年限)[：:\s]*(\d+)\s*年/i,
  /(\d+)\s*[-+~]?\s*年(?:及以上|以上|\+)?(?:工作)?经验/,
  /(?:经验要求|年限)[：:\s]*(\d+)/,
];

const LOCATION_PATTERNS = [
  /(?:工作地点|地点|城市|location)[：:\s]*([^\n，,。]{2,20})/i,
  /(远程|居家办公|Hybrid|hybrid)/i,
  ...CITIES.map((c) => new RegExp(`(${c}(?:市|区)?)`)),
];

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const REQ_SECTION_HEADERS = [
  "任职要求", "岗位要求", "职位要求", "任职资格", "基本要求",
  "必备条件", "Qualifications", "Requirements", "我们需要你",
  "职位描述", "岗位职责", "工作内容",
];

/** BOSS直聘常见格式检测 */
export function isBossZhipinContent(text: string): boolean {
  return (
    text.includes("zhipin.com") ||
    text.includes("BOSS直聘") ||
    /(\d+-\d+K|·[\u4e00-\u9fff]{2,4}·\d)/.test(text)
  );
}

/** 解析 BOSS直聘复制/书签提取的文本 */
function parseBossFormat(text: string): Partial<ParsedJobDraft> | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const result: Partial<ParsedJobDraft> = {};
  const url = text.match(/https?:\/\/[^\s]*zhipin\.com[^\s]*/)?.[0];
  if (url) result.url = url;

  // 第一行通常是岗位名
  const titleLine = lines.find((l) =>
    TITLE_KEYWORDS.some((k) => l.includes(k)) && l.length <= 40 && !/^\d+-\d+K/.test(l)
  ) || lines[0];
  if (titleLine && !titleLine.startsWith("来源")) result.title = titleLine;

  // BOSS 特征行：15-25K·北京·3-5年·本科
  const metaLine = lines.find((l) => /\d+-\d+K|K以上|面议/.test(l) && l.includes("·"));
  if (metaLine) {
    const parts = metaLine.split("·").map((p) => p.trim());
    for (const part of parts) {
      if (/^\d+-\d+K|\d+K以上|面议|\d+-\d+万/.test(part)) result.salary = part;
      else if (CITIES.some((c) => part.includes(c)) || part.includes("远程")) result.location = part;
      else if (/(\d+)-(\d+)年/.test(part)) {
        const m = part.match(/(\d+)-(\d+)年/);
        if (m) result.experienceYears = Math.round((Number(m[1]) + Number(m[2])) / 2);
      } else if (/(\d+)年/.test(part)) {
        const m = part.match(/(\d+)年/);
        if (m) result.experienceYears = Number(m[1]);
      } else if (/经验不限|应届/.test(part)) result.experienceYears = 0;
    }
  }

  // 公司名通常在 meta 行下一行
  const metaIdx = metaLine ? lines.indexOf(metaLine) : -1;
  if (metaIdx >= 0 && lines[metaIdx + 1]) {
    const companyCandidate = lines[metaIdx + 1];
    if (
      companyCandidate !== titleLine &&
      companyCandidate.length <= 30 &&
      !companyCandidate.startsWith("职位") &&
      !companyCandidate.startsWith("来源")
    ) {
      result.company = companyCandidate;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function extractTitle(text: string): string {
  for (const p of TITLE_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]?.trim()) {
      const t = m[1].trim().replace(/^[【\[]|[】\]]$/g, "");
      if (t.length >= 2 && t.length <= 30) return t;
    }
  }
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (TITLE_KEYWORDS.some((k) => line.includes(k)) && line.length <= 35) {
      return line.replace(/^[【\[]|[】\]]$/g, "");
    }
  }
  const firstLine = text.split("\n").find((l) => l.trim().length > 2)?.trim();
  return firstLine?.slice(0, 30) || "未知岗位";
}

function extractCompany(text: string, title: string): string {
  for (const p of COMPANY_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]?.trim()) {
      const c = m[1].trim();
      if (c !== title && c.length >= 2) return c;
    }
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (
      (line.includes("公司") || line.includes("集团") || line.includes("科技")) &&
      line.length <= 25 &&
      !line.includes("招聘")
    ) {
      return line.replace(/(?:公司|企业)[：:]\s*/, "");
    }
  }
  const pipeMatch = text.match(/^(.+?)\s*[·|｜]\s*.+/m);
  if (pipeMatch?.[1] && pipeMatch[1].length <= 20) return pipeMatch[1].trim();
  return "未知公司";
}

function extractLocation(text: string): string | undefined {
  for (const p of LOCATION_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function extractSalary(text: string): string | undefined {
  return firstMatch(text, SALARY_PATTERNS);
}

function extractExperienceYears(text: string): number | undefined {
  if (/应届|不限经验|无经验要求|经验不限/.test(text)) return 0;
  for (const p of EXP_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) return Number(m[1]);
  }
  return undefined;
}

function extractUrl(text: string): string | undefined {
  const urls = text.match(URL_PATTERN);
  return urls?.[0];
}

function extractRequirements(text: string): string[] {
  const reqs: string[] = [];

  for (const header of REQ_SECTION_HEADERS) {
    const idx = text.indexOf(header);
    if (idx >= 0) {
      const section = text.slice(idx + header.length, idx + header.length + 800);
      const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const cleaned = line
          .replace(/^[\d+.\)、•\-*·]\s*/, "")
          .replace(/^[：:]\s*/, "")
          .trim();
        if (
          cleaned.length >= 4 &&
          cleaned.length <= 120 &&
          !REQ_SECTION_HEADERS.some((h) => cleaned.startsWith(h))
        ) {
          reqs.push(cleaned);
        }
        if (reqs.length >= 12) break;
      }
      if (reqs.length > 0) break;
    }
  }

  if (reqs.length === 0) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (/^[\d+.\)、•\-*·]/.test(trimmed)) {
        const cleaned = trimmed.replace(/^[\d+.\)、•\-*·]\s*/, "").trim();
        if (cleaned.length >= 4 && cleaned.length <= 120) reqs.push(cleaned);
      }
    }
  }

  return reqs.slice(0, 15);
}

export function parseJobDescription(rawText: string): ParsedJobDraft {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return {
      title: "",
      company: "",
      description: "",
      requirements: [],
      preferredSkills: [],
    };
  }

  const bossPartial = isBossZhipinContent(text) ? parseBossFormat(text) : null;

  const title = bossPartial?.title || extractTitle(text);
  const company = bossPartial?.company || extractCompany(text, title);
  const location = bossPartial?.location || extractLocation(text);
  const salary = bossPartial?.salary || extractSalary(text);
  const experienceYears = bossPartial?.experienceYears ?? extractExperienceYears(text);
  const url = bossPartial?.url || extractUrl(text);
  const requirements = extractRequirements(text);
  const preferredSkills = extractSkillsFromJobDescription(text);

  return {
    title,
    company,
    location,
    salary,
    experienceYears,
    url,
    description: text,
    requirements,
    preferredSkills,
  };
}
