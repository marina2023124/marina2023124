import type { JdRequirementMatch, JobPosting, Profile, Project } from "./types";
import { getJobSections } from "./job-sections";
import { getProjectWorkItems, getProjectWorkSummary } from "./utils";
import {
  findWorkExperienceForProject,
  formatWorkExperienceTag,
  getWorkExperienceLabel,
} from "./project-work-link";

const GENERIC_TERMS = new Set([
  "用户研究",
  "用研",
  "调研",
  "访谈",
  "深访",
  "问卷",
  "定性",
  "定量",
  "报告",
  "洞察",
  "分析",
  "研究",
  "能力",
  "经验",
  "工作",
  "负责",
  "完成",
  "进行",
  "开展",
  "数据",
  "用户",
  "客户",
  "需求",
  "方案",
  "设计",
  "执行",
  "优化",
  "支持",
  "协助",
  "参与",
  "配合",
  "业务",
  "场景",
  "功能",
  "测试",
  "沟通",
  "协调",
  "推进",
  "撰写",
  "输出",
  "交付",
  "项目",
  "相关",
  "工具",
  "AI",
  "大模型",
  "智能体",
  "agent",
]);

const LINE_SIGNALS: { label: string; keywords: RegExp }[] = [
  { label: "社媒聆听", keywords: /社媒聆听|社交媒体|舆情|声量/i },
  { label: "品牌声誉", keywords: /品牌声誉|品牌形象|品牌认知|品牌健康/i },
  { label: "消费者洞察", keywords: /消费者洞察|消费洞察|用户洞察|人群洞察/i },
  { label: "营销效果", keywords: /营销效果|投放效果|广告效果|ROI|转化/i },
  { label: "品牌营销", keywords: /品牌营销|品牌传播|品牌策略|品牌定位/i },
  { label: "快消零售", keywords: /快消|零售|FMCG|消费品类/i },
  { label: "新品规划", keywords: /新品|上市|产品规划|概念测试|产品线/i },
  { label: "安全合规", keywords: /安全合规|合规|风控|隐私|内容安全/i },
  { label: "电商交易", keywords: /电商|购物|交易|退货|履约|GMV/i },
  { label: "B端企业", keywords: /to\s*b|tob|B端|企业客户|SaaS|企业服务/i },
  { label: "AI工具应用", keywords: /agent|AI工具|大模型|deepseek|豆包|智能体/i },
  { label: "数据运营", keywords: /数据运营|数据敏感|数据挖掘|大数据/i },
  { label: "PPT汇报", keywords: /PPT|演示|汇报|提案/i },
  { label: "Excel分析", keywords: /\bexcel\b/i },
  { label: "统计软件", keywords: /SPSS|Stata|SQL|Python|R语言/i },
  { label: "咨询框架", keywords: /研究框架|研究方案|咨询|框架思维|逻辑框架/i },
  { label: "内容社区", keywords: /内容社区|社区产品|UGC|创作者|笔记|种草|主站/i },
  { label: "短视频", keywords: /短视频|视频消费|视频内容|消费体验/i },
  { label: "独立负责", keywords: /独立负责|全流程|端到端|独立设计/i },
  { label: "定性研究", keywords: /定性|深访|焦点小组|\bFG\b/i },
  { label: "定量研究", keywords: /定量|问卷|样本/i },
];

interface CandidateMatch {
  projectId: string;
  projectName: string;
  workExperienceLabel: string;
  experienceText: string;
  score: number;
  matchedTerms: string[];
  signalLabel?: string;
}

function extractChineseTerms(text: string): string[] {
  return text.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
}

function extractDistinctiveTerms(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of extractChineseTerms(text)) {
    if (GENERIC_TERMS.has(term) || seen.has(term)) continue;
    seen.add(term);
    result.push(term);
  }
  return result;
}

function shorten(text: string, max = 48): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function splitFallbackLines(text: string): string[] {
  return text
    .split(/[\n；;]|(?=\d+[、.．)\]])/)
    .map((s) => s.replace(/^\d+[、.．)\]]\s*/, "").trim())
    .filter((s) => s.length >= 8 && s.length <= 120);
}

export function extractJdRequirementLines(job: JobPosting): {
  text: string;
  category: "responsibility" | "requirement";
}[] {
  const sections = getJobSections(job);
  const lines: { text: string; category: "responsibility" | "requirement" }[] = [];

  for (const text of sections.responsibilities) {
    const trimmed = text.trim();
    if (trimmed.length >= 6) lines.push({ text: trimmed, category: "responsibility" });
  }
  for (const text of sections.requirements) {
    const trimmed = text.trim();
    if (trimmed.length >= 6) lines.push({ text: trimmed, category: "requirement" });
  }

  if (lines.length === 0 && job.description?.trim()) {
    const fallback = splitFallbackLines(job.description);
    for (const text of fallback) {
      lines.push({ text, category: "responsibility" });
    }
  }

  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.text.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveWorkLabel(project: Project, profile: Profile): string {
  if (project.workExperienceId) {
    const label = getWorkExperienceLabel(project.workExperienceId, profile.workExperiences);
    if (label) return label;
  }
  const matched = findWorkExperienceForProject(project, profile.workExperiences);
  return matched ? formatWorkExperienceTag(matched) : "未关联工作";
}

function scoreLineAgainstCandidate(
  jdLine: string,
  jdTerms: string[],
  project: Project,
  workItem: string,
  workLabel: string
): CandidateMatch | null {
  const blob = `${project.name} ${workItem} ${getProjectWorkSummary(project)}`;
  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of jdTerms) {
    if (blob.includes(term)) {
      matchedTerms.push(term);
      score += term.length >= 4 ? 10 : 6;
    }
  }

  let signalLabel: string | undefined;
  for (const signal of LINE_SIGNALS) {
    if (!signal.keywords.test(jdLine)) continue;
    if (signal.keywords.test(blob)) {
      signalLabel = signal.label;
      score += 14;
      break;
    }
  }

  if (score === 0) return null;

  const specificMatches = matchedTerms.filter((t) => t.length >= 3);
  const onlyGeneric = matchedTerms.length === 1 && matchedTerms.every((t) => GENERIC_TERMS.has(t));

  if (onlyGeneric && !signalLabel) return null;

  if (specificMatches.length >= 2) score += 8;
  if (jdLine.length >= 20 && matchedTerms.length >= 3) score += 6;

  return {
    projectId: project.id,
    projectName: project.name,
    workExperienceLabel: workLabel,
    experienceText: shorten(workItem || getProjectWorkSummary(project)),
    score,
    matchedTerms,
    signalLabel,
  };
}

function findBestCandidate(
  jdLine: string,
  profile: Profile
): CandidateMatch | null {
  const jdTerms = extractDistinctiveTerms(jdLine);
  let best: CandidateMatch | null = null;

  for (const project of profile.projects) {
    const workLabel = resolveWorkLabel(project, profile);
    const workItems = getProjectWorkItems(project).map((item) =>
      item.replace(/^WK\d{1,2}\s*/i, "").trim()
    );

    const candidates = workItems.length
      ? workItems
      : [getProjectWorkSummary(project) || project.description || project.name];

    for (const item of candidates) {
      const scored = scoreLineAgainstCandidate(jdLine, jdTerms, project, item, workLabel);
      if (!scored) continue;
      if (!best || scored.score > best.score) best = scored;
    }
  }

  return best;
}

function classifyMatch(jdLine: string, candidate: CandidateMatch | null): JdRequirementMatch["status"] {
  if (!candidate) return "missing";

  const specificCount = candidate.matchedTerms.filter((t) => t.length >= 3).length;
  const hasSignal = Boolean(candidate.signalLabel);

  if (candidate.score >= 24 && (specificCount >= 2 || hasSignal)) return "direct";
  if (candidate.score >= 14 && (specificCount >= 1 || hasSignal)) return "direct";
  if (candidate.score >= 10) return "partial";
  return "missing";
}

function buildNote(
  status: JdRequirementMatch["status"],
  candidate: CandidateMatch | null
): string | undefined {
  if (!candidate) return "暂无相近项目经历，建议补充相关案例或从其他项目迁移表述";
  if (status === "direct") {
    if (candidate.signalLabel) {
      return `与「${candidate.signalLabel}」要求直接对应`;
    }
    if (candidate.matchedTerms.length) {
      return `匹配关键词：${candidate.matchedTerms.slice(0, 4).join("、")}`;
    }
    return undefined;
  }
  if (status === "partial") {
    return `暂无完全对应经历，以下为最相近项目（${candidate.matchedTerms.slice(0, 3).join("、") || candidate.signalLabel || "部分相关"}）`;
  }
  return `匹配度较低，建议参考相近经历或补充新案例`;
}

export function matchJdRequirements(profile: Profile, job: JobPosting): JdRequirementMatch[] {
  const lines = extractJdRequirementLines(job);

  return lines.map((line, index) => {
    const candidate = findBestCandidate(line.text, profile);
    const status = classifyMatch(line.text, candidate);

    return {
      id: `${job.id}-${index}`,
      text: line.text,
      category: line.category,
      status,
      projectName: candidate?.projectName,
      workExperienceLabel: candidate?.workExperienceLabel,
      experienceText: candidate?.experienceText,
      note: buildNote(status, candidate),
    };
  });
}
