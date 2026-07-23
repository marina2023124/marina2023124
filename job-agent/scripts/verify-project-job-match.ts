import { findMatchedProjectsDetailed } from "../src/lib/project-job-match";
import { extractJobCriteria } from "../src/lib/job-criteria";
import type { JobPosting, Profile } from "../src/lib/types";

const datastoryJob: JobPosting = {
  id: "job-ba",
  title: "商业分析师（双休）",
  company: "数说故事",
  location: "北京朝阳区",
  salary: "11-20K·14薪",
  experienceYears: 2,
  description: `岗位职责:
1、与客户沟通，了解并细化数据分析需求（社媒聆听、品牌声誉、消费者洞察等）
2、根据业务及行业背景，搭建研究框架，设计研究方案
3、运用内部大数据工具分析数据，评估营销效果，提供解决方案及建议
任职条件:
1、本科及以上学历，有咨询、广告公关或大型企业市场/用户研究背景
2、了解快消及零售行业，数据敏感度高
3、具备数据运营能力，熟练使用 Excel 或至少一种统计软件
4、能独立制作 PPT，逻辑/框架思维强，熟悉品牌营销指标
5、了解并能熟练使用 Agent、豆包或 DeepSeek 等 AI 工具提升效率`,
  requirements: [
    "了解快消及零售行业，数据敏感度高",
    "熟练使用 Excel 或至少一种统计软件",
    "熟悉品牌营销指标",
    "了解并能熟练使用 Agent、豆包或 DeepSeek 等 AI 工具",
  ],
  responsibilities: [
    "与客户沟通，了解并细化数据分析需求（社媒聆听、品牌声誉、消费者洞察等）",
    "根据业务及行业背景，搭建研究框架，设计研究方案",
    "运用内部大数据工具分析数据，评估营销效果，提供解决方案及建议",
  ],
  preferredSkills: [],
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
      id: "w1",
      company: "数说故事",
      title: "商业分析师",
      startDate: "2023-04",
      description: "",
      achievements: [],
      skills: [],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "百度百科品牌Q3",
      description: "品牌 · 定性+定量",
      technologies: ["深度访谈", "问卷设计"],
      highlights: ["WK28 品牌健康度问卷更新", "WK29 完成 6 组品牌认知深访", "WK30 输出 Q3 品牌洞察报告"],
      workSummary: "负责品牌健康度调研，完成问卷更新与深访，输出 Q3 品牌洞察报告",
    },
    {
      id: "p2",
      name: "伊利端午",
      description: "食品 · 定性",
      technologies: ["深度访谈"],
      highlights: ["WK22 端午营销概念组前沟通", "WK23 完成 4 组 FG 了解礼盒偏好"],
      workSummary: "负责伊利端午营销概念测试，完成 FG 与概念评估",
    },
    {
      id: "p3",
      name: "AI功能需求",
      description: "互联网 · 定量",
      technologies: ["问卷设计"],
      highlights: ["WK25 用 Agent 辅助问卷迭代", "WK26 AI 功能可用性问卷投放"],
      workSummary: "负责 AI 功能需求调研，使用 Agent 辅助问卷设计与迭代",
    },
    {
      id: "p4",
      name: "R2新品规划",
      description: "3C · 定性+定量",
      technologies: ["深度访谈", "问卷设计"],
      highlights: ["WK20 新品概念测试问卷", "WK21 完成 8 组目标用户深访"],
      workSummary: "负责 R2 新品概念测试与用户需求研究",
    },
    {
      id: "p5",
      name: "内部流程优化",
      description: "内部",
      technologies: [],
      highlights: ["WK10 整理问卷模板", "WK11 更新访谈提纲"],
      workSummary: "负责内部问卷模板与访谈提纲维护",
    },
  ],
  skills: [],
};

const criteria = extractJobCriteria(datastoryJob);
const matched = findMatchedProjectsDetailed(profile, datastoryJob, criteria);

console.log("Matched count:", matched.length);
for (const m of matched) {
  console.log("-", m.name);
  console.log("  summary:", m.summary);
  console.log("  reasons:", m.reasons);
}

const genericOnly = matched.every((m) =>
  m.reasons.every((r) => /用户研究能力|研究方法与 JD 一致|定性.*定量/.test(r))
);
if (genericOnly) {
  console.error("FAIL: all reasons are generic");
  process.exit(1);
}

const brandProject = matched.find((m) => m.name.includes("百度百科"));
const fmcgProject = matched.find((m) => m.name.includes("伊利"));
const aiProject = matched.find((m) => m.name.includes("AI"));

if (!brandProject) {
  console.error("FAIL: 百度百科品牌Q3 should match (brand/marketing JD)");
  process.exit(1);
}
if (!fmcgProject) {
  console.error("FAIL: 伊利端午 should match (FMCG JD)");
  process.exit(1);
}
if (!aiProject) {
  console.error("FAIL: AI功能需求 should match (AI tools in JD)");
  process.exit(1);
}

const internal = matched.find((m) => m.name.includes("内部流程"));
if (internal) {
  console.error("FAIL: generic internal project should not match");
  process.exit(1);
}

if (matched.length > 5) {
  console.error("FAIL: too many matches", matched.length);
  process.exit(1);
}

console.log("OK: specific project-job matching verified");
