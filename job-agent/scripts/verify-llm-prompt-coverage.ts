import {
  buildMatchAnalysisPrompt,
  ensureCrossWorkExperienceCoverage,
  normalizeLlmMatchedProjects,
} from "../src/lib/llm/prompts";
import { matchJob } from "../src/lib/matching";
import type { JobPosting, Profile } from "../src/lib/types";

const job: JobPosting = {
  id: "job-1",
  title: "用户研究专家",
  company: "洪恩",
  description: "儿童教育产品用户研究，定性定量，PPT汇报，SQL",
  requirements: ["用户研究", "PPT", "儿童教育"],
  preferredSkills: ["SQL"],
  responsibilities: ["开展用户研究", "输出报告"],
  status: "saved",
  createdAt: new Date().toISOString(),
};

const profile: Profile = {
  name: "测试",
  email: "",
  summary: "",
  targetRoles: [],
  targetIndustries: [],
  preferredLocations: [],
  educations: [],
  workExperiences: [
    {
      id: "w-yuan",
      company: "猿辅导",
      title: "用户研究员",
      startDate: "2023-04",
      description: "儿童教育硬件软件用研",
      achievements: [],
      skills: ["用户研究"],
    },
    {
      id: "w-rt",
      company: "瑞拓普管理咨询有限公司",
      title: "市场研究员",
      startDate: "2021-07",
      endDate: "2023-03",
      description: "快消与教育行业市场研究",
      achievements: [],
      skills: ["问卷", "深访"],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "R2新品规划",
      description: "3C",
      technologies: ["深访"],
      highlights: ["WK20 新品测试"],
      workSummary: "负责 R2 新品用户研究",
      workExperienceId: "w-yuan",
      startDate: "2024-04-01",
    },
    {
      id: "p2",
      name: "高思目标客群下探研究",
      description: "教育",
      technologies: ["问卷", "深访"],
      highlights: ["WK18 线下汇报", "WK19 客群下探问卷"],
      workSummary: "负责高思目标客群下探研究与线下汇报",
      workExperienceId: "w-rt",
      startDate: "2022-06-01",
    },
  ],
  skills: [],
};

const ruleMatch = matchJob(profile, job);
const prompt = buildMatchAnalysisPrompt(profile, job, ruleMatch);

if (!prompt.user.includes("瑞拓普管理咨询有限公司")) {
  console.error("FAIL: prompt missing 瑞拓普 work experience");
  process.exit(1);
}
if (!prompt.user.includes("高思目标客群下探研究")) {
  console.error("FAIL: prompt missing 瑞拓普 project");
  process.exit(1);
}
if (!prompt.system.includes("matchedProjects")) {
  console.error("FAIL: prompt missing matchedProjects instruction");
  process.exit(1);
}
if (!prompt.user.includes('"matchedProjects"')) {
  console.error("FAIL: prompt JSON schema missing matchedProjects");
  process.exit(1);
}

const normalized = normalizeLlmMatchedProjects(profile, [
  {
    projectName: "R2新品规划",
    workExperience: "猿辅导 · 用户研究员",
    summary: "新品研究",
    reasons: ["JD 要求儿童教育相关研究"],
  },
]);
if (normalized.length !== 1 || normalized[0]?.name !== "R2新品规划") {
  console.error("FAIL: normalizeLlmMatchedProjects");
  process.exit(1);
}

const llmOnlyYuanfudao = ensureCrossWorkExperienceCoverage(
  {
    overall: "猿辅导经历匹配",
    matchedProjects: [
      {
        projectName: "R2新品规划",
        workExperience: "猿辅导 · 用户研究员",
        summary: "新品研究",
        reasons: ["a"],
      },
    ],
    recommendedProjects: [
      {
        projectName: "R2新品规划",
        workExperience: "猿辅导 · 用户研究员",
        outcomeSentence: "新品研究",
        resumeBullets: ["a"],
        matchReasons: ["b"],
      },
    ],
    gaps: [],
    resumeAdvice: "",
  },
  profile,
  ruleMatch
);

const hasRuituopuMatched = llmOnlyYuanfudao.normalizedMatchedProjects.some(
  (p) => p.workExperienceLabel.includes("瑞拓普") || p.name.includes("高思")
);
const hasRuituopuRecommended = llmOnlyYuanfudao.recommendedProjects.some(
  (p) => p.workExperience.includes("瑞拓普") || p.projectName.includes("高思")
);

if (
  !hasRuituopuMatched &&
  ruleMatch.matchedProjects.some((p) => p.workExperienceLabel.includes("瑞拓普"))
) {
  console.error("FAIL: should backfill 瑞拓普 in matchedProjects");
  process.exit(1);
}

if (
  !hasRuituopuRecommended &&
  ruleMatch.matchedProjects.some((p) => p.workExperienceLabel.includes("瑞拓普"))
) {
  console.error("FAIL: should backfill 瑞拓普 in recommendedProjects");
  process.exit(1);
}

console.log("OK: LLM matched projects prompt and coverage");
