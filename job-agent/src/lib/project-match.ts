import { mergeWeeklyHighlights, normalizeProjectName, normalizeTaskHighlight } from "./project-name";

/** 不是项目名称的周报元信息标题 */
export const NON_PROJECT_META_NAMES = new Set(["计划", "卡点"]);

const PROJECT_KEYWORDS: Record<string, string[]> = {
  "R2新品规划": ["PSM", "弹性", "雷达图", "思维拓展", "R2", "新品规划"],
  "XTS决策链路": ["XTS", "决策链路", "种草", "比选"],
  "硬件PSM": ["硬件", "ABtest", "金数据"],
  "内容PSM": ["内容PSM", "价格段"],
  "智能体搭建": ["智能体", "agent", "codex", "cursor", "评论"],
  "线下WBR": ["线下WBR", "线下调研", "WBR"],
  "产品战略分析": ["产品战略", "学而思", "讯飞", "作业帮", "课程内容", "呈现分析", "软件", "竞品", "AI老师", "AI教师"],
  "AI功能需求": ["AI功能", "雷达图问卷", "总结表"],
  "高价品WBR": ["高价品", "WBR"],
};

const PROJECT_BRANCH_ALIASES: Record<string, string> = {
  内容: "产品战略分析",
  软件: "产品战略分析",
  评论智能体搭建: "智能体搭建",
};

const CANONICAL_PROJECT_RULES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^R2新品规划/i, name: "R2新品规划" },
  { pattern: /^AI功能需求/i, name: "AI功能需求" },
  { pattern: /^XTS决策链路/i, name: "XTS决策链路" },
  { pattern: /^硬件PSM/i, name: "硬件PSM" },
  { pattern: /^内容PSM/i, name: "内容PSM" },
  { pattern: /^评论智能体/i, name: "智能体搭建" },
  { pattern: /^智能体搭建/i, name: "智能体搭建" },
  { pattern: /^线下WBR/i, name: "线下WBR&线下调研" },
  { pattern: /^产品战略分析/i, name: "产品战略分析" },
  { pattern: /^高价品WBR/i, name: "高价品WBR" },
  { pattern: /^小猿AI/i, name: "小猿AIx学练机" },
  { pattern: /^S6抖音/i, name: "S6抖音自播退货" },
  { pattern: /^MAU老用户/i, name: "MAU老用户占比" },
];

/** 将「R2新品规划PSM+弹性测试」等变体统一为 canonical 项目名 */
export function canonicalProjectName(name: string): string {
  const normalized = normalizeProjectName(name);
  if (PROJECT_BRANCH_ALIASES[normalized]) {
    return PROJECT_BRANCH_ALIASES[normalized];
  }
  for (const rule of CANONICAL_PROJECT_RULES) {
    if (rule.pattern.test(normalized)) return rule.name;
  }
  return normalized;
}

/** 判断两个项目名是否应合并为同一项目 */
export function projectsShouldMerge(a: string, b: string): boolean {
  const ca = canonicalProjectName(a).toLowerCase();
  const cb = canonicalProjectName(b).toLowerCase();
  if (ca === cb) return true;

  const na = normalizeProjectName(a).toLowerCase();
  const nb = normalizeProjectName(b).toLowerCase();
  if (na === nb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 6 && longer.startsWith(shorter)) return true;

  let shared = 0;
  while (shared < na.length && shared < nb.length && na[shared] === nb[shared]) shared++;
  return shared >= 6;
}

export function isNonProjectMetaName(name: string): boolean {
  return NON_PROJECT_META_NAMES.has(normalizeProjectName(name));
}

/** 判断一段文字是否描述某个项目（用于计划/卡点归属） */
export function contentMatchesProject(content: string, projectName: string): boolean {
  const text = content.trim();
  const name = normalizeProjectName(projectName);
  if (!text || !name) return false;
  if (text.includes(name)) return true;

  for (const [key, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (name.includes(key) || key.includes(name)) {
      if (keywords.some((word) => text.includes(word))) return true;
    }
  }

  const tokens = name.split(/[+&／/、\s]+/).filter((t) => t.length >= 2);
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

/** 从「计划：…——实际」行提取实际完成内容 */
export function extractPlanActualContent(line: string): string | undefined {
  const dash = line.match(/——\s*(.+)/);
  if (!dash) return undefined;
  const content = dash[1].trim();
  return content.length >= 4 ? content : undefined;
}

/** 从「卡点：…」行提取卡点描述 */
export function extractBlockerContent(line: string): string | undefined {
  const content = line.replace(/^卡点[：:]\s*/, "").trim();
  return content.length >= 4 ? content : undefined;
}

/** 在当周已解析项目中，为计划/卡点行找到最匹配的项目下标 */
export function findProjectIndexForMetaLine(
  line: string,
  entries: Array<{ projectName?: string }>,
  fallbackIndex: number
): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const name = entries[i].projectName;
    if (name && contentMatchesProject(line, name)) return i;
  }
  return fallbackIndex;
}

/** 从 orphan 计划/卡点 highlight 找到应归属的项目 */
export function findProjectIndexForOrphanHighlight<
  T extends { name: string }
>(text: string, projects: T[]): number {
  const body = text.replace(/^计划[：:]|^卡点[：:]/, "").trim();
  const actual = extractPlanActualContent(text) ?? body;
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < projects.length; i++) {
    let score = 0;
    if (contentMatchesProject(text, projects[i].name)) score += 10;
    if (contentMatchesProject(actual, projects[i].name)) score += 8;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : -1;
}

/** 移除「计划」「卡点」伪项目，并将其明细归并到具体项目 */
export function absorbNonProjectMetaCards<T extends { name: string; highlights: string[] }>(
  projects: T[]
): T[] {
  const valid = projects.filter((p) => !isNonProjectMetaName(p.name));
  const junk = projects.filter((p) => isNonProjectMetaName(p.name));
  if (!junk.length) return valid;

  const result = valid.map((p) => ({ ...p, highlights: [...(p.highlights ?? [])] }));
  let lastAbsorbTarget = -1;

  for (const card of junk) {
    for (const raw of card.highlights ?? []) {
      let content = normalizeTaskHighlight(raw);
      if (!content) continue;

      if (/^计划[：:]/i.test(content)) {
        const actual = extractPlanActualContent(content);
        if (!actual) continue;
        content = actual;
      } else if (/^卡点[：:]/i.test(content)) {
        const blocker = extractBlockerContent(content);
        if (!blocker) continue;
        content = blocker;
      }

      let idx = findProjectIndexForOrphanHighlight(raw, result);
      if (idx < 0 && isNonProjectMetaName(card.name) && card.name === "卡点" && lastAbsorbTarget >= 0) {
        idx = lastAbsorbTarget;
      }
      if (idx < 0 && result.length === 1) idx = 0;
      if (idx < 0) continue;

      lastAbsorbTarget = idx;
      result[idx].highlights = mergeWeeklyHighlights(result[idx].highlights ?? [], [content]);
    }
  }

  return result;
}

/** 合并同名/变体项目（如 R2新品规划 与 R2新品规划PSM+弹性） */
export function mergeDuplicateProjects<
  T extends {
    name: string;
    highlights?: string[];
    tags?: string[];
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    projectId?: string;
    technologies?: string[];
  }
>(projects: T[]): T[] {
  const result: T[] = [];

  for (const item of projects) {
    const idx = result.findIndex((p) => projectsShouldMerge(p.name, item.name));
    if (idx < 0) {
      result.push({ ...item, name: canonicalProjectName(item.name) });
      continue;
    }

    const current = result[idx];
    const descriptions = [current.description, item.description]
      .filter((d): d is string => Boolean(d?.trim()))
      .flatMap((d) => d.split("；"))
      .map((d) => d.trim())
      .filter(Boolean);
    const uniqueDescriptions = Array.from(new Set(descriptions));

    result[idx] = {
      ...current,
      name: canonicalProjectName(current.name),
      highlights: mergeWeeklyHighlights(current.highlights ?? [], item.highlights ?? []),
      tags: Array.from(new Set([...(current.tags ?? []), ...(item.tags ?? [])])),
      description: uniqueDescriptions.join("；"),
      technologies: Array.from(
        new Set([...(current.technologies ?? []), ...(item.technologies ?? [])])
      ),
      projectId: current.projectId || item.projectId,
      startDate: pickEarlierDate(current.startDate, item.startDate),
      endDate: pickLaterDate(current.endDate, item.endDate),
      status:
        current.status === "ongoing" || item.status === "ongoing"
          ? "ongoing"
          : current.status,
    };
  }

  return result;
}

function pickEarlierDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function pickLaterDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}
