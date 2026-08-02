import type { AppData } from "./types";
import { defaultAppData } from "./types";

/** 访客体验用的示例数据（仅写入本机浏览器，不上传云端） */
export function createDemoAppData(): AppData {
  const base = defaultAppData();
  return {
    ...base,
    profile: {
      ...base.profile,
      name: "体验用户",
      email: "demo@example.com",
      summary:
        "5年用户研究与商业分析经验，擅长混合方法研究、竞品洞察与产品策略支持。",
      targetRoles: ["用户研究员", "用户研究专家", "产品研究员"],
      targetIndustries: ["互联网", "内容平台"],
      preferredLocations: ["北京"],
      workExperiences: [
        {
          id: "demo-w1",
          company: "某互联网公司",
          title: "用户研究员",
          startDate: "2021-03",
          endDate: undefined,
          location: "北京",
          description: "负责 C 端产品用户洞察与体验优化研究",
          achievements: ["主导 10+ 定性/定量研究项目", "输出可落地的产品建议"],
          skills: ["用户访谈", "问卷设计", "SPSS", "SQL"],
        },
      ],
      skills: [
        { id: "demo-s1", name: "用户访谈", level: "advanced" },
        { id: "demo-s2", name: "问卷设计", level: "advanced" },
        { id: "demo-s3", name: "SPSS", level: "intermediate" },
        { id: "demo-s4", name: "竞品分析", level: "advanced" },
      ],
      projects: [
        {
          id: "demo-p1",
          name: "内容平台用户增长研究",
          description: "混合方法研究，识别新用户留存关键驱动因素",
          technologies: ["访谈", "问卷", "数据分析"],
          highlights: ["完成 20+ 深访", "输出 3 条产品策略建议"],
          workExperienceId: "demo-w1",
        },
      ],
      educations: [
        {
          id: "demo-e1",
          school: "某大学",
          degree: "硕士",
          field: "心理学",
          startDate: "2016-09",
          endDate: "2019-06",
        },
      ],
    },
    jobs: [
      {
        id: "demo-j1",
        title: "用户研究分析师",
        company: "字节跳动",
        location: "北京",
        workAddress: "北京-海淀区",
        salary: "15-30K·15薪",
        experienceYears: 1,
        platformExperienceLabel: "1-8年",
        industry: "互联网",
        source: "liepin",
        url: "https://www.liepin.com/job/1984054575.shtml",
        status: "saved",
        createdAt: new Date().toISOString(),
        description: "示例岗位，用于演示猎聘链接导入与匹配功能。",
        requirements: ["1年及以上用户研究经验", "熟悉 SPSS/SQL 者优先"],
        responsibilities: ["独立支持业务用研项目", "输出可落地洞察报告"],
        preferredSkills: ["用户研究", "SPSS", "SQL"],
        jobIntro: "方向：用户研究",
      },
    ],
    chatHistory: [],
  };
}
