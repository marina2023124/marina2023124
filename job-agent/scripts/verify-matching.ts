import { matchJob } from "../src/lib/matching";
import type { JobPosting, Profile } from "../src/lib/types";

const kuaishouJob: JobPosting = {
  id: "job-kuaishou-ur",
  title: "用户研究分析师 - 【商业化】",
  company: "快手",
  location: "北京海淀区",
  salary: "25-40K·16薪",
  experienceYears: 2,
  description: `【岗位职责】
1、围绕商业化业务目标，开展用户研究工作
2、输出研究报告并推动落地

【任职要求】
1、1-3年用研相关工作经验，熟练掌握各类定性、定量研究方法；
2、社会学、统计学、心理学、市场营销等相关专业背景；
3、有toB相关研究经验优先；有sql等大样本数据处理能力优先。`,
  requirements: [
    "1-3年用研相关工作经验，熟练掌握各类定性、定量研究方法；",
    "社会学、统计学、心理学、市场营销等相关专业背景；",
    "有toB相关研究经验优先；有sql等大样本数据处理能力优先。",
  ],
  preferredSkills: ["SQL"],
  responsibilities: [
    "围绕商业化业务目标，开展用户研究工作",
    "输出研究报告并推动落地",
  ],
  status: "saved",
  createdAt: new Date().toISOString(),
};

const urProfile: Profile = {
  name: "测试用户",
  email: "test@example.com",
  summary: "用户研究分析师，熟悉定性定量研究方法",
  targetRoles: ["用户研究"],
  targetIndustries: ["互联网"],
  preferredLocations: ["北京"],
  educations: [
    {
      id: "edu-1",
      school: "某大学",
      degree: "本科",
      field: "传播学",
      startDate: "2018-09",
      endDate: "2022-06",
    },
  ],
  workExperiences: [
    {
      id: "exp-1",
      company: "某咨询公司",
      title: "用户研究分析师",
      startDate: "2023-04",
      endDate: "2025-06",
      description: "负责快消、互联网等行业定性定量用户研究项目",
      achievements: ["完成深度访谈与问卷调研", "撰写研究报告"],
      skills: ["用户研究", "深度访谈", "问卷设计", "数据分析"],
    },
  ],
  projects: Array.from({ length: 12 }, (_, i) => ({
    id: `proj-${i}`,
    name: `用户研究项目 ${i + 1}`,
    description: "定性访谈与定量问卷调研",
    technologies: ["深度访谈", "问卷设计", "定性分析", "定量调研"],
    highlights: ["完成用户深访", "设计并投放问卷"],
    startDate: `2024-${String((i % 12) + 1).padStart(2, "0")}-01`,
    endDate: `2024-${String((i % 12) + 1).padStart(2, "0")}-28`,
    status: "completed" as const,
  })),
  skills: [
    { id: "s1", name: "用户研究", level: "advanced" },
    { id: "s2", name: "深度访谈", level: "advanced" },
    { id: "s3", name: "问卷设计", level: "advanced" },
    { id: "s4", name: "数据分析", level: "intermediate" },
  ],
};

const result = matchJob(urProfile, kuaishouJob);

console.log("Score:", result.score, result.skillMatch, result.experienceMatch);
console.log("Matched:", result.matchedSkills);
console.log("Missing:", result.missingSkills);
console.log("Recommendation:", result.recommendation);

const hasNoise = result.missingSkills.some((s) =>
  /岗位职责|围绕商业化/.test(s)
);
const hasExpMatched = result.matchedSkills.some((s) => /用研|用户研究/.test(s));
const hasEduMatched = result.matchedSkills.some((s) => /传播学/.test(s));

if (result.score < 60) {
  console.error("FAIL: score too low", result.score);
  process.exit(1);
}
if (hasNoise) {
  console.error("FAIL: noise in missing skills", result.missingSkills);
  process.exit(1);
}
if (!hasExpMatched) {
  console.error("FAIL: UR experience not matched");
  process.exit(1);
}
if (!hasEduMatched) {
  console.error("FAIL: communication major not matched");
  process.exit(1);
}

console.log("OK: matching logic verified");
