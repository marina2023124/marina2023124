/** Shared skill vocabulary for resume/JD keyword matching. */
export const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "React", "Vue", "Node.js", "SQL",
  "Excel", "PPT", "PowerPoint", "SPSS", "Stata", "R语言", "Python",
  "数据分析", "用户研究", "定性访谈", "定量调研", "问卷设计", "焦点小组",
  "竞品分析", "市场研究", "商业分析", "用户画像", "A/B测试", "NPS",
  "机器学习", "深度学习", "TensorFlow", "PyTorch", "Spark", "Hadoop",
  "Tableau", "Power BI", "Figma", "AWS", "Docker", "Kubernetes",
  "Go", "Rust", "C++", "MySQL", "PostgreSQL", "MongoDB", "Redis",
  "Next.js", "Angular", "Spring", "Git", "Linux", "HTML", "CSS", "Sass",
];

const SKILL_STOPWORDS = new Set([
  "普通", "核心", "泛", "及", "与", "的", "等", "中", "上", "下", "内", "外",
  "规模", "行为", "差异", "习惯", "场景", "消费", "用户", "研究", "分析",
  "项目", "机构", "平台", "人群", "画像", "协助", "负责", "进行", "开展",
  "完成", "推动", "参与", "主导", "深入", "重点", "围绕", "针对", "基于",
  "以及", "通过", "其中", "相关", "主要", "各类", "多种", "不同", "整体",
]);

const FRAGMENT_PATTERNS = [
  /^(协助|负责|进行|开展|参与|主导|完成|推动|深入|重点|围绕|针对|基于)/,
  /(行为|习惯|规模|差异|咨询有限公司|科技有限公司|集团有限公司)/,
  /[)）]\s*$/,
  /的$/,
  /用户研究项目/,
  /观赛行为/,
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

export function isValidSkillTag(raw: string): boolean {
  const token = cleanToken(raw);
  if (!token || token.length < 2 || token.length > 14) return false;
  if (/^\d+$/.test(token) || /\d{4}/.test(token)) return false;
  if (SKILL_STOPWORDS.has(token)) return false;
  if (FRAGMENT_PATTERNS.some((re) => re.test(token))) return false;

  const isKnown = KNOWN_SKILLS.some(
    (skill) => skill.toLowerCase() === token.toLowerCase() || token.includes(skill)
  );
  if (isKnown) return true;

  // English / acronym skills: React, SQL, A/B
  if (/^[A-Za-z][A-Za-z0-9+#.\-/]{1,15}$/.test(token)) return true;

  // Short Chinese skill phrases (2-6 chars), not sentence-like
  if (/^[\u4e00-\u9fa5]{2,6}$/.test(token)) return true;

  return false;
}

export function filterSkillTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const token = cleanToken(raw);
    if (!isValidSkillTag(token)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(token);
  }

  return result.slice(0, 12);
}

function matchKnownSkills(text: string): string[] {
  const found: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    const re = new RegExp(escapeRegExp(skill), "i");
    if (re.test(text)) found.push(skill);
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

/** Extract skill tags from resume/JD text — keyword match only, never split body copy. */
export function extractSkillTagsFromText(text: string): string[] {
  const candidates = [...matchKnownSkills(text), ...extractExplicitSkillLines(text)];
  return filterSkillTags(candidates);
}

export function sanitizeWorkExperienceSkills<T extends { skills: string[] }>(exp: T): T {
  return { ...exp, skills: filterSkillTags(exp.skills) };
}
