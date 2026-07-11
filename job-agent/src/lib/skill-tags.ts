import type { Skill } from "./types";

/** Shared skill vocabulary — longer phrases first when matching. */
export const KNOWN_SKILLS = [
  // Research & analytics (longer first)
  "价格敏感度测试", "价格敏感度", "PSM分析", "体验旅程地图",
  "深度访谈", "用户访谈", "定性访谈", "日记研究", "定量调研", "问卷设计",
  "焦点小组", "可用性测试", "概念测试", "竞品分析", "定性分析", "统计分析",
  "用户画像", "市场研究", "商业分析", "数据分析", "数据可视化", "报告撰写",
  "用户研究", "JTBD分析", "JTBD", "深访", "访谈", "问卷", "调研",
  "A/B测试", "NPS", "PSM", "MOT", "STAR", "NVivo",
  // Office & tools
  "Power BI", "PowerPoint", "JavaScript", "TypeScript", "Python", "Node.js",
  "Next.js", "PostgreSQL", "MongoDB", "Kubernetes",
  "Excel", "PPT", "SPSS", "Stata", "Tableau", "Figma", "SQL",
  "机器学习", "深度学习", "TensorFlow", "PyTorch", "Spark", "Hadoop",
  "Java", "React", "Vue", "AWS", "Docker", "Go", "Rust", "C++",
  "MySQL", "Redis", "Angular", "Spring", "Git", "Linux", "HTML", "CSS", "Sass",
  "R语言",
];

/** Regex → canonical tag for methodologies mentioned in prose. */
const METHODOLOGY_PATTERNS: { re: RegExp; tag: string }[] = [
  { re: /JTBD/i, tag: "JTBD分析" },
  { re: /NVivo/i, tag: "NVivo" },
  { re: /日记研究/i, tag: "日记研究" },
  { re: /体验旅程地图|旅程地图/i, tag: "体验旅程地图" },
  { re: /定性分析/i, tag: "定性分析" },
  { re: /PSM\s*[（(]?\s*价格敏感度测试\s*[)）]?|价格敏感度测试|PSM\s*分析/i, tag: "PSM分析" },
  { re: /\bPSM\b/i, tag: "PSM" },
  { re: /\bMOT\b|关键时刻/i, tag: "MOT" },
  { re: /\bNPS\b/i, tag: "NPS" },
  { re: /深度访谈|深访/i, tag: "深度访谈" },
  { re: /用户访谈/i, tag: "用户访谈" },
  { re: /定性访谈|定性研究/i, tag: "定性访谈" },
  { re: /定量研究|定量调研|定量分析/i, tag: "定量调研" },
  { re: /焦点小组/i, tag: "焦点小组" },
  { re: /可用性测试/i, tag: "可用性测试" },
  { re: /概念测试/i, tag: "概念测试" },
  { re: /竞品分析/i, tag: "竞品分析" },
  { re: /用户画像/i, tag: "用户画像" },
  { re: /A\/B\s*测试|AB\s*测试/i, tag: "A/B测试" },
];

const SKILL_STOPWORDS = new Set([
  "普通", "核心", "泛", "及", "与", "的", "等", "中", "上", "下", "内", "外",
  "规模", "行为", "差异", "习惯", "场景", "消费", "用户", "研究", "分析",
  "项目", "机构", "平台", "人群", "画像", "协助", "负责", "进行", "开展",
  "完成", "推动", "参与", "主导", "深入", "重点", "围绕", "针对", "基于",
  "以及", "通过", "其中", "相关", "主要", "各类", "多种", "不同", "整体",
  "核心体育", "体育", "NBA", "辅导",
]);

const ROLE_TITLE_WORDS = /(?:研究员|分析师|工程师|经理|总监|主管|专员|顾问|设计师|产品经理|运营|开发)$/;

const PROSE_PATTERNS = [
  /^您好|^你好|^hi\b|^hello\b/i,
  /^我是[\u4e00-\u9fa5]{2,6}/,
  /^请查收|附件简历|我的简历|个人简历/,
  /拥有.*经验|几年.*经验|\d+年.*经验/,
  /在过往|尤其擅长|我有几段|高度相关|请查收/,
  /查收我的|附件|简历[~～]?$/,
  /[。！？~～]$/,
  /：$/ ,
  /以及$|等$/,
];

const FRAGMENT_PATTERNS = [
  /^(协助|负责|进行|开展|参与|主导|完成|推动|深入|重点|围绕|针对|基于)/,
  /(行为|习惯|规模|差异|咨询有限公司|科技有限公司|集团有限公司|股份公司)/,
  /[)）]\s*$/,
  /的$/,
  /用户研究项目/,
  /观赛行为/,
  /有限公司$/,
  /集团$/,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function cleanToken(raw: string): string {
  return raw
    .trim()
    .replace(/^[-*•●\d、.．)\]]+\s*/, "")
    .replace(/^[（(]+|[)）]+$/g, "")
    .replace(/[，,;；|/\\]+$/g, "")
    .trim();
}

function isKnownSkillExact(token: string): boolean {
  const lower = token.toLowerCase();
  return KNOWN_SKILLS.some((skill) => skill.toLowerCase() === lower);
}

function isCompanyOrTitleLike(token: string, company?: string, title?: string): boolean {
  if (!token) return true;
  if (company && (token === company || company.includes(token) || token.includes(company))) {
    return true;
  }
  if (title && (token === title || title.includes(token) || token.includes(title))) {
    return true;
  }
  if (ROLE_TITLE_WORDS.test(token)) return true;
  if (/(公司|集团|科技|有限|股份|辅导|咨询)/.test(token)) return true;
  return false;
}

export function isValidSkillTag(
  raw: string,
  context?: { company?: string; title?: string }
): boolean {
  const token = cleanToken(raw);
  if (!token || token.length < 2 || token.length > 16) return false;
  if (/^\d+$/.test(token) || /\d{4}/.test(token)) return false;
  if (SKILL_STOPWORDS.has(token)) return false;
  if (PROSE_PATTERNS.some((re) => re.test(token))) return false;
  if (FRAGMENT_PATTERNS.some((re) => re.test(token))) return false;
  if (isCompanyOrTitleLike(token, context?.company, context?.title)) return false;

  if (isKnownSkillExact(token)) return true;

  // English / acronym skills: React, SQL, MOT
  if (/^[A-Z][A-Z0-9/+.\-]{0,7}$/.test(token)) return true;
  if (/^[A-Za-z][A-Za-z0-9+#.\-/]{1,15}$/.test(token)) return true;

  return false;
}

/** Prefer specific tags over generic subsets. */
const TAG_SUPERSEDES: [string, string[]][] = [
  ["PSM分析", ["PSM", "价格敏感度", "价格敏感度测试"]],
  ["深度访谈", ["深访", "访谈"]],
  ["用户访谈", ["访谈"]],
  ["定性访谈", ["深访", "访谈"]],
  ["定量调研", ["调研", "问卷"]],
];

function finalizeSkillTags(tags: string[]): string[] {
  const set = new Set(tags);
  for (const [preferred, drop] of TAG_SUPERSEDES) {
    if (set.has(preferred)) drop.forEach((d) => set.delete(d));
  }
  return Array.from(set);
}

export function filterSkillTags(
  tags: string[],
  context?: { company?: string; title?: string }
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const token = cleanToken(raw);
    if (!isValidSkillTag(token, context)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(token);
  }

  return finalizeSkillTags(result).slice(0, 12);
}

/** Normalize "用户研究方法：深度访谈" → "深度访谈" */
function normalizeListedSkill(raw: string): string | null {
  const token = cleanToken(raw.replace(/^熟练使用|^能用|^精通/, ""));
  if (!token) return null;

  const colonParts = token.split(/[：:]/).map((p) => cleanToken(p)).filter(Boolean);
  if (colonParts.length > 1) {
    const tail = colonParts[colonParts.length - 1];
    if (isValidSkillTag(tail)) return tail;
  }

  // "NVivo编码" → try stripping 编码 suffix
  const trimmed = token.replace(/编码$|分析$/, (m) => (m === "编码" ? "" : m));
  if (trimmed !== token && isValidSkillTag(trimmed)) return trimmed;

  if (isValidSkillTag(token)) return token;
  return null;
}

/** Parse a dedicated 「专业技能」section — comma lists only, strict filter. */
export function extractProfileSkillsFromSection(block: string): string[] {
  const fromKeywords = extractSkillTagsFromText(block);
  const fromList: string[] = [];

  for (const part of block.split(/[,，、;；\n]+/)) {
    const normalized = normalizeListedSkill(part);
    if (normalized) fromList.push(normalized);
  }

  return filterSkillTags([...fromKeywords, ...fromList]).slice(0, 24);
}

export function sanitizeProfileSkills(skills: Skill[]): Skill[] {
  const seen = new Set<string>();
  return skills.filter((s) => {
    const name = cleanToken(s.name);
    if (!isValidSkillTag(name)) return false;
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchKnownSkills(text: string): string[] {
  const found: string[] = [];
  const sorted = [...KNOWN_SKILLS].sort((a, b) => b.length - a.length);

  for (const skill of sorted) {
    const re = new RegExp(escapeRegExp(skill), "i");
    if (re.test(text)) found.push(skill);
  }
  return found;
}

function matchMethodologyPatterns(text: string): string[] {
  const found: string[] = [];
  for (const { re, tag } of METHODOLOGY_PATTERNS) {
    if (re.test(text)) found.push(tag);
  }
  return found;
}

function extractExplicitSkillLines(text: string): string[] {
  const found: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const match = line.match(
      /^(?:技能|工具|技术栈|熟练|掌握|专业技能|核心技能)[：:]\s*(.+)$/i
    );
    if (!match?.[1]) continue;

    for (const part of match[1].split(/[,，、;；|/]+/)) {
      const token = cleanToken(part);
      if (isValidSkillTag(token)) found.push(token);
    }
  }

  return found;
}

/** Extract skill tags from resume/JD body text. */
export function extractSkillTagsFromText(text: string): string[] {
  const candidates = [
    ...matchMethodologyPatterns(text),
    ...matchKnownSkills(text),
    ...extractExplicitSkillLines(text),
  ];
  return filterSkillTags(candidates);
}

export function extractSkillTagsFromExperience(exp: {
  company: string;
  title: string;
  description: string;
  achievements: string[];
  skills?: string[];
}): string[] {
  const body = [exp.description, ...exp.achievements].filter(Boolean).join("\n");
  const auto = extractSkillTagsFromText(body);
  const manual = filterSkillTags(exp.skills || [], {
    company: exp.company,
    title: exp.title,
  });
  return filterSkillTags([...auto, ...manual], {
    company: exp.company,
    title: exp.title,
  });
}

export function sanitizeWorkExperienceSkills<
  T extends {
    company: string;
    title: string;
    description: string;
    achievements: string[];
    skills: string[];
  },
>(exp: T): T {
  return { ...exp, skills: extractSkillTagsFromExperience(exp) };
}
