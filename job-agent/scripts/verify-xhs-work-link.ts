import { linkProjectsToWorkExperiences } from "../src/lib/project-work-link";
import { findMatchedProjectsDetailed } from "../src/lib/project-job-match";
import { ensureCrossWorkExperienceCoverage } from "../src/lib/llm/prompts";
import { matchJob } from "../src/lib/matching";
import type { JobPosting, Profile } from "../src/lib/types";

const kuaishouMainJob: JobPosting = {
  id: "job-ks-main",
  title: "用户研究专家 - 【主站】",
  company: "快手",
  location: "北京海淀区",
  salary: "20-40K·16薪",
  description: `【岗位职责】
1、围绕主站内容社区，独立开展定性定量用户研究
2、输出研究报告并推动产品落地

【任职要求】
1、1年以上用研经验，熟练掌握定性、定量研究方法；
2、有sql等大样本数据处理能力优先。`,
  requirements: [
    "1年以上用研经验，熟练掌握定性、定量研究方法",
    "有sql等大样本数据处理能力优先",
  ],
  responsibilities: ["独立开展定性定量用户研究", "输出研究报告并推动产品落地"],
  preferredSkills: ["SQL"],
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
  skills: [],
  workExperiences: [
    {
      id: "w-yuan",
      company: "猿辅导",
      title: "用户研究员",
      startDate: "2023-04",
      description: "教育硬件软件用研",
      achievements: [],
      skills: ["用户研究"],
    },
    {
      id: "w-rt",
      company: "瑞拓普管理咨询有限公司",
      title: "市场研究员",
      startDate: "2021-07",
      endDate: "2023-03",
      description: "快消与互联网社媒研究",
      achievements: [],
      skills: ["问卷", "深访"],
    },
  ],
  projects: [
    {
      id: "xhs",
      name: "小红书美誉度24年Q4",
      description: "互联网 · 社媒 · 定量",
      technologies: ["问卷"],
      highlights: ["问卷编程测试", "报告撰写/修改", "小红书美誉25Q1报告"],
      workSummary: "负责小红书美誉度24年Q4相关研究与问卷工作。",
      workExperienceId: "w-rt",
      startDate: "2024-08",
      endDate: "2025-12",
      status: "ongoing",
    },
    {
      id: "p1",
      name: "高预算用户电话访谈（硬件+软件）",
      description: "教育",
      technologies: ["深访"],
      highlights: ["完成12组深访"],
      workSummary: "深访",
      workExperienceId: "w-yuan",
      startDate: "2024-01",
    },
    {
      id: "p2",
      name: "XTS决策链路",
      description: "互联网",
      technologies: [],
      highlights: ["深访20组"],
      workExperienceId: "w-yuan",
      startDate: "2024-04",
    },
  ],
};

const linked = linkProjectsToWorkExperiences(profile.projects, profile.workExperiences);
const xhs = linked.find((project) => project.id === "xhs");

if (xhs?.workExperienceId !== "w-rt") {
  console.error("FAIL: 手动归属瑞拓普的小红书项目不应被改绑到", xhs?.workExperienceId);
  process.exit(1);
}

const linkedProfile = { ...profile, projects: linked };
const matched = findMatchedProjectsDetailed(linkedProfile, kuaishouMainJob);
const xhsMatch = matched.find((item) => item.name.includes("小红书"));

if (!xhsMatch) {
  console.error("FAIL: 规则匹配应包含小红书项目");
  process.exit(1);
}

if (!xhsMatch.workExperienceLabel.includes("瑞拓普")) {
  console.error("FAIL: 小红书项目应显示在瑞拓普下，实际:", xhsMatch.workExperienceLabel);
  process.exit(1);
}

const ruleMatch = matchJob(linkedProfile, kuaishouMainJob);
const merged = ensureCrossWorkExperienceCoverage(
  {
    overall: "测试",
    matchedProjects: [
      {
        projectName: "高预算用户电话访谈（硬件+软件）",
        workExperience: "猿辅导 · 用户研究员",
        summary: "深访",
        reasons: ["教育深访"],
      },
    ],
    recommendedProjects: [],
    gaps: ["无短视频/社交产品行业经验"],
    resumeAdvice: "",
  },
  linkedProfile,
  ruleMatch,
  kuaishouMainJob
);

if (!merged.normalizedMatchedProjects.some((item) => item.name.includes("小红书"))) {
  console.error("FAIL: AI 合并后应强制注入小红书项目");
  process.exit(1);
}

if (merged.gaps.some((gap) => /无.*短视频|无.*社交产品/.test(gap))) {
  console.error("FAIL: 已有社媒项目时不应保留「无短视频/社交产品行业经验」类 gap");
  process.exit(1);
}

console.log("OK: 小红书项目保留瑞拓普归属并在匹配结果中强制展示");
