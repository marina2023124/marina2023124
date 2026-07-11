import type { JobPosting, MatchResult, Profile } from "./types";
import { calcTotalExperienceYears, normalizeSkill } from "./utils";
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
};

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

function getProfileSkills(profile: Profile): Set<string> {
  const skills = new Set<string>();
  profile.skills.forEach((s) => expandSkill(s.name).forEach((a) => skills.add(a)));
  profile.workExperiences.forEach((exp) =>
    extractSkillTagsFromExperience(exp).forEach((s) =>
      expandSkill(s).forEach((a) => skills.add(a))
    )
  );
  profile.projects.forEach((p) =>
    p.technologies.forEach((t) => expandSkill(t).forEach((a) => skills.add(a)))
  );
  return skills;
}

function getJobSkills(job: JobPosting): string[] {
  const all = [...job.requirements, ...job.preferredSkills];
  const fromDesc = job.description.match(/[\u4e00-\u9fffA-Za-z+#.]{2,20}/g) || [];
  return Array.from(new Set([...all, ...fromDesc.slice(0, 30)]));
}

function skillsOverlap(profileSkills: Set<string>, jobSkills: string[]): {
  matched: string[];
  missing: string[];
} {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of jobSkills) {
    const expanded = expandSkill(skill);
    const isMatch = Array.from(expanded).some((s) => profileSkills.has(s));
    if (isMatch) {
      matched.push(skill);
    } else if (skill.length >= 2 && skill.length <= 30) {
      missing.push(skill);
    }
  }

  return { matched, missing };
}

function calcExperienceMatch(profile: Profile, job: JobPosting): number {
  const totalYears = calcTotalExperienceYears(profile.workExperiences);
  const required = job.experienceYears ?? 0;

  if (required === 0) return 85;
  if (totalYears >= required) return 100;
  if (totalYears >= required * 0.7) return 75;
  if (totalYears >= required * 0.5) return 55;
  return Math.max(20, Math.round((totalYears / required) * 50));
}

function generateRecommendation(
  score: number,
  matched: string[],
  missing: string[],
  job: JobPosting
): string {
  if (score >= 85) {
    return `与「${job.title}」高度匹配，建议优先投递并在简历中突出 ${matched.slice(0, 3).join("、")} 相关经验。`;
  }
  if (score >= 65) {
    return `与「${job.title}」较为匹配，可在简历中补充 ${missing.slice(0, 2).join("、")} 的学习或项目经历后再投递。`;
  }
  if (score >= 45) {
    return `与「${job.title}」部分匹配，建议评估是否值得投入：差距主要在 ${missing.slice(0, 3).join("、")}。`;
  }
  return `与「${job.title}」匹配度较低，建议优先关注更贴合背景的岗位，或系统补齐核心技能后再申请。`;
}

export function matchJob(profile: Profile, job: JobPosting): MatchResult {
  const profileSkills = getProfileSkills(profile);
  const jobSkills = getJobSkills(job);
  const { matched, missing } = skillsOverlap(profileSkills, jobSkills);

  const skillMatch =
    jobSkills.length > 0
      ? Math.round((matched.length / Math.min(jobSkills.length, 15)) * 100)
      : 70;

  const experienceMatch = calcExperienceMatch(profile, job);
  const score = Math.round(skillMatch * 0.65 + experienceMatch * 0.35);

  const strengths: string[] = [];
  if (matched.length > 0) {
    strengths.push(`技能匹配：${matched.slice(0, 5).join("、")}`);
  }
  const totalYears = calcTotalExperienceYears(profile.workExperiences);
  if (totalYears > 0) {
    strengths.push(`累计工作经验 ${totalYears} 年`);
  }
  if (profile.projects.length > 0) {
    strengths.push(`拥有 ${profile.projects.length} 个项目经验`);
  }

  const gaps: string[] = [];
  if (missing.length > 0) {
    gaps.push(`待补充技能：${missing.slice(0, 5).join("、")}`);
  }
  if (job.experienceYears && totalYears < job.experienceYears) {
    gaps.push(`经验要求 ${job.experienceYears} 年，当前约 ${totalYears} 年`);
  }

  return {
    jobId: job.id,
    score: Math.min(100, score),
    skillMatch,
    experienceMatch,
    matchedSkills: matched,
    missingSkills: missing.slice(0, 8),
    strengths,
    gaps,
    recommendation: generateRecommendation(score, matched, missing, job),
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
