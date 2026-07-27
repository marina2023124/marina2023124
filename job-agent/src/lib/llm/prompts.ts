import type { AppData, JobPosting, MatchResult, MatchedProject, Profile, Project } from "@/lib/types";
import { getWorkExperienceLabel, groupProjectsByWorkExperience } from "@/lib/project-work-link";
import { isContentPlatformProject } from "@/lib/project-job-match";
import { getProjectWorkItems, getProjectWorkSummary } from "@/lib/utils";

export interface LlmMatchedProjectItem {
  projectName: string;
  workExperience: string;
  summary: string;
  reasons: string[];
}

export interface LlmMatchAnalysis {
  overall: string;
  /** AI 精准匹配的项目列表（对应页面「匹配项目经历」） */
  matchedProjects: LlmMatchedProjectItem[];
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

export function normalizeLlmMatchedProjects(
  profile: Profile,
  items: LlmMatchedProjectItem[] | undefined
): MatchedProject[] {
  if (!items?.length) return [];

  const byName = new Map(profile.projects.map((project) => [project.name, project]));
  const results: MatchedProject[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const project = byName.get(item.projectName);
    if (!project || seen.has(project.id)) continue;

    const linkedLabel = project.workExperienceId
      ? getWorkExperienceLabel(project.workExperienceId, profile.workExperiences)
      : undefined;

    results.push({
      id: project.id,
      name: project.name,
      summary: item.summary?.trim() || getProjectWorkSummary(project),
      reasons: item.reasons.map((reason) => reason.replace(/^[·•]\s*/, "").trim()).filter(Boolean).slice(0, 3),
      workExperienceLabel: item.workExperience || linkedLabel || "未关联工作",
      workExperienceId: project.workExperienceId,
    });
    seen.add(project.id);
  }

  return results;
}

function groupRuleMatchedByWork(ruleMatch: MatchResult): Map<string, MatchedProject[]> {
  const buckets = new Map<string, MatchedProject[]>();
  const order: string[] = [];

  for (const project of ruleMatch.matchedProjects) {
    const label = project.workExperienceLabel || "未关联工作";
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(project);
  }

  const ordered = new Map<string, MatchedProject[]>();
  for (const label of order) {
    ordered.set(label, buckets.get(label)!);
  }
  return ordered;
}

function countProjectsForWorkExp(projects: MatchedProject[], workLabel: string): number {
  const company = workLabel.split(" · ")[0]?.trim();
  return projects.filter((item) => {
    if (item.workExperienceLabel === workLabel) return true;
    return Boolean(company && item.workExperienceLabel.includes(company));
  }).length;
}

const MIN_PROJECTS_PER_WORK = 2;
const MAX_PROJECTS_PER_WORK = 4;

/** 将规则初筛中每段工作下的相关项目合并进 LLM 结果（不只补 1 个） */
function mergeMatchedProjectsWithRuleEngine(
  llmMatched: MatchedProject[],
  ruleMatch: MatchResult,
  profile: Profile
): MatchedProject[] {
  if (!ruleMatch.matchedProjects.length) return llmMatched;

  const result = [...llmMatched];
  const coveredIds = new Set(result.map((item) => item.id));
  const ruleByWork = groupRuleMatchedByWork(ruleMatch);

  const workLabels: string[] = profile.workExperiences.map((exp) => `${exp.company} · ${exp.title}`);
  for (const label of Array.from(ruleByWork.keys())) {
    if (!workLabels.includes(label)) workLabels.push(label);
  }

  for (const label of workLabels) {
    const ruleProjects = ruleByWork.get(label);
    if (!ruleProjects?.length) continue;

    const currentCount = countProjectsForWorkExp(result, label);
    const targetCount = Math.min(MAX_PROJECTS_PER_WORK, ruleProjects.length);
    if (currentCount >= targetCount) continue;

    for (const ruleProject of ruleProjects) {
      if (countProjectsForWorkExp(result, label) >= targetCount) break;
      if (coveredIds.has(ruleProject.id)) continue;
      result.push(ruleProject);
      coveredIds.add(ruleProject.id);
    }
  }

  return sortMatchedProjectsByProfileWorkOrder(result, profile);
}

function isContentPlatformJobPosting(job: JobPosting): boolean {
  const text = [job.title, job.company, job.description].join("\n");
  return /主站|内容社区|短视频|视频|社区|创作|feed|UGC|快手/i.test(text);
}

/** 内容平台岗位：强制保留小红书/社媒类项目，避免 AI 只写教育行业经历 */
function injectContentPlatformProjects(
  matched: MatchedProject[],
  profile: Profile,
  job: JobPosting,
  ruleMatch: MatchResult
): MatchedProject[] {
  if (!isContentPlatformJobPosting(job)) return matched;

  const profileById = new Map(profile.projects.map((project) => [project.id, project]));
  const hasPlatform = matched.some((item) => {
    const project = profileById.get(item.id);
    return project ? isContentPlatformProject(project) : /小红书|抖音|社媒|内容社区/i.test(item.name);
  });
  if (hasPlatform) return matched;

  const result = [...matched];
  const coveredIds = new Set(result.map((item) => item.id));

  for (const ruleProject of ruleMatch.matchedProjects) {
    const project = profileById.get(ruleProject.id);
    if (!project || !isContentPlatformProject(project) || coveredIds.has(ruleProject.id)) continue;
    result.unshift(ruleProject);
    coveredIds.add(ruleProject.id);
    break;
  }

  if (
    result.some((item) => {
      const project = profileById.get(item.id);
      return project && isContentPlatformProject(project);
    })
  ) {
    return result.slice(0, 12);
  }

  for (const project of profile.projects) {
    if (!isContentPlatformProject(project) || coveredIds.has(project.id)) continue;

    const linkedLabel = project.workExperienceId
      ? getWorkExperienceLabel(project.workExperienceId, profile.workExperiences)
      : undefined;
    const brand = project.name.match(/小红书|抖音|B站|微博|知乎/)?.[0] ?? "内容平台";

    result.unshift({
      id: project.id,
      name: project.name,
      summary: getProjectWorkSummary(project),
      reasons: [
        `JD 为内容社区/主站方向，项目服务「${brand}」同类平台，与岗位产品场景高度对标，建议重点写入`,
      ],
      workExperienceLabel: linkedLabel ?? "未关联工作",
      workExperienceId: project.workExperienceId,
    });
    break;
  }

  return result.slice(0, 12);
}

function filterContradictoryGaps(gaps: string[], profile: Profile): string[] {
  if (!profile.projects.some(isContentPlatformProject)) return gaps;
  return gaps.filter((gap) => !/无.*短视频|无.*社交产品|缺少.*(?:短视频|社交|内容平台).*行业/i.test(gap));
}

function sortMatchedProjectsByProfileWorkOrder(
  projects: MatchedProject[],
  profile: Profile
): MatchedProject[] {
  const order = profile.workExperiences.map((exp) => `${exp.company} · ${exp.title}`);
  const rank = new Map(order.map((label, index) => [label, index]));

  return [...projects].sort((a, b) => {
    const aRank = rank.get(a.workExperienceLabel) ?? 999;
    const bRank = rank.get(b.workExperienceLabel) ?? 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

/** 补全 LLM 结果：跨工作经历覆盖 matchedProjects 与 recommendedProjects */
export function ensureCrossWorkExperienceCoverage(
  analysis: LlmMatchAnalysis,
  profile: Profile,
  ruleMatch: MatchResult,
  job: JobPosting
): LlmMatchAnalysis & { normalizedMatchedProjects: MatchedProject[] } {
  const normalizedMatchedProjects = injectContentPlatformProjects(
    mergeMatchedProjectsWithRuleEngine(
      normalizeLlmMatchedProjects(profile, analysis.matchedProjects),
      ruleMatch,
      profile
    ),
    profile,
    job,
    ruleMatch
  );

  if (!ruleMatch.matchedProjects.length) {
    return {
      ...analysis,
      gaps: filterContradictoryGaps(analysis.gaps ?? [], profile),
      matchedProjects: analysis.matchedProjects ?? [],
      normalizedMatchedProjects,
    };
  }

  const recommended = [...(analysis.recommendedProjects ?? [])];
  const coveredNames = new Set(recommended.map((item) => item.projectName));
  const ruleByWork = groupRuleMatchedByWork(ruleMatch);

  for (const [label, candidates] of Array.from(ruleByWork.entries())) {
    const company = label.split(" · ")[0]?.trim() ?? "";
    const currentCount = recommended.filter(
      (item) => item.workExperience === label || (company && item.workExperience.includes(company))
    ).length;
    const targetCount = Math.min(MIN_PROJECTS_PER_WORK, candidates.length);

    if (currentCount >= targetCount) continue;

    for (const top of candidates) {
      const count = recommended.filter(
        (item) => item.workExperience === label || (company && item.workExperience.includes(company))
      ).length;
      if (count >= targetCount) break;
      if (coveredNames.has(top.name)) continue;

      recommended.push({
        projectName: top.name,
        workExperience: top.workExperienceLabel,
        outcomeSentence: top.summary,
        resumeBullets: top.reasons.slice(0, 2).map((reason) => reason.replace(/^[·•]\s*/, "")),
        matchReasons: top.reasons.slice(0, 3),
      });
      coveredNames.add(top.name);
    }
  }

  return {
    ...analysis,
    matchedProjects: analysis.matchedProjects ?? [],
    recommendedProjects: recommended,
    gaps: filterContradictoryGaps(analysis.gaps ?? [], profile),
    normalizedMatchedProjects,
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

  const system = `你是资深职业顾问，帮用户针对特定 JD 分析项目经历匹配度并挑选简历素材。

硬性要求：
1. 必须审视用户全部 ${workExpCount} 段工作经历及其下所有项目，不可只分析最近一份工作的项目
2. matchedProjects：列出与 JD 真正相关的全部核心项目（最多 12 个）。规则初筛按工作分组的结果务必重点参考——若某段工作（如瑞拓普）下有多项相关项目，须尽量全部列入，不可只写最近一份工作（如猿辅导）的项目
3. 投递快手/字节等内容平台岗位时，咨询项目中服务「小红书/抖音/B站」等同类平台的经历是核心亮点，必须优先列入 matchedProjects 与 recommendedProjects
4. 当多段工作都有相关项目时，matchedProjects 每段至少 2 个（该段不足 2 个则全写），recommendedProjects 每段至少 1 个
4. 每条 reason 必须引用 JD 中的具体要求 + 项目中的具体交付/客户/行业/工具，禁止空泛理由（如仅写「用户研究能力」「商业化业务研究」）
5. recommendedProjects：从 matchedProjects 中精选最值得写进简历的项目（最多 6 个），附 2 条 resume bullet
6. projectName 必须与上面项目列表中的名称完全一致
7. 仅返回 JSON，不要 markdown 包裹`;

  const user = `${jdText}

---

${profileText}

---

${ruleHint}

---

请输出 JSON：
{
  "overall": "100字以内整体评价，需提及多段工作中的匹配亮点（若有）",
  "matchedProjects": [
    {
      "projectName": "项目名（必须与上面项目列表一致）",
      "workExperience": "公司 · 职位",
      "summary": "成果一句话",
      "reasons": ["与 JD 具体对口理由 1", "理由 2"]
    }
  ],
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

export function buildProjectSummariesPrompt(projects: Project[]): { system: string; user: string } {
  const projectBlocks = projects
    .map((project) => {
      const items = getProjectWorkItems(project).slice(0, 12);
      return [
        `【${project.id}】${project.name}`,
        project.description ? `背景：${project.description}` : "",
        (project.technologies ?? []).length
          ? `方法/技能：${(project.technologies ?? []).join("、")}`
          : "",
        items.length ? `任务明细：\n${items.map((item) => `  - ${item}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const system = `你是资深用户研究/市场研究顾问，帮用户把周报任务明细整理成适合写进简历的「项目经历总结」。

要求：
1. 每个项目输出 1 句 workSummary（40-80 字），突出行业/客户、研究方法、核心交付与业务价值
2. 用第三人称或「负责…」句式，不要罗列 WK 编号或「已达成/未达成」等周报状态词
3. 保留可量化成果（样本量、组数、报告类型等），但合并同类任务，避免流水账
4. 若任务明细较少，根据项目名称合理推断研究类型，但不要编造具体数字
5. 仅返回 JSON，不要 markdown 包裹`;

  const user = `请为以下 ${projects.length} 个项目各生成一句 resume-ready 的项目总结：

${projectBlocks}

返回 JSON：
{
  "summaries": [
    { "id": "项目id（必须与上方【】内一致）", "workSummary": "一句话项目总结" }
  ]
}`;

  return { system, user };
}

export interface LlmWeeklyParseResult {
  weekLabel?: string;
  projects: { name: string; priority?: string; tasks: string[] }[];
}

export function buildWeeklyReportParsePrompt(text: string): { system: string; user: string } {
  const system = `你是工作周报解析助手，从周报/工作记录中提取项目条目。

要求：
1. 识别 WK 编号（如 WK30）作为 weekLabel
2. 每条 P0/P1/P-1/P2 或「项目名：任务」行提取为一个项目；同名项目合并 tasks
3. tasks 只保留实质工作（访问人数、问卷、报告、深访等），去掉「已达成/未达成/原计划→」等状态词
4. priority 保留 P0/P1/P-1 等标签
5. 忽略「本周目标」「下周计划」等标题行本身
6. project name 不要包含【被动调整】【新增高优】等状态标签；priority 字段保留 P0/P1
7. 单独的「内容」「软件」分支任务归入「产品战略分析」，不要单独建项目
8. 「评论智能体搭建」与「智能体搭建」视为同一项目，统一为「智能体搭建」
9. 仅返回 JSON，不要 markdown 包裹`;

  const user = `请解析以下周报文本：

${text.slice(0, 12000)}

返回 JSON：
{
  "weekLabel": "WK30",
  "projects": [
    {
      "name": "项目名称",
      "priority": "P0",
      "tasks": ["实质工作内容 1", "实质工作内容 2"]
    }
  ]
}`;

  return { system, user };
}

export function buildAgentChatPrompt(data: AppData, userMessage: string): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const profile = data.profile;
  const isResumeUpload = /【已上传简历：/.test(userMessage);
  const system = `你是 JobAgent 职业顾问，基于用户档案回答问题。用中文，结构清晰，给出可执行的简历/求职建议。
回复请使用 Markdown 格式（标题、加粗、列表），便于阅读。
用户档案摘要：
- 姓名：${profile.name || "未填"}
- 工作 ${profile.workExperiences.length} 段，项目 ${profile.projects.length} 个，技能 ${profile.skills.length} 项
- 关注岗位 ${data.jobs.length} 个
${profile.summary ? `- 摘要：${profile.summary}` : ""}
${isResumeUpload ? "\n用户刚上传了简历全文。请逐段给出优化建议：结构层次、措辞表达、量化成果、与目标岗位的匹配度；按优先级排列，并给出可直接替换的改写示例。" : ""}`;

  const recent = data.chatHistory.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return {
    system,
    messages: [...recent, { role: "user" as const, content: userMessage }],
  };
}
