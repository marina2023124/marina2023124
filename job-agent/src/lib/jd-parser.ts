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

/** BOSS 页面底部/侧边推荐区，识别前需截断 */
const BOSS_CUT_MARKERS = [
  "更多职位",
  "看过该职位的人还看了",
  "精选职位",
  "竞争力分析",
  "BOSS 安全提示",
  "BOSS直聘严禁",
  "城市招聘",
  "热门职位",
  "推荐公司",
  "热门企业",
  "页面更新时间",
  "查看完整个人竞争力",
  "个人综合排名",
];

/** 不能作为岗位名的行 */
const BOSS_NOISE_LINES = new Set([
  "更多职位", "公司基本信息", "职位描述", "查看全部职位", "微信扫码分享",
  "举报", "公司介绍", "工作地址", "工商信息", "查看全部", "查看地图",
  "首页", "搜索", "来源",
]);

const TITLE_PATTERNS = [
  /(?:招聘|诚聘|急聘|岗位[：:]\s*|职位[：:]\s*|Job[：:]\s*)([^\n，,。]{2,30})/i,
  /([^\n]{2,25}(?:工程师|经理|总监|专员|主管|架构师|设计师|Developer|Engineer|Manager))/i,
];

const SALARY_PATTERNS = [
  /(?:薪资|薪酬|月薪|工资|salary)[：:\s]*([^\n，,。]{3,25})/i,
  /(\d+\s*[-~至到]\s*\d+\s*[Kk万wW·薪])/,
  /(\d+[Kk]\s*[-~至到]\s*\d+[Kk])/,
  /(\d+[-~至]\d+万(?:\/月)?)/,
  /(\d+-\d+K(?:·\d+薪)?)/i,
];

const EXP_PATTERNS = [
  /(?:经验|工作年限)[：:\s]*(\d+)\s*年/i,
  /(\d+)\s*[-+~]?\s*年(?:及以上|以上|\+)?(?:工作)?经验/,
  /(?:经验要求|年限)[：:\s]*(\d+)/,
];

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/** BOSS直聘常见格式检测 */
export function isBossZhipinContent(text: string): boolean {
  return (
    text.includes("zhipin.com") ||
    text.includes("BOSS直聘") ||
    text.includes("公司基本信息") ||
    text.includes("职位描述")
  );
}

/** 截断 BOSS 页面中「更多职位」等推荐区域 */
export function sanitizeBossContent(text: string): string {
  let cutIndex = text.length;

  for (const marker of BOSS_CUT_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx >= 0 && idx < cutIndex) cutIndex = idx;
  }

  let result = text.slice(0, cutIndex).trim();

  // 截断页脚面包屑：首页北京招聘·...
  const footerIdx = result.search(/\n首页[\u4e00-\u9fff·]+招聘/);
  if (footerIdx >= 0) result = result.slice(0, footerIdx).trim();

  return result;
}

function isNoiseLine(line: string): boolean {
  if (!line || line.length < 2) return true;
  if (BOSS_NOISE_LINES.has(line)) return true;
  if (/^\d+-\d+K/.test(line)) return true;
  if (/^(A|B|C|D|E|Pre-)?轮$/.test(line)) return true;
  if (/^\d+-\d+人$/.test(line)) return true;
  if (/^(互联网|查看|点击|刚刚活跃|HR|HRBP)$/.test(line)) return true;
  if (/^[\u4e00-\u9fff]{1,4}招聘$/.test(line)) return true;
  return false;
}

/** 从 BOSS 页脚面包屑提取：数说故事商业数据分析招聘 */
function extractBossTitleFromBreadcrumb(fullText: string, company: string): string | undefined {
  if (company) {
    const re = new RegExp(`${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\u4e00-\\u9fffA-Za-z\\/]+?)招聘`);
    const m = fullText.match(re);
    if (m?.[1] && m[1].length >= 2 && m[1].length <= 20) return m[1];
  }
  const m = fullText.match(/[·\s]([\u4e00-\u9fffA-Za-z\/]{2,20}?)招聘(?:\s|$|·)/);
  if (m?.[1] && !["北京", "上海", "广州", "深圳", "首页"].includes(m[1])) return m[1];
  return undefined;
}

function extractBossCompany(cleanText: string): string | undefined {
  const m = cleanText.match(/公司基本信息\s*\n\s*([^\n]+)/);
  if (m?.[1] && !isNoiseLine(m[1])) return m[1].trim();

  const m2 = cleanText.match(/公司名称\s*\n\s*([^\n]+)/);
  if (m2?.[1]) return m2[1].trim();

  return undefined;
}

function extractBossLocation(cleanText: string): string | undefined {
  const m = cleanText.match(/工作地址\s*\n\s*([^\n]+)/);
  if (m?.[1]) return m[1].trim();

  for (const city of CITIES) {
    if (cleanText.includes(city)) {
      const line = cleanText.split("\n").find((l) => l.includes(city) && l.length <= 30);
      if (line && !line.includes("招聘")) return line.trim();
    }
  }
  return undefined;
}

function extractBossSalary(cleanText: string): string | undefined {
  // 薪资应在「职位描述」之前的主岗位区域，不在推荐区
  const mainPart = cleanText.split("职位描述")[0] || cleanText;
  for (const p of SALARY_PATTERNS) {
    const m = mainPart.match(p);
    if (m?.[1]) return m[1].trim();
    if (m?.[0] && /K|万/.test(m[0])) return m[0].trim();
  }
  return undefined;
}

function extractBossSections(cleanText: string): { description: string; requirements: string[] } {
  const parts: string[] = [];
  const requirements: string[] = [];

  const descMatch = cleanText.match(/职位描述\s*\n([\s\S]*?)(?=任职条件|岗位职责|工作地址|公司介绍|$)/);
  if (descMatch?.[1]) parts.push(descMatch[1].trim());

  const dutyMatch = cleanText.match(/岗位职责[：:]?\s*\n([\s\S]*?)(?=任职条件|工作地址|公司介绍|$)/);
  if (dutyMatch?.[1]) parts.push("【岗位职责】\n" + dutyMatch[1].trim());

  const reqMatch = cleanText.match(/任职条件[：:]?\s*\n([\s\S]*?)(?=工作地址|公司介绍|陈女士|竞争力|$)/);
  if (reqMatch?.[1]) {
    const block = reqMatch[1].trim();
    parts.push("【任职条件】\n" + block);
    for (const line of block.split("\n")) {
      const cleaned = line.trim().replace(/^\d+[、.．)]\s*/, "").replace(/^[：:]\s*/, "");
      if (cleaned.length >= 6 && cleaned.length <= 150 && !isNoiseLine(cleaned)) {
        requirements.push(cleaned);
      }
    }
  }

  return {
    description: parts.join("\n\n").trim() || cleanText,
    requirements: requirements.slice(0, 12),
  };
}

/** 解析 BOSS直聘复制/书签提取的文本 */
function parseBossFormat(fullText: string): Partial<ParsedJobDraft> | null {
  const cleanText = sanitizeBossContent(fullText);
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const result: Partial<ParsedJobDraft> = {};
  const url = fullText.match(/https?:\/\/[^\s]*zhipin\.com[^\s]*/)?.[0];
  if (url) result.url = url.split("?")[0] + (url.includes("?") ? "?" + url.split("?")[1].split("&").slice(0, 1).join("&") : "");

  result.company = extractBossCompany(cleanText);
  result.title = extractBossTitleFromBreadcrumb(fullText, result.company || "");

  // 主岗位 meta 行：15-25K·北京·3-5年·本科（须在「职位描述」之前）
  const mainPart = cleanText.split("职位描述")[0] || "";
  const metaLine = mainPart.split("\n").find((l) => /\d+-\d+K|K以上|面议/.test(l) && l.includes("·"));
  if (metaLine) {
    for (const part of metaLine.split("·").map((p) => p.trim())) {
      if (/^\d+-\d+K|\d+K以上|面议|\d+-\d+万/.test(part)) result.salary = part;
      else if (CITIES.some((c) => part.includes(c))) result.location = part;
      else if (/(\d+)-(\d+)年/.test(part)) {
        const m = part.match(/(\d+)-(\d+)年/);
        if (m) result.experienceYears = Math.round((Number(m[1]) + Number(m[2])) / 2);
      }
    }
  }

  if (!result.location) result.location = extractBossLocation(cleanText);
  if (!result.salary) result.salary = extractBossSalary(cleanText);

  // 标题：面包屑优先，其次「职位描述」前含关键词的行（排除职责条目）
  if (!result.title) {
    const beforeDesc = cleanText.split("职位描述")[0] || cleanText;
    const titleLine = beforeDesc.split("\n").find(
      (l) =>
        !/^\d+[、.]/.test(l) &&
        TITLE_KEYWORDS.some((k) => l.includes(k)) &&
        l.length <= 35 &&
        !isNoiseLine(l)
    );
    if (titleLine) result.title = titleLine;
  }

  const sections = extractBossSections(cleanText);
  result.description = sections.description;
  result.requirements = sections.requirements;

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
    if (isNoiseLine(line) || /^\d+[、.]/.test(line)) continue;
    if (TITLE_KEYWORDS.some((k) => line.includes(k)) && line.length <= 35) {
      return line.replace(/^[【\[]|[】\]]$/g, "");
    }
  }
  return "未知岗位";
}

function extractCompany(text: string, title: string): string {
  const m = text.match(/(?:公司[：:]\s*|企业[：:]\s*)([^\n，,。]{2,30})/);
  if (m?.[1]?.trim() && m[1] !== title) return m[1].trim();
  return "未知公司";
}

function extractLocation(text: string): string | undefined {
  for (const city of CITIES) {
    const line = text.split("\n").find((l) => l.includes(city) && l.length <= 30);
    if (line) return line.trim();
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
  const reqMatch = text.match(/任职条件[：:]?\s*\n([\s\S]*?)(?=工作地址|公司介绍|$)/);
  if (reqMatch?.[1]) {
    const reqs: string[] = [];
    for (const line of reqMatch[1].split("\n")) {
      const cleaned = line.trim().replace(/^\d+[、.．)]\s*/, "").replace(/^[：:]\s*/, "");
      if (cleaned.length >= 6 && cleaned.length <= 150 && !isNoiseLine(cleaned)) {
        reqs.push(cleaned);
      }
    }
    if (reqs.length > 0) return reqs.slice(0, 12);
  }
  return [];
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

  const isBoss = isBossZhipinContent(text);
  const bossPartial = isBoss ? parseBossFormat(text) : null;
  const cleanText = isBoss ? sanitizeBossContent(text) : text;

  const title = bossPartial?.title || extractTitle(cleanText);
  const company = bossPartial?.company || extractCompany(cleanText, title);
  const location = bossPartial?.location || extractLocation(cleanText);
  const salary = bossPartial?.salary || extractSalary(cleanText);
  const experienceYears = bossPartial?.experienceYears ?? extractExperienceYears(cleanText);
  const url = bossPartial?.url || extractUrl(text);
  const requirements = bossPartial?.requirements?.length
    ? bossPartial.requirements
    : extractRequirements(cleanText);
  const description = bossPartial?.description || cleanText;
  const preferredSkills = extractSkillsFromJobDescription(description);

  return {
    title,
    company,
    location,
    salary,
    experienceYears,
    url,
    description,
    requirements,
    preferredSkills,
  };
}
