import type { JobPosting, MatchedProject, Profile, Project, WorkExperience } from "./types";
import type { JobCriterion } from "./job-criteria";
import { getProjectWorkItems, getProjectWorkSummary } from "./utils";
import { contextHasSkillKey, getProjectSkillSet, getProjectTextBlob } from "./matching-shared";

interface JobMatchContext {
  direction: string | null;
  themes: { label: string; keywords: RegExp }[];
  responsibilityPhrases: string[];
  blob: string;
  company: string;
  title: string;
}

interface ProjectMatchContext {
  summary: string;
  workItems: string[];
  workBlob: string;
  industryHint: string | null;
  methods: string[];
}

const JOB_THEME_DEFS: { label: string; keywords: RegExp }[] = [
  { label: "安全合规", keywords: /安全合规|合规|风控|隐私|数据安全|内容安全|未成年人|举报|审核/i },
  { label: "商业化", keywords: /商业化|广告|变现|营销|品牌|投放|ROI/i },
  { label: "电商", keywords: /电商|零售|购物|交易|退货|履约|SKU/i },
  { label: "直播短视频", keywords: /直播|短视频|内容消费|创作者|达人/i },
  { label: "企业服务", keywords: /to\s*b|tob|B端|企业端|SaaS|商业客户/i },
  { label: "金融", keywords: /金融|支付|信贷|理财|保险/i },
  { label: "教育", keywords: /教育|学习|课程|培训/i },
  { label: "汽车", keywords: /汽车|出行|车联网|新能源/i },
  { label: "医疗", keywords: /医疗|健康|医药/i },
];

const METHOD_DEFS: { label: string; keywords: RegExp }[] = [
  { label: "定性深访", keywords: /深访|访谈|IDI|FGD|焦点小组|座谈会|可用性/i },
  { label: "定量问卷", keywords: /问卷|调研|抽样|统计分析|大样本/i },
  { label: "数据分析", keywords: /数据分析|读数|tabplan|SPSS|SQL|聚类/i },
  { label: "研究报告", keywords: /报告|洞察|keyfindings|研究结论/i },
  { label: "案头研究", keywords: /案头|desk research/i },
];

function extractDirection(title: string): string | null {
  const bracket = title.match(/【([^】]+)】/);
  if (bracket) return bracket[1].trim();
  const dash = title.match(/[-–—]\s*([^-–—【】]+)$/);
  if (dash && dash[1].length <= 12) return dash[1].trim();
  return null;
}

function buildJobContext(job: JobPosting): JobMatchContext {
  const blob = [
    job.title,
    job.description,
    ...(job.requirements ?? []),
    ...(job.responsibilities ?? []),
    ...(job.preferredSkills ?? []),
  ].join("\n");

  const themes = JOB_THEME_DEFS.filter((t) => t.keywords.test(blob));
  const responsibilityPhrases = (job.responsibilities ?? [])
    .concat(splitPhrases(job.description))
    .map((p) => p.trim())
    .filter((p) => p.length >= 6 && p.length <= 80)
    .slice(0, 8);

  return {
    direction: extractDirection(job.title),
    themes,
    responsibilityPhrases,
    blob,
    company: job.company,
    title: job.title,
  };
}

function splitPhrases(text: string): string[] {
  return text
    .split(/[\n；;。]|(?=\d+[、.])/)
    .map((s) => s.replace(/^\d+[、.．)\]]\s*/, "").trim())
    .filter(Boolean);
}

function stripWeekLabel(text: string): string {
  return text.replace(/^WK\d{1,2}\s*/i, "").trim();
}

function buildProjectContext(
  project: Project,
  workExperience?: WorkExperience
): ProjectMatchContext {
  const workItems = getProjectWorkItems(project).map(stripWeekLabel).filter(Boolean);
  const summary = getProjectWorkSummary(project);
  const workBlob = [project.name, project.description, summary, ...workItems].join(" ");

  const industryHint = inferProjectIndustry(project, workExperience);
  const methods = METHOD_DEFS.filter((m) => m.keywords.test(workBlob)).map((m) => m.label);

  return { summary, workItems, workBlob, industryHint, methods };
}

function inferProjectIndustry(
  project: Project,
  workExperience?: WorkExperience
): string | null {
  const blob = `${project.name} ${project.description} ${workExperience?.company ?? ""} ${workExperience?.description ?? ""}`;
  for (const theme of JOB_THEME_DEFS) {
    if (theme.keywords.test(blob)) return theme.label;
  }
  if (/互联网|科技|平台/i.test(blob)) return "互联网";
  return workExperience?.company ? `${workExperience.company}相关业务` : null;
}

function pickEvidenceSnippet(workItems: string[], keywords: RegExp, maxLen = 28): string | null {
  for (const item of workItems) {
    if (keywords.test(item)) {
      const s = item.length > maxLen ? `${item.slice(0, maxLen)}…` : item;
      return s;
    }
  }
  return null;
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = extractTokens(a);
  const tokensB = extractTokens(b);
  let score = 0;
  for (const t of Array.from(tokensA)) {
    if (tokensB.has(t) && t.length >= 2) score += t.length >= 4 ? 3 : 2;
  }
  return score;
}

function extractTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const segments = text.match(/[\u4e00-\u9fff]{2,8}|[a-zA-Z]{3,}/g) ?? [];
  for (const seg of segments) tokens.add(seg.toLowerCase());
  return tokens;
}

function findBestResponsibilityOverlap(
  responsibilityPhrases: string[],
  workItems: string[]
): { jdPhrase: string; projectSnippet: string; score: number } | null {
  let best: { jdPhrase: string; projectSnippet: string; score: number } | null = null;

  for (const jdPhrase of responsibilityPhrases) {
    for (const item of workItems) {
      const score = tokenOverlapScore(jdPhrase, item);
      if (score >= 4 && (!best || score > best.score)) {
        best = {
          jdPhrase: jdPhrase.length > 36 ? `${jdPhrase.slice(0, 36)}…` : jdPhrase,
          projectSnippet: item.length > 32 ? `${item.slice(0, 32)}…` : item,
          score,
        };
      }
    }
  }
  return best;
}

function matchCriterionToProject(
  project: Project,
  criterion: JobCriterion,
  workItems: string[]
): string | null {
  if (criterion.type !== "skill" || !criterion.skillKey) return null;

  const skills = getProjectSkillSet(project);
  const blob = getProjectTextBlob(project);
  if (!contextHasSkillKey(skills, blob, criterion.skillKey)) return null;

  const evidence = pickEvidenceForSkill(criterion.skillKey, workItems, blob);
  if (evidence) {
    return `项目${evidence}，对应 JD「${criterion.label.replace(/（优先）$/, "")}」要求`;
  }
  return `项目具备${criterion.label.replace(/（优先）$/, "")}相关实践`;
}

function pickEvidenceForSkill(
  skillKey: string,
  workItems: string[],
  blob: string
): string | null {
  const map: Record<string, RegExp> = {
    "qual-quant": /深访|访谈|问卷|定性|定量/,
    qualitative: /深访|访谈|定性|焦点小组/,
    quantitative: /问卷|定量|调研|数据分析/,
    "user-research": /用户研究|用研|调研|访谈|问卷/,
    sql: /sql|数据读数|大样本/,
    tob: /to\s*b|B端|企业|商业客户/,
    excel: /excel/i,
    spss: /spss/i,
  };

  const re = map[skillKey];
  if (!re) return null;

  const snippet = pickEvidenceSnippet(workItems, re);
  if (snippet) return `中开展「${snippet}」`;
  if (re.test(blob)) return "内容涉及相关方法与实践";
  return null;
}

interface ScoredMatch {
  score: number;
  reasons: string[];
}

function scoreProjectAgainstJob(
  project: Project,
  projectCtx: ProjectMatchContext,
  jobCtx: JobMatchContext,
  criteria: JobCriterion[]
): ScoredMatch {
  const reasons: string[] = [];
  let score = 0;

  for (const theme of jobCtx.themes) {
    if (theme.keywords.test(projectCtx.workBlob)) {
      score += 28;
      const snippet =
        pickEvidenceSnippet(projectCtx.workItems, theme.keywords) ??
        pickEvidenceSnippet([project.name, project.description], theme.keywords);
      if (snippet) {
        reasons.push(
          `项目涉及「${snippet}」，与岗位「${jobCtx.direction ?? theme.label}」业务场景相关`
        );
      } else {
        reasons.push(`项目内容与 JD「${theme.label}」方向的研究主题相契合`);
      }
      break;
    }
  }

  if (jobCtx.direction) {
    const dirRe = new RegExp(
      jobCtx.direction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").split(/\s+/).join("|"),
      "i"
    );
    if (dirRe.test(projectCtx.workBlob) || jobCtx.themes.some((t) => t.keywords.test(projectCtx.workBlob))) {
      if (!reasons.some((r) => r.includes(jobCtx.direction!))) {
        score += 18;
        const snippet = pickEvidenceSnippet(projectCtx.workItems, dirRe) ?? projectCtx.workItems[0];
        if (snippet) {
          reasons.push(`「${snippet}」与岗位「${jobCtx.direction}」方向职责直接相关`);
        }
      }
    }
  }

  const respOverlap = findBestResponsibilityOverlap(jobCtx.responsibilityPhrases, projectCtx.workItems);
  if (respOverlap) {
    score += Math.min(35, respOverlap.score * 4);
    reasons.push(
      `JD 要求「${respOverlap.jdPhrase}」，项目中已执行「${respOverlap.projectSnippet}」`
    );
  }

  for (const criterion of criteria.filter((c) => c.type === "skill")) {
    const reason = matchCriterionToProject(project, criterion, projectCtx.workItems);
    if (reason) {
      score += criterion.required ? 22 : 12;
      if (!reasons.includes(reason)) reasons.push(reason);
    }
  }

  if (projectCtx.methods.length > 0 && /研究|调研|分析|访谈|问卷/.test(jobCtx.blob)) {
    const jdMethods = METHOD_DEFS.filter((m) => m.keywords.test(jobCtx.blob)).map((m) => m.label);
    const shared = projectCtx.methods.filter((m) => jdMethods.includes(m));
    if (shared.length > 0) {
      score += 15;
      reasons.push(`研究方法与 JD 一致：${shared.join("、")}`);
    }
  }

  if (projectCtx.industryHint && /互联网|科技|平台|快手|字节|腾讯|阿里/i.test(jobCtx.blob + jobCtx.company)) {
    if (/互联网|直播|短视频|内容/.test(projectCtx.industryHint + projectCtx.workBlob)) {
      score += 10;
      reasons.push(`项目行业背景（${projectCtx.industryHint}）与 ${jobCtx.company} 所在赛道相近`);
    }
  }

  const genericNoise = /^用户研究项目经历$|^涉及 用户研究$|^用户研究能力$/;
  const filtered = reasons.filter((r) => !genericNoise.test(r));

  return {
    score,
    reasons: filtered.slice(0, 3),
  };
}

export function findMatchedProjectsDetailed(
  profile: Profile,
  job: JobPosting,
  criteria: JobCriterion[]
): MatchedProject[] {
  const jobCtx = buildJobContext(job);
  const expById = new Map(profile.workExperiences.map((e) => [e.id, e]));
  const results: (MatchedProject & { score: number })[] = [];

  for (const project of profile.projects) {
    const workExp = project.workExperienceId
      ? expById.get(project.workExperienceId)
      : undefined;
    const projectCtx = buildProjectContext(project, workExp);
    const { score, reasons } = scoreProjectAgainstJob(project, projectCtx, jobCtx, criteria);

    if (score < 18 || reasons.length === 0) continue;

    results.push({
      id: project.id,
      name: project.name,
      summary: projectCtx.summary || project.description || "暂无成果描述",
      reasons,
      score,
    });
  }

  return results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, 8)
    .map(({ score, ...rest }) => {
      void score;
      return rest;
    });
}
