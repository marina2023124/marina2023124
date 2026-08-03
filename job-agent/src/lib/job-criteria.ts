import type { JobPosting } from "./types";

export type CriterionType = "experience" | "education" | "skill";

export interface JobCriterion {
  id: string;
  label: string;
  type: CriterionType;
  required: boolean;
  minYears?: number;
  maxYears?: number;
  domain?: string;
  majors?: string[];
  skillKey?: string;
}

const SECTION_NOISE = new Set([
  "岗位职责",
  "任职要求",
  "任职条件",
  "岗位要求",
  "任职资格",
  "职位描述",
  "工作内容",
  "工作职责",
  "招聘要求",
  "岗位说明",
  "职位介绍",
]);

/** JD 中「社会学、心理学…等相关专业」常见扩展 */
const RELATED_MAJOR_EXPANSION = [
  "传播学",
  "新闻传播学",
  "新闻学",
  "新闻与传播",
  "新闻传播",
  "广告学",
  "传媒",
  "人类学",
  "教育学",
  "管理学",
  "工商管理",
  "公共管理",
  "设计学",
  "人机交互",
  "HCI",
  "信息科学",
  "数据科学",
];

const KNOWN_MAJOR_TOKENS = [
  "社会学",
  "统计学",
  "心理学",
  "市场营销",
  "传播学",
  "新闻学",
  "广告学",
  "人类学",
  "教育学",
  "管理学",
  "经济学",
  "数学",
  "计算机",
  "设计学",
];

function isPreferredClause(text: string): boolean {
  return /优先|加分|更佳|最好|preferred/i.test(text);
}

function parseExperienceCriterion(text: string): JobCriterion | null {
  const ur = text.match(
    /(\d+)\s*[-~至到]\s*(\d+)\s*年.*?(?:用研|用户研究|UR|User\s*Research)/i
  );
  if (ur) {
    return {
      id: "exp-ur",
      label: `${ur[1]}-${ur[2]}年用研相关经验`,
      type: "experience",
      required: !isPreferredClause(text),
      minYears: Number(ur[1]),
      maxYears: Number(ur[2]),
      domain: "用户研究",
    };
  }

  const generic = text.match(/(\d+)\s*[-~至到]\s*(\d+)\s*年/);
  if (generic && /经验|工作/.test(text)) {
    return {
      id: "exp-general",
      label: `${generic[1]}-${generic[2]}年相关工作经验`,
      type: "experience",
      required: !isPreferredClause(text),
      minYears: Number(generic[1]),
      maxYears: Number(generic[2]),
    };
  }

  const single = text.match(/(\d+)\s*年(?:及以上|以上|\+)?.*?(?:用研|用户研究|经验)/);
  if (single) {
    const years = Number(single[1]);
    return {
      id: "exp-single",
      label: `${years}年以上相关经验`,
      type: "experience",
      required: !isPreferredClause(text),
      minYears: years,
      maxYears: years + 2,
      domain: /用研|用户研究/.test(text) ? "用户研究" : undefined,
    };
  }

  return null;
}

function parseEducationCriterion(text: string): JobCriterion | null {
  if (!/(专业|学科|学历|本科|硕士|博士|背景)/.test(text)) return null;

  const majorBlock = text.match(
    /([\u4e00-\u9fffA-Za-z、，,/+\s]+?)(?:等)?(?:相关)?(?:专业|学科)(?:背景)?/
  );
  if (!majorBlock?.[1]) return null;

  const majors = majorBlock[1]
    .split(/[、，,/+\s]+/)
    .map((m) => m.trim().replace(/等相关$/, "").replace(/相关$/, ""))
    .filter((m) => m.length >= 2 && KNOWN_MAJOR_TOKENS.some((k) => m.includes(k) || k.includes(m)));

  if (majors.length === 0) return null;

  const expanded = Array.from(new Set([...majors, ...RELATED_MAJOR_EXPANSION]));

  return {
    id: "edu-major",
    label: `${majors.slice(0, 4).join("、")}等相关专业背景`,
    type: "education",
    required: !isPreferredClause(text),
    majors: expanded,
  };
}

function parseSkillCriteria(text: string): JobCriterion[] {
  const criteria: JobCriterion[] = [];
  const preferred = isPreferredClause(text);

  if (/定性/.test(text) && /定量/.test(text)) {
    criteria.push({
      id: "skill-qual-quant",
      label: "定性 / 定量研究方法",
      type: "skill",
      required: !preferred || /熟练|掌握|精通/.test(text),
      skillKey: "qual-quant",
    });
  } else if (/定性/.test(text)) {
    criteria.push({
      id: "skill-qualitative",
      label: "定性研究方法",
      type: "skill",
      required: !preferred,
      skillKey: "qualitative",
    });
  } else if (/定量/.test(text)) {
    criteria.push({
      id: "skill-quantitative",
      label: "定量研究方法",
      type: "skill",
      required: !preferred,
      skillKey: "quantitative",
    });
  }

  if (/用户研究|用研/.test(text) && !criteria.some((c) => c.id === "skill-qual-quant")) {
    criteria.push({
      id: "skill-ur",
      label: "用户研究能力",
      type: "skill",
      required: !preferred,
      skillKey: "user-research",
    });
  }

  if (/\bsql\b/i.test(text) || /大样本.*数据|数据处理/.test(text)) {
    criteria.push({
      id: "skill-sql",
      label: "SQL / 大样本数据处理",
      type: "skill",
      required: !preferred,
      skillKey: "sql",
    });
  }

  if (/to\s*b|tob|ToB|B端|企业端|商业客户/i.test(text)) {
    criteria.push({
      id: "skill-tob",
      label: "toB 相关研究经验",
      type: "skill",
      required: !preferred,
      skillKey: "tob",
    });
  }

  if (/excel|spss|tableau|python|r语言|stata|power\s*bi/i.test(text)) {
    const tools: { re: RegExp; label: string; key: string }[] = [
      { re: /\bexcel\b/i, label: "Excel", key: "excel" },
      { re: /\bspss\b/i, label: "SPSS", key: "spss" },
      { re: /\btableau\b/i, label: "Tableau", key: "tableau" },
      { re: /\bpython\b/i, label: "Python", key: "python" },
      { re: /r语言|\br\b/i, label: "R语言", key: "r" },
      { re: /\bstata\b/i, label: "Stata", key: "stata" },
      { re: /power\s*bi/i, label: "Power BI", key: "powerbi" },
    ];
    for (const tool of tools) {
      if (tool.re.test(text)) {
        criteria.push({
          id: `skill-${tool.key}`,
          label: tool.label,
          type: "skill",
          required: !preferred,
          skillKey: tool.key,
        });
      }
    }
  }

  return criteria;
}

function isNoiseLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 4) return true;
  if (SECTION_NOISE.has(trimmed)) return true;
  if (/^【.+】$/.test(trimmed)) return true;
  if (/^(负责|参与|协助|完成|推动|围绕|支持|对接)/.test(trimmed) && trimmed.length > 12) {
    return true;
  }
  if (/围绕.+业务目标|商业化业务|业务目标/.test(trimmed) && !/经验|专业|学历|优先/.test(trimmed)) {
    return true;
  }
  return false;
}

function collectRequirementTexts(job: JobPosting): string[] {
  const texts = [
    ...job.requirements,
    ...job.preferredSkills,
  ].filter((t) => !isNoiseLine(t));

  const reqBlock = job.description.match(/【任职要求】([\s\S]*?)(?=【|$)/);
  if (reqBlock?.[1]) {
    for (const line of reqBlock[1].split("\n")) {
      const cleaned = line.replace(/^\d+[、.．)\]]\s*/, "").trim();
      if (cleaned && !isNoiseLine(cleaned)) texts.push(cleaned);
    }
  }

  return texts;
}

function dedupeCriteria(criteria: JobCriterion[]): JobCriterion[] {
  const seen = new Set<string>();
  return criteria.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/** 从 JD 结构化字段提取可比对条件，排除职责描述噪声 */
export function extractJobCriteria(job: JobPosting): JobCriterion[] {
  const criteria: JobCriterion[] = [];
  const texts = collectRequirementTexts(job);

  for (const text of texts) {
    const exp = parseExperienceCriterion(text);
    if (exp) criteria.push(exp);

    const edu = parseEducationCriterion(text);
    if (edu) criteria.push(edu);

    criteria.push(...parseSkillCriteria(text));
  }

  if (criteria.length === 0) {
    const fallbackText = texts.join(" ") || job.description.slice(0, 800);
    const exp = parseExperienceCriterion(fallbackText);
    if (exp) criteria.push(exp);
    const edu = parseEducationCriterion(fallbackText);
    if (edu) criteria.push(edu);
    criteria.push(...parseSkillCriteria(fallbackText));
  }

  if (job.experienceYears && !criteria.some((c) => c.type === "experience")) {
    const years = job.experienceYears;
    criteria.unshift({
      id: "exp-header",
      label: `${years}年左右工作经验`,
      type: "experience",
      required: true,
      minYears: Math.max(1, years - 1),
      maxYears: years + 1,
    });
  }

  return dedupeCriteria(criteria);
}

export function isRelatedEducationField(field: string, majors: string[]): boolean {
  const normalized = normalizeMajorToken(field);
  if (!normalized) return false;

  return majors.some((major) => {
    const m = normalizeMajorToken(major);
    if (!m) return false;
    return normalized.includes(m) || m.includes(normalized);
  });
}

function normalizeMajorToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/专业$|系$|学院$|学士$|硕士$|博士$|本科$|研究生$/, "")
    .trim();
}

/** 从 degree / 学校 / 摘要等文本中提取可能的专业名 */
function extractMajorsFromText(text: string): string[] {
  const found: string[] = [];
  const normalized = text.trim();
  if (!normalized) return found;

  const allTokens = [
    ...KNOWN_MAJOR_TOKENS,
    ...RELATED_MAJOR_EXPANSION,
    "新闻与传播",
    "新闻传播",
    "应用心理学",
    "应用统计",
    "市场营销学",
    "communication",
    "communications",
  ];

  for (const token of allTokens) {
    if (normalized.toLowerCase().includes(token.toLowerCase())) {
      found.push(token);
    }
  }

  const degreeMatch = normalized.match(
    /(?:本科|硕士|博士|学士|BA|B\.A\.|MA|M\.A\.)[\s·/\-—]*([\u4e00-\u9fffA-Za-z]{2,16})/
  );
  if (degreeMatch?.[1]) found.push(degreeMatch[1]);

  return found;
}

/** 汇总简历中所有可用于专业比对的信号 */
export function getProfileEducationSignals(profile: {
  summary?: string;
  educations: { field?: string; degree?: string; school?: string }[];
}): string[] {
  const signals = new Set<string>();

  for (const edu of profile.educations) {
    if (edu.field?.trim()) signals.add(edu.field.trim());
    if (edu.degree?.trim()) {
      signals.add(edu.degree.trim());
      extractMajorsFromText(edu.degree).forEach((m) => signals.add(m));
    }
    if (edu.school?.trim()) extractMajorsFromText(edu.school).forEach((m) => signals.add(m));
  }

  if (profile.summary?.trim()) {
    signals.add(profile.summary.trim());
    extractMajorsFromText(profile.summary).forEach((m) => signals.add(m));
  }

  return Array.from(signals);
}

/** 查找与 JD 专业要求最匹配的用户专业展示名 */
export function findMatchingEducationLabel(
  profile: {
    summary?: string;
    educations: { field?: string; degree?: string; school?: string }[];
  },
  majors: string[]
): string | undefined {
  for (const edu of profile.educations) {
    if (edu.field?.trim() && isRelatedEducationField(edu.field, majors)) {
      return edu.field.trim();
    }
  }

  for (const edu of profile.educations) {
    for (const extracted of extractMajorsFromText(edu.degree || "")) {
      if (isRelatedEducationField(extracted, majors)) return extracted;
    }
  }

  for (const extracted of extractMajorsFromText(profile.summary || "")) {
    if (isRelatedEducationField(extracted, majors)) return extracted;
  }

  for (const signal of getProfileEducationSignals(profile)) {
    if (signal.length > 12) continue;
    if (isRelatedEducationField(signal, majors)) return signal;
  }

  for (const major of majors) {
    for (const signal of getProfileEducationSignals(profile)) {
      if (signal.includes(major)) return major;
    }
  }

  return undefined;
}
