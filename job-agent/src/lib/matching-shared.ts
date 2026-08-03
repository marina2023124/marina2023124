import type { Project, WorkExperience } from "./types";
import { normalizeSkill } from "./utils";
import { extractSkillTagsFromExperience } from "./skill-tags";

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js", "javascript", "ecmascript"],
  typescript: ["ts", "typescript"],
  python: ["python", "py"],
  react: ["react", "reactjs", "react.js"],
  vue: ["vue", "vuejs", "vue.js"],
  node: ["node", "nodejs", "node.js"],
  java: ["java"],
  golang: ["go", "golang"],
  kubernetes: ["k8s", "kubernetes"],
  aws: ["aws", "amazon web services"],
  docker: ["docker", "容器"],
  mysql: ["mysql"],
  postgresql: ["postgresql", "postgres", "pg"],
  mongodb: ["mongodb", "mongo"],
  redis: ["redis"],
  "machine learning": ["ml", "machine learning", "机器学习"],
  "deep learning": ["dl", "deep learning", "深度学习"],
  ai: ["ai", "artificial intelligence", "人工智能"],
  sql: ["sql"],
  excel: ["excel"],
  spss: ["spss"],
  tableau: ["tableau"],
  stata: ["stata"],
  r: ["r语言", "r"],
};

const UR_CONTENT_RE =
  /用户研究|用研|定性|定量|访谈|问卷|调研|深访|焦点小组|可用性测试|概念测试|JTBD|用户画像/;
const QUAL_RE = /定性|深访|访谈|焦点小组|可用性|日记研究|定性分析|定性研究/;
const QUANT_RE = /定量|问卷|调研|统计分析|数据分析|SPSS|Stata|大样本/;
const TOB_RE = /to\s*b|tob|ToB|B端|企业端|商业客户|企业服务|SaaS|2B/i;

function expandSkill(skill: string): Set<string> {
  const normalized = normalizeSkill(skill);
  const result = new Set<string>([normalized]);
  for (const [, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
      aliases.forEach((a) => result.add(a));
    }
  }
  return result;
}

export function getProjectTextBlob(project: Project): string {
  return [
    project.name,
    project.description,
    project.workSummary ?? "",
    ...(project.highlights ?? []),
    ...(project.technologies ?? []),
  ].join(" ");
}

export function getProjectSkillSet(project: Project): Set<string> {
  const skills = new Set<string>();
  (project.technologies ?? []).forEach((t) => expandSkill(t).forEach((a) => skills.add(a)));
  const text = getProjectTextBlob(project);
  extractSkillTagsFromExperience({
    company: "",
    title: project.name,
    description: text,
    achievements: project.highlights ?? [],
    skills: project.technologies ?? [],
  } as WorkExperience).forEach((s) => expandSkill(s).forEach((a) => skills.add(a)));
  return skills;
}

function contextHasQualQuant(skills: Set<string>, blob: string): { qual: boolean; quant: boolean } {
  const skillText = Array.from(skills).join(" ");

  const qual =
    QUAL_RE.test(blob) ||
    QUAL_RE.test(skillText) ||
    skills.has("定性分析") ||
    skills.has("深度访谈") ||
    skills.has("用户访谈");

  const quant =
    QUANT_RE.test(blob) ||
    QUANT_RE.test(skillText) ||
    skills.has("定量调研") ||
    skills.has("问卷设计") ||
    skills.has("数据分析");

  return { qual, quant };
}

export function contextHasSkillKey(skills: Set<string>, blob: string, skillKey: string): boolean {
  switch (skillKey) {
    case "qual-quant": {
      const { qual, quant } = contextHasQualQuant(skills, blob);
      return qual && quant;
    }
    case "qualitative":
      return contextHasQualQuant(skills, blob).qual;
    case "quantitative":
      return contextHasQualQuant(skills, blob).quant;
    case "user-research":
      return UR_CONTENT_RE.test(blob) || skills.has("用户研究");
    case "sql":
      return skills.has("sql") || /\bsql\b/i.test(blob);
    case "tob":
      return TOB_RE.test(blob);
    case "excel":
      return skills.has("excel") || /excel/i.test(blob);
    case "spss":
      return skills.has("spss") || /spss/i.test(blob);
    case "tableau":
      return skills.has("tableau") || /tableau/i.test(blob);
    case "python":
      return skills.has("python") || /python/i.test(blob);
    case "r":
      return skills.has("r语言") || skills.has("r") || /r语言/i.test(blob);
    case "stata":
      return skills.has("stata") || /stata/i.test(blob);
    case "powerbi":
      return /power\s*bi/i.test(blob);
    default:
      return skills.has(skillKey);
  }
}
