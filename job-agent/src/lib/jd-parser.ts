import { extractSkillsFromJobDescription } from "./matching";
import { extractJobSections, sectionsToDescription } from "./jd-sections";

export interface ParsedJobDraft {
  title: string;
  company: string;
  location?: string;
  workAddress?: string;
  salary?: string;
  experienceYears?: number;
  url?: string;
  jobIntro?: string;
  responsibilities?: string[];
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

/** BOSS 常见：11-20K·14薪、15-25K·13薪 */
const BOSS_SALARY_RE =
  /(\d+\s*[-~至到]\s*\d+\s*[Kk](?:\s*·\s*\d+\s*薪)?|\d+\s*[Kk]\s*以上|面议|\d+\s*[-~至到]\s*\d+\s*万(?:\s*\/\s*月)?)/;

const SALARY_PATTERNS = [
  BOSS_SALARY_RE,
  /(?:薪资|薪酬|月薪|工资|salary)[：:\s]*([^\n，,。]{3,25})/i,
  /(\d+[Kk]\s*[-~至到]\s*\d+[Kk](?:·\d+薪)?)/,
  /(\d+[-~至]\d+万(?:\/月)?)/,
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
    text.includes("职位描述") ||
    text.includes("工作地址") ||
    (/岗位职责/.test(text) && /任职条件|任职要求/.test(text)) ||
    (/^岗位[：:]/m.test(text) && /^薪资[：:]/m.test(text))
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

/** 职位描述区的技能标签，勿当作岗位名 */
function looksLikeSkillTag(line: string): boolean {
  return (
    line.includes("/") &&
    line.length <= 30 &&
    !/(师|经理|专员|主管|总监|工程师|顾问|负责人|研究员)/.test(line)
  );
}

function parseExperienceText(text: string): number | undefined {
  if (/应届|不限|无经验/.test(text)) return 0;
  const range = text.match(/(\d+)\s*[-~至]\s*(\d+)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = text.match(/(\d+)/);
  if (single) return Number(single[1]);
  return undefined;
}

/** 书签 API 输出的结构化字段：岗位：/薪资：/地点： 等 */
function parseStructuredBossFields(text: string): Partial<ParsedJobDraft> {
  const result: Partial<ParsedJobDraft> = {};
  for (const line of text.split("\n").map((l) => l.trim())) {
    const m = line.match(/^(岗位|薪资|地点|经验|学历|公司|工作地址)[：:]\s*(.+)$/);
    if (!m) continue;
    const val = m[2].trim();
    switch (m[1]) {
      case "岗位":
        result.title = val;
        break;
      case "薪资":
        result.salary = normalizeSalary(val);
        break;
      case "地点":
        result.location = val;
        break;
      case "工作地址":
        result.workAddress = val;
        break;
      case "经验":
        result.experienceYears = parseExperienceText(val);
        break;
      case "公司":
        result.company = val;
        break;
    }
  }
  return result;
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

function extractBossWorkAddress(cleanText: string): string | undefined {
  const m = cleanText.match(/工作地址\s*\n\s*([^\n]+)/);
  if (!m?.[1]) return undefined;
  return m[1].trim().replace(/点击查看地图.*$/, "").trim();
}

function extractCityFromAddress(address: string): string | undefined {
  const m = address.match(
    /(北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|苏州|天津|重庆)(?:市)?([\u4e00-\u9fff]{1,6}区)?/
  );
  if (!m) return undefined;
  return `${m[1]}${m[2] || ""}`;
}

function extractBossLocation(cleanText: string, workAddress?: string): string | undefined {
  if (workAddress) {
    const city = extractCityFromAddress(workAddress);
    if (city) return city;
  }

  for (const city of CITIES) {
    if (cleanText.includes(city)) {
      const line = cleanText.split("\n").find((l) => l.includes(city) && l.length <= 30);
      if (line && !line.includes("招聘") && !line.includes("地址")) return line.trim();
    }
  }
  return undefined;
}

function normalizeSalary(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/·/g, "·");
}

function extractBossSalary(cleanText: string): string | undefined {
  // 薪资应在「职位描述」之前的主岗位区域，不在推荐区
  const mainPart = cleanText.split("职位描述")[0] || cleanText;
  for (const line of mainPart.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(BOSS_SALARY_RE);
    if (m?.[1]) return normalizeSalary(m[1]);
  }
  for (const p of SALARY_PATTERNS) {
    const m = mainPart.match(p);
    if (m?.[1]) return normalizeSalary(m[1]);
  }
  return undefined;
}

/** 解析 BOSS 页头：标题/薪资/城市/经验可能各占一行 */
function parseBossHeader(mainPart: string): Partial<ParsedJobDraft> {
  const result: Partial<ParsedJobDraft> = {};
  const lines = mainPart.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(岗位|薪资|地点|经验|学历|公司|来源)[：:]/.test(line)) continue;

    const salaryOnly = line.match(/^(\d+\s*[-~至到]\s*\d+\s*[Kk])(?:\s*·\s*(\d+\s*薪))?$/i);
    if (salaryOnly) {
      if (!result.salary) {
        result.salary = normalizeSalary(
          salaryOnly[2] ? `${salaryOnly[1]}·${salaryOnly[2]}` : salaryOnly[1]
        );
      }
      continue;
    }

    const salaryMatch = line.match(BOSS_SALARY_RE);
    if (salaryMatch?.[1] && line.length <= 20) {
      if (!result.salary) result.salary = normalizeSalary(salaryMatch[1]);
      continue;
    }

    const expRange = line.match(/^(\d+)\s*[-~至]\s*(\d+)\s*年$/);
    if (expRange) {
      if (result.experienceYears === undefined) {
        result.experienceYears = Math.round((Number(expRange[1]) + Number(expRange[2])) / 2);
      }
      continue;
    }

    if (CITIES.includes(line)) {
      if (!result.location) result.location = line;
      continue;
    }

    if (
      !result.title &&
      !/^\d+[、.]/.test(line) &&
      TITLE_KEYWORDS.some((k) => line.includes(k)) &&
      line.length <= 35 &&
      !isNoiseLine(line) &&
      !looksLikeSkillTag(line)
    ) {
      result.title = line;
    }
  }

  return result;
}

function applyBossMetaLine(metaLine: string, result: Partial<ParsedJobDraft>): void {
  const parts = metaLine.split("·").map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (/^\d+-\d+K$/i.test(part) && i + 1 < parts.length && /^\d+薪$/.test(parts[i + 1])) {
      result.salary = normalizeSalary(`${part}·${parts[i + 1]}`);
      i++;
      continue;
    }

    const salaryMatch = part.match(BOSS_SALARY_RE);
    if (salaryMatch?.[1]) {
      result.salary = normalizeSalary(salaryMatch[1]);
      continue;
    }

    if (CITIES.some((c) => part === c || part.startsWith(c))) {
      result.location = part;
      continue;
    }

    const expRange = part.match(/(\d+)\s*[-~至]\s*(\d+)\s*年/);
    if (expRange) {
      result.experienceYears = Math.round((Number(expRange[1]) + Number(expRange[2])) / 2);
    }
  }
}

function extractBossSections(cleanText: string): {
  jobIntro: string;
  responsibilities: string[];
  requirements: string[];
  description: string;
} {
  const sections = extractJobSections(cleanText);
  return {
    ...sections,
    description: sectionsToDescription(sections) || cleanText,
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

  Object.assign(result, parseStructuredBossFields(fullText));

  result.company = result.company || extractBossCompany(cleanText);

  const mainPart = cleanText.split("职位描述")[0] || "";
  const header = parseBossHeader(mainPart);
  if (!result.title && header.title) result.title = header.title;
  if (!result.salary && header.salary) result.salary = header.salary;
  if (!result.location && header.location) result.location = header.location;
  if (result.experienceYears === undefined && header.experienceYears !== undefined) {
    result.experienceYears = header.experienceYears;
  }

  // 合并 meta 行：15-25K·北京·3-5年·本科 或 11-20K·14薪
  const metaLine = mainPart.split("\n").find((l) => /\d+-\d+K|K以上|面议/.test(l) && l.includes("·"));
  if (metaLine && !result.salary) applyBossMetaLine(metaLine, result);
  else if (metaLine && result.salary && !result.salary.includes("薪")) {
    applyBossMetaLine(metaLine, result);
  }

  result.title = result.title || extractBossTitleFromBreadcrumb(fullText, result.company || "");

  if (!result.location) result.location = extractBossLocation(cleanText, result.workAddress);
  if (!result.workAddress) result.workAddress = extractBossWorkAddress(cleanText);
  if (!result.location && result.workAddress) {
    result.location = extractCityFromAddress(result.workAddress);
  }
  if (!result.salary) result.salary = extractBossSalary(cleanText);

  // 标题：面包屑优先，其次「职位描述」前含关键词的行（排除职责条目）
  if (!result.title) {
    const titleLine = mainPart.split("\n").find(
      (l) =>
        !/^\d+[、.]/.test(l) &&
        TITLE_KEYWORDS.some((k) => l.includes(k)) &&
        l.length <= 35 &&
        !isNoiseLine(l) &&
        !looksLikeSkillTag(l)
    );
    if (titleLine) result.title = titleLine;
  }

  const sections = extractBossSections(cleanText);
  result.jobIntro = sections.jobIntro || undefined;
  result.responsibilities = sections.responsibilities.slice(0, 15);
  result.description = sections.description;
  result.requirements = sections.requirements.slice(0, 12);

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
    if (isNoiseLine(line) || /^\d+[、.]/.test(line) || looksLikeSkillTag(line)) continue;
    if (TITLE_KEYWORDS.some((k) => line.includes(k)) && line.length <= 35) {
      return line.replace(/^[【\[]|[】\]]$/g, "");
    }
  }
  return "未知岗位";
}

/** BOSS 岗位名只在「职位描述」之前查找，避免误取技能标签 */
function extractBossTitle(text: string): string {
  const beforeDesc = text.split("职位描述")[0] || text;
  for (const line of beforeDesc.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (isNoiseLine(line) || /^\d+[、.]/.test(line) || looksLikeSkillTag(line)) continue;
    if (/^(岗位|薪资|地点|经验|学历|公司)[：:]/.test(line)) continue;
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

function extractWorkAddress(text: string): string | undefined {
  const m = text.match(/工作地址[：:\s]*\n?\s*([^\n]+)/);
  if (m?.[1]) return m[1].trim().replace(/点击查看地图.*$/, "").trim();
  return undefined;
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

  const title =
    bossPartial?.title ||
    (isBoss ? extractBossTitle(cleanText) : extractTitle(cleanText));
  const company = bossPartial?.company || extractCompany(cleanText, title);
  const location = bossPartial?.location || extractLocation(cleanText);
  const workAddress =
    bossPartial?.workAddress ||
    extractWorkAddress(cleanText) ||
    (bossPartial?.location && bossPartial.location.length > 20 ? bossPartial.location : undefined);
  const salary = bossPartial?.salary || extractSalary(cleanText);
  const experienceYears = bossPartial?.experienceYears ?? extractExperienceYears(cleanText);
  const url = bossPartial?.url || extractUrl(text);
  const sections = extractJobSections(cleanText);
  const jobIntro = bossPartial?.jobIntro || sections.jobIntro || undefined;
  const responsibilities =
    bossPartial?.responsibilities?.length
      ? bossPartial.responsibilities
      : sections.responsibilities;
  const requirements =
    bossPartial?.requirements?.length ? bossPartial.requirements : sections.requirements;
  const description =
    bossPartial?.description ||
    sectionsToDescription(sections) ||
    cleanText;
  const preferredSkills = extractSkillsFromJobDescription(description);

  return {
    title,
    company,
    location: workAddress ? extractCityFromAddress(workAddress) || location : location,
    workAddress,
    salary,
    experienceYears,
    url,
    jobIntro,
    responsibilities,
    description,
    requirements,
    preferredSkills,
  };
}
