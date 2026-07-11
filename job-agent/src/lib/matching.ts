import type { JobPosting, MatchResult, Profile, Project, WorkExperience } from "./types";
import { calcTotalExperienceYears, calcYearsBetween, normalizeSkill } from "./utils";
import { extractSkillTagsFromExperience } from "./skill-tags";
import {
  extractJobCriteria,
  findMatchingEducationLabel,
  type JobCriterion,
} from "./job-criteria";

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

const UR_ROLE_RE =
  /用户研究|用研|UX研究|User\s*Research|UR\b|研究员|研究分析师|研究专员/i;
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

function getProfileSkillSet(profile: Profile): Set<string> {
  const skills = new Set<string>();
  profile.skills.forEach((s) => expandSkill(s.name).forEach((a) => skills.add(a)));
  profile.workExperiences.forEach((exp) =>
    extractSkillTagsFromExperience(exp).forEach((s) =>
      expandSkill(s).forEach((a) => skills.add(a))
    )
  );
  profile.projects.forEach((p) => {
    (p.technologies ?? []).forEach((t) => expandSkill(t).forEach((a) => skills.add(a)));
    const text = [p.description, p.workSummary ?? "", ...(p.highlights ?? [])].join(" ");
    extractSkillTagsFromExperience({
      company: "",
      title: p.name,
      description: text,
      achievements: p.highlights ?? [],
      skills: p.technologies ?? [],
    } as WorkExperience).forEach((s) => expandSkill(s).forEach((a) => skills.add(a)));
  });
  return skills;
}

function getProfileTextBlob(profile: Profile): string {
  const parts = [
    profile.summary,
    ...profile.workExperiences.map(
      (e) => `${e.title} ${e.description} ${e.achievements.join(" ")} ${e.skills.join(" ")}`
    ),
    ...profile.projects.map(
      (p) =>
        `${p.name} ${p.description} ${p.workSummary ?? ""} ${(p.highlights ?? []).join(" ")} ${(p.technologies ?? []).join(" ")}`
    ),
    ...profile.educations.map((e) => `${e.field} ${e.degree}`),
  ];
  return parts.join(" ");
}

function isUserResearchExperience(exp: WorkExperience): boolean {
  const text = `${exp.title} ${exp.description} ${exp.achievements.join(" ")} ${exp.skills.join(" ")}`;
  return UR_ROLE_RE.test(text) || (UR_CONTENT_RE.test(text) && /研究|分析|调研/.test(text));
}

function isUserResearchProject(project: Project): boolean {
  const text = `${project.name} ${project.description} ${project.workSummary ?? ""} ${(project.highlights ?? []).join(" ")} ${(project.technologies ?? []).join(" ")}`;
  return UR_CONTENT_RE.test(text);
}

function calcUserResearchYears(profile: Profile): number {
  const intervals: { startDate: string; endDate?: string }[] = [];

  for (const exp of profile.workExperiences) {
    if (isUserResearchExperience(exp)) {
      intervals.push({ startDate: exp.startDate, endDate: exp.endDate });
    }
  }

  const urProjects = profile.projects.filter(isUserResearchProject);
  for (const project of urProjects) {
    if (project.startDate) {
      intervals.push({ startDate: project.startDate, endDate: project.endDate });
    }
  }

  if (intervals.length > 0) {
    return calcTotalExperienceYears(intervals);
  }

  if (UR_ROLE_RE.test(profile.summary) || UR_CONTENT_RE.test(profile.summary)) {
    return calcTotalExperienceYears(profile.workExperiences);
  }

  if (urProjects.length >= 3) {
    const dated = urProjects.filter((p) => p.startDate);
    if (dated.length >= 2) {
      const starts = dated.map((p) => p.startDate!).sort();
      const ends = dated
        .map((p) => p.endDate)
        .filter(Boolean)
        .sort() as string[];
      const earliest = starts[0];
      const latest = ends[ends.length - 1];
      return calcYearsBetween(earliest, latest);
    }
    return Math.min(3, Math.round(urProjects.length * 0.4 * 10) / 10);
  }

  return 0;
}

function profileHasQualQuant(profile: Profile): { qual: boolean; quant: boolean } {
  const blob = getProfileTextBlob(profile).toLowerCase();
  const skills = getProfileSkillSet(profile);
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

function profileHasSkillKey(profile: Profile, skillKey: string): boolean {
  const skills = getProfileSkillSet(profile);
  const blob = getProfileTextBlob(profile);

  switch (skillKey) {
    case "qual-quant": {
      const { qual, quant } = profileHasQualQuant(profile);
      return qual && quant;
    }
    case "qualitative":
      return profileHasQualQuant(profile).qual;
    case "quantitative":
      return profileHasQualQuant(profile).quant;
    case "user-research":
      return (
        calcUserResearchYears(profile) > 0 ||
        UR_CONTENT_RE.test(blob) ||
        skills.has("用户研究")
      );
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

function evaluateCriterion(
  profile: Profile,
  criterion: JobCriterion
): { matched: boolean; displayLabel: string } {
  switch (criterion.type) {
    case "experience": {
      const years =
        criterion.domain === "用户研究"
          ? calcUserResearchYears(profile)
          : calcTotalExperienceYears(profile.workExperiences);
      const min = criterion.minYears ?? 0;
      const max = criterion.maxYears ?? min + 2;
      const matched = years >= min * 0.85 && years <= max + 1.5;
      const displayLabel = matched
        ? `${criterion.label}（约 ${years} 年）`
        : criterion.label;
      return { matched, displayLabel };
    }
    case "education": {
      const majors = criterion.majors ?? [];
      const label = findMatchingEducationLabel(profile, majors);
      if (label) {
        return {
          matched: true,
          displayLabel: `${label}（相关专业）`,
        };
      }
      return { matched: false, displayLabel: criterion.label };
    }
    case "skill": {
      const matched = criterion.skillKey
        ? profileHasSkillKey(profile, criterion.skillKey)
        : false;
      const suffix = criterion.required ? "" : "（优先）";
      return {
        matched,
        displayLabel: `${criterion.label}${suffix}`,
      };
    }
    default:
      return { matched: false, displayLabel: criterion.label };
  }
}

function evaluateAllCriteria(profile: Profile, criteria: JobCriterion[]) {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const criterion of criteria) {
    const result = evaluateCriterion(profile, criterion);
    if (result.matched) {
      matched.push(result.displayLabel);
    } else if (criterion.required) {
      missing.push(result.displayLabel);
    } else {
      missing.push(result.displayLabel);
    }
  }

  const required = criteria.filter((c) => c.required);
  const requiredMatched = required.filter(
    (c) => evaluateCriterion(profile, c).matched
  ).length;

  const preferred = criteria.filter((c) => !c.required);
  const preferredMatched = preferred.filter(
    (c) => evaluateCriterion(profile, c).matched
  ).length;

  return { matched, missing, required, requiredMatched, preferred, preferredMatched };
}

function calcExperienceMatch(profile: Profile, job: JobPosting, criteria: JobCriterion[]): number {
  const expCriterion = criteria.find((c) => c.type === "experience");
  const urYears = calcUserResearchYears(profile);
  const totalYears = calcTotalExperienceYears(profile.workExperiences);

  if (expCriterion) {
    const years = expCriterion.domain === "用户研究" ? urYears : totalYears;
    const min = expCriterion.minYears ?? 0;
    const max = expCriterion.maxYears ?? min;

    if (min > 0 && years >= min && years <= max + 1) return 100;
    if (years >= min) return 85;
    if (years >= min * 0.7) return 75;
    if (years >= min * 0.5) return 55;
    if (min > 0) return Math.max(25, Math.round((years / min) * 50));
  }

  const required = job.experienceYears ?? 0;
  if (required === 0) return 85;
  if (totalYears >= required) return 100;
  if (totalYears >= required * 0.7) return 75;
  if (totalYears >= required * 0.5) return 55;
  return Math.max(20, Math.round((totalYears / required) * 50));
}

function calcEducationMatch(profile: Profile, criteria: JobCriterion[]): number {
  const eduCriterion = criteria.find((c) => c.type === "education");
  if (!eduCriterion) return 85;
  const matched = Boolean(findMatchingEducationLabel(profile, eduCriterion.majors ?? []));
  return matched ? 100 : 35;
}

function calcSkillMatch(
  required: JobCriterion[],
  requiredMatched: number,
  preferred: JobCriterion[],
  preferredMatched: number
): number {
  if (required.length === 0 && preferred.length === 0) return 70;

  const requiredScore =
    required.length > 0 ? (requiredMatched / required.length) * 100 : 85;
  const preferredScore =
    preferred.length > 0 ? (preferredMatched / preferred.length) * 100 : 85;

  return Math.round(requiredScore * 0.8 + preferredScore * 0.2);
}

function generateRecommendation(
  score: number,
  matched: string[],
  missing: string[],
  job: JobPosting
): string {
  const requiredMissing = missing.filter((m) => !m.includes("（优先）"));
  const preferredMissing = missing.filter((m) => m.includes("（优先）"));

  if (score >= 85) {
    return `与「${job.title}」高度匹配，建议优先投递并在简历中突出 ${matched.slice(0, 3).join("、")} 相关经验。`;
  }
  if (score >= 65) {
    const gap = requiredMissing.length > 0 ? requiredMissing.slice(0, 2) : preferredMissing.slice(0, 2);
    return `与「${job.title}」较为匹配，可在简历中补充 ${gap.join("、")} 的学习或项目经历后再投递。`;
  }
  if (score >= 45) {
    const gap = requiredMissing.length > 0 ? requiredMissing : preferredMissing;
    return `与「${job.title}」部分匹配，建议评估是否值得投入：差距主要在 ${gap.slice(0, 3).join("、")}。`;
  }
  return `与「${job.title}」匹配度较低，建议优先关注更贴合背景的岗位，或系统补齐核心技能后再申请。`;
}

export function matchJob(profile: Profile, job: JobPosting): MatchResult {
  const criteria = extractJobCriteria(job);
  const evaluation = evaluateAllCriteria(profile, criteria);

  const skillMatch = calcSkillMatch(
    evaluation.required,
    evaluation.requiredMatched,
    evaluation.preferred,
    evaluation.preferredMatched
  );
  const experienceMatch = calcExperienceMatch(profile, job, criteria);
  const educationMatch = calcEducationMatch(profile, criteria);

  const score = Math.round(
    skillMatch * 0.5 + experienceMatch * 0.35 + educationMatch * 0.15
  );

  const urYears = calcUserResearchYears(profile);
  const totalYears = calcTotalExperienceYears(profile.workExperiences);

  const strengths: string[] = [];
  if (evaluation.matched.length > 0) {
    strengths.push(`条件匹配：${evaluation.matched.slice(0, 5).join("、")}`);
  }
  if (urYears > 0) {
    strengths.push(`用户研究相关经验约 ${urYears} 年`);
  } else if (totalYears > 0) {
    strengths.push(`累计工作经验 ${totalYears} 年`);
  }
  if (profile.projects.length > 0) {
    strengths.push(`拥有 ${profile.projects.length} 个项目经验`);
  }

  const gaps: string[] = [];
  const requiredMissing = evaluation.missing.filter((m) => !m.includes("（优先）"));
  const preferredMissing = evaluation.missing.filter((m) => m.includes("（优先）"));
  if (requiredMissing.length > 0) {
    gaps.push(`待补充：${requiredMissing.slice(0, 5).join("、")}`);
  }
  if (preferredMissing.length > 0) {
    gaps.push(`加分项：${preferredMissing.slice(0, 3).join("、")}`);
  }

  const displayMissing = [
    ...requiredMissing,
    ...preferredMissing.slice(0, Math.max(0, 6 - requiredMissing.length)),
  ].slice(0, 8);

  return {
    jobId: job.id,
    score: Math.min(100, score),
    skillMatch,
    experienceMatch,
    matchedSkills: evaluation.matched,
    missingSkills: displayMissing,
    strengths,
    gaps,
    recommendation: generateRecommendation(score, evaluation.matched, evaluation.missing, job),
  };
}

export function matchAllJobs(profile: Profile, jobs: JobPosting[]): MatchResult[] {
  return jobs
    .map((job) => matchJob(profile, job))
    .sort((a, b) => b.score - a.score);
}

export function extractSkillsFromJobDescription(text: string): string[] {
  const techKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C++", "C#",
    "React", "Vue", "Angular", "Next.js", "Node.js", "Spring", "Django",
    "Flask", "FastAPI", "Express", "MySQL", "PostgreSQL", "MongoDB", "Redis",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "Linux",
    "机器学习", "深度学习", "人工智能", "数据分析", "产品经理", "UI设计",
    "Figma", "SQL", "HTML", "CSS", "Tailwind", "GraphQL", "REST",
    "微服务", "分布式", "高并发", "大数据", "Spark", "Hadoop",
    "用户研究", "定性分析", "定量调研", "SPSS", "Tableau", "Excel",
  ];

  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const kw of techKeywords) {
    if (lower.includes(kw.toLowerCase()) || text.includes(kw)) {
      found.push(kw);
    }
  }
  return found;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 bg-emerald-50";
  if (score >= 60) return "text-blue-600 bg-blue-50";
  if (score >= 40) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return "高度匹配";
  if (score >= 65) return "较为匹配";
  if (score >= 45) return "部分匹配";
  return "匹配度低";
}
