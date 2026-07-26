import { findMatchedProjectsDetailed } from "../src/lib/project-job-match";
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
      description: "快消与教育行业市场研究",
      achievements: [],
      skills: ["问卷", "深访"],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "XTS决策链路",
      description: "互联网",
      technologies: ["深访"],
      highlights: ["WK20 完成20组深访", "WK21 输出决策链路报告"],
      workSummary: "负责XTS决策链路深访与报告输出",
      workExperienceId: "w-yuan",
      startDate: "2024-04-01",
    },
    {
      id: "p2",
      name: "AI功能需求",
      description: "互联网",
      technologies: ["问卷"],
      highlights: ["WK22 问卷迭代与投放", "WK23 回收数据分析"],
      workSummary: "负责AI功能问卷调研",
      workExperienceId: "w-yuan",
      startDate: "2024-05-01",
    },
    {
      id: "p3",
      name: "玉泽医美项目",
      description: "医美",
      technologies: ["问卷"],
      highlights: ["WK18 final数据读数", "WK19 问卷分析"],
      workSummary: "负责玉泽医美问卷与数据读数",
      workExperienceId: "w-rt",
      startDate: "2022-06-01",
    },
    {
      id: "p4",
      name: "高思目标客群下探研究",
      description: "教育",
      technologies: ["深访", "问卷"],
      highlights: ["WK16 深访6组", "WK17 输出洞察报告"],
      workSummary: "负责高思客群下探定性定量研究",
      workExperienceId: "w-rt",
      startDate: "2022-03-01",
    },
  ],
  skills: [],
};

const matched = findMatchedProjectsDetailed(profile, kuaishouMainJob);
console.log("Matched count:", matched.length, matched.map((m) => `${m.workExperienceLabel} | ${m.name}`));

if (matched.length < 3) {
  console.error("FAIL: UR 主站岗位应匹配至少 3 个项目，实际", matched.length);
  process.exit(1);
}

const yuanCount = matched.filter((m) => m.workExperienceLabel.includes("猿辅导")).length;
const rtCount = matched.filter((m) => m.workExperienceLabel.includes("瑞拓普")).length;

if (yuanCount < 1) {
  console.error("FAIL: 应包含猿辅导项目");
  process.exit(1);
}
if (rtCount < 1) {
  console.error("FAIL: 应包含瑞拓普项目");
  process.exit(1);
}

const ruleMatch = matchJob(profile, kuaishouMainJob);
if (ruleMatch.matchedProjects.length < 3) {
  console.error("FAIL: matchJob 集成的 matchedProjects 也应 >= 3");
  process.exit(1);
}

console.log("OK: broadened UR matching for 主站 role");
