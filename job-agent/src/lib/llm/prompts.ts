import type { AppData, JobPosting, MatchResult, Profile, Project } from "@/lib/types";
import { getProjectWorkItems, getProjectWorkSummary } from "@/lib/utils";

export interface LlmMatchAnalysis {
  overall: string;
  recommendedProjects: {
    projectName: string;
    workExperience: string;
    outcomeSentence: string;
    resumeBullets: string[];
    matchReasons: string[];
  }[];
  gaps: string[];
  resumeAdvice: string;
}

function formatProjectForLlm(project: Project, profile: Profile): string {
  const workLabel =
    profile.workExperiences.find((e) => e.id === project.workExperienceId)?.company ??
    "未关联";
  const items = getProjectWorkItems(project)
    .slice(0, 8)
    .map((item) => item.replace(/^WK\d{1,2}\s*/i, ""))
    .join("；");
  const summary = getProjectWorkSummary(project);
  return [
    `- 项目：${project.name}`,
    `  所属工作：${workLabel}`,
    `  成果：${summary}`,
    items ? `  具体工作：${items}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMatchAnalysisPrompt(
  profile: Profile,
  job: JobPosting,
  ruleMatch: MatchResult
): { system: string; user: string } {
  const jdText = [
    `岗位：${job.title}`,
    `公司：${job.company}`,
    job.location ? `地点：${job.location}` : "",
    job.salary ? `薪资：${job.salary}` : "",
    "",
    "【职位描述】",
    job.description,
    "",
    job.responsibilities?.length ? `【岗位职责】\n${job.responsibilities.join("\n")}` : "",
    job.requirements?.length ? `【任职要求】\n${job.requirements.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const profileText = [
    profile.summary ? `职业摘要：${profile.summary}` : "",
    "",
    "【工作经历】",
    ...profile.workExperiences.map(
      (e) =>
        `- ${e.company} · ${e.title}（${e.startDate} - ${e.endDate ?? "至今"}）\n  ${e.description.slice(0, 200)}`
    ),
    "",
    "【项目经历】",
    ...profile.projects.slice(0, 30).map((p) => formatProjectForLlm(p, profile)),
    "",
    profile.skills.length
      ? `【技能】${profile.skills.map((s) => s.name).join("、")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const ruleHint = [
    `规则引擎分数：${ruleMatch.score}%（技能 ${ruleMatch.skillMatch}% / 经验 ${ruleMatch.experienceMatch}%）`,
    ruleMatch.matchedSkills.length ? `已匹配：${ruleMatch.matchedSkills.join("；")}` : "",
    ruleMatch.missingSkills.length ? `待补充：${ruleMatch.missingSkills.join("；")}` : "",
    ruleMatch.matchedProjects.length
      ? `规则初筛项目：${ruleMatch.matchedProjects.map((p) => `${p.workExperienceLabel}｜${p.name}`).join("；")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `你是资深职业顾问，帮用户针对特定 JD 挑选最值得写进简历的项目经历。
要求：
1. 只推荐与「该岗位独特要求」高度相关的项目，不要因「问卷/访谈/用户研究」等通用用研技能而推荐所有项目
2. 每个推荐项目必须说明：所属工作、成果一句话、2条简历 bullet、2条与 JD 细节的对口理由
3. 理由必须引用 JD 与项目中的具体词（行业、客户、交付物、工具），避免空泛
4. 最多推荐 4 个项目，按相关度排序
5. 仅返回 JSON，不要 markdown 包裹`;

  const user = `${jdText}

---

${profileText}

---

${ruleHint}

---

请输出 JSON：
{
  "overall": "100字以内整体评价",
  "recommendedProjects": [
    {
      "projectName": "项目名（必须与上面项目列表一致）",
      "workExperience": "公司 · 职位",
      "outcomeSentence": "成果一句话",
      "resumeBullets": ["简历 bullet 1", "简历 bullet 2"],
      "matchReasons": ["与 JD 具体对口理由 1", "理由 2"]
    }
  ],
  "gaps": ["与 JD 相比仍缺什么，最多3条"],
  "resumeAdvice": "投递该岗位时简历怎么组织，80字以内"
}`;

  return { system, user };
}

export function buildAgentChatPrompt(data: AppData, userMessage: string): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const profile = data.profile;
  const system = `你是 JobAgent 职业顾问，基于用户档案回答问题。用中文，结构清晰，给出可执行的简历/求职建议。
用户档案摘要：
- 姓名：${profile.name || "未填"}
- 工作 ${profile.workExperiences.length} 段，项目 ${profile.projects.length} 个，技能 ${profile.skills.length} 项
- 关注岗位 ${data.jobs.length} 个
${profile.summary ? `- 摘要：${profile.summary}` : ""}`;

  const recent = data.chatHistory.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return {
    system,
    messages: [...recent, { role: "user" as const, content: userMessage }],
  };
}
