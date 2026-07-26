import type { AppData, JobPosting, MatchResult, Profile, Project } from "@/lib/types";
import { groupProjectsByWorkExperience } from "@/lib/project-work-link";
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

function formatProjectForLlm(project: Project): string {
  const items = getProjectWorkItems(project)
    .slice(0, 8)
    .map((item) => item.replace(/^WK\d{1,2}\s*/i, ""))
    .join("；");
  const summary = getProjectWorkSummary(project);
  return [
    `  · ${project.name}`,
    `    成果：${summary}`,
    items ? `    具体工作：${items}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProfileProjectsByWork(profile: Profile): string {
  const groups = groupProjectsByWorkExperience(profile.projects, profile.workExperiences);
  if (!groups.length) return "（暂无项目）";

  return groups
    .map((group) => {
      const header = `【${group.label}】共 ${group.projects.length} 个项目`;
      const body = group.projects.map((p) => formatProjectForLlm(p)).join("\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

function formatRuleMatchedByWork(ruleMatch: MatchResult): string {
  if (!ruleMatch.matchedProjects.length) return "";

  const order: string[] = [];
  const buckets = new Map<string, typeof ruleMatch.matchedProjects>();

  for (const project of ruleMatch.matchedProjects) {
    const label = project.workExperienceLabel || "未关联工作";
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(project);
  }

  return order
    .map((label) => {
      const projects = buckets.get(label)!;
      const lines = projects.map(
        (p) =>
          `  · ${p.name}：${p.summary}${p.reasons[0] ? `（${p.reasons[0]}）` : ""}`
      );
      return `【${label}】规则初筛命中 ${projects.length} 个\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function recommendationCoversWorkExp(
  recommended: LlmMatchAnalysis["recommendedProjects"],
  workLabel: string
): boolean {
  const company = workLabel.split(" · ")[0]?.trim();
  return recommended.some((item) => {
    if (item.workExperience === workLabel) return true;
    if (company && item.workExperience.includes(company)) return true;
    return false;
  });
}

/** 若 LLM 只推荐了最近一份工作，用规则初筛结果补全其他工作经历的相关项目 */
export function ensureCrossWorkExperienceCoverage(
  analysis: LlmMatchAnalysis,
  ruleMatch: MatchResult
): LlmMatchAnalysis {
  if (!ruleMatch.matchedProjects.length) return analysis;

  const recommended = [...analysis.recommendedProjects];
  const coveredNames = new Set(recommended.map((item) => item.projectName));

  const order: string[] = [];
  const buckets = new Map<string, typeof ruleMatch.matchedProjects>();

  for (const project of ruleMatch.matchedProjects) {
    const label = project.workExperienceLabel || "未关联工作";
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(project);
  }

  for (const label of order) {
    if (recommendationCoversWorkExp(recommended, label)) continue;

    const candidates = buckets.get(label)!;
    const top = candidates.find((p) => !coveredNames.has(p.name)) ?? candidates[0];
    if (!top || coveredNames.has(top.name)) continue;

    recommended.push({
      projectName: top.name,
      workExperience: top.workExperienceLabel,
      outcomeSentence: top.summary,
      resumeBullets: top.reasons.slice(0, 2).map((reason) => reason.replace(/^[·•]\s*/, "")),
      matchReasons: top.reasons.slice(0, 3),
    });
    coveredNames.add(top.name);
  }

  return {
    ...analysis,
    recommendedProjects: recommended,
  };
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

  const workExpCount = profile.workExperiences.length;
  const projectGroupCount = groupProjectsByWorkExperience(
    profile.projects,
    profile.workExperiences
  ).length;

  const profileText = [
    profile.summary ? `职业摘要：${profile.summary}` : "",
    "",
    `【工作经历】共 ${workExpCount} 段（必须逐段审视，不可只分析最近一段）`,
    ...profile.workExperiences.map(
      (e) =>
        `- ${e.company} · ${e.title}（${e.startDate} - ${e.endDate ?? "至今"}）\n  ${e.description.slice(0, 300)}`
    ),
    "",
    `【项目经历】按所属工作分组，共 ${projectGroupCount} 段工作有项目`,
    formatProfileProjectsByWork(profile),
    "",
    profile.skills.length
      ? `【技能】${profile.skills.map((s) => s.name).join("、")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const ruleMatchedByWork = formatRuleMatchedByWork(ruleMatch);

  const ruleHint = [
    `规则引擎分数：${ruleMatch.score}%（技能 ${ruleMatch.skillMatch}% / 经验 ${ruleMatch.experienceMatch}%）`,
    ruleMatch.matchedSkills.length ? `已匹配技能：${ruleMatch.matchedSkills.join("；")}` : "",
    ruleMatch.missingSkills.length ? `待补充技能：${ruleMatch.missingSkills.join("；")}` : "",
    ruleMatchedByWork ? `\n【规则初筛 · 按工作分组】\n${ruleMatchedByWork}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const relevantWorkCount = ruleMatchedByWork
    ? new Set(ruleMatch.matchedProjects.map((p) => p.workExperienceLabel)).size
    : projectGroupCount;

  const system = `你是资深职业顾问，帮用户针对特定 JD 挑选最值得写进简历的项目经历。

硬性要求：
1. 必须审视用户全部 ${workExpCount} 段工作经历及其下所有项目，不可只推荐最近一份工作的项目
2. 当规则初筛在多个公司/工作下都有命中项目时，recommendedProjects 必须覆盖每一段有相关项目的工作经历（每段至少 1 个）
3. 只推荐与「该岗位独特要求」高度相关的项目；不要因「问卷/访谈/用户研究」等通用技能而堆砌无关项目
4. 每个推荐项目必须说明：所属工作（公司 · 职位）、成果一句话、2 条简历 bullet、2–3 条与 JD 细节的对口理由
5. 理由必须引用 JD 与项目中的具体词（行业、客户、交付物、工具），避免空泛
6. 最多推荐 6 个项目，按相关度排序；若 ${relevantWorkCount} 段工作都有相关项目，每段至少保留 1 个
7. projectName 必须与上面项目列表中的名称完全一致
8. 仅返回 JSON，不要 markdown 包裹`;

  const user = `${jdText}

---

${profileText}

---

${ruleHint}

---

请输出 JSON：
{
  "overall": "100字以内整体评价，需提及多段工作中的匹配亮点（若有）",
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
  "resumeAdvice": "投递该岗位时简历怎么组织（可建议如何排列多段工作的项目），80字以内"
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
